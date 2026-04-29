import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import type { LogoEntry, TextEntry } from "../../types";
import { requestExportPng } from "../../api/viewerApi";
import { Button } from "../ui/button";
import { Download, Loader2 } from "lucide-react";

const MAX_WIDTH = 700;

interface LogoState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextState {
  x: number;        // canvas pixels
  y: number;        // canvas pixels
  fontSize: number; // product-image pixels (divided by scale when exporting)
  color: string;    // '#rrggbb'
}

type FocusedElement = { zoneId: string; type: "logo" | "text" } | null;

/** Loads multiple images keyed by zone ID. Updates per-image as each one loads. */
function useMultipleImages(
  urlMap: Record<string, string>
): Record<string, HTMLImageElement | undefined> {
  const [images, setImages] = useState<Record<string, HTMLImageElement | undefined>>({});

  const urlString = JSON.stringify(
    Object.fromEntries(
      Object.entries(urlMap).sort(([a], [b]) => a.localeCompare(b))
    )
  );

  useEffect(() => {
    let cancelled = false;
    const map = JSON.parse(urlString) as Record<string, string>;
    const entries = Object.entries(map).filter(([, url]) => !!url);

    if (entries.length === 0) { setImages({}); return; }
    setImages({});

    entries.forEach(([key, url]) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setImages((prev) => ({ ...prev, [key]: img }));
      };
      img.src = url;
    });

    return () => { cancelled = true; };
  }, [urlString]); // eslint-disable-line react-hooks/exhaustive-deps

  return images;
}

interface Props {
  product: Product;
  logos: LogoEntry[];
  zoneLogoAssignments: Record<string, string>;
  texts: TextEntry[];
  zoneTextAssignments: Record<string, string>;
  activeZoneIds: string[];
  focusedZoneId: string | null;
  viewedZoneId: string | null;
  onFocusZone: (zoneId: string) => void;
  onProductLoaded: (product: Product) => void;
}

export function ProductCanvas({
  product, logos, zoneLogoAssignments,
  texts, zoneTextAssignments,
  activeZoneIds, focusedZoneId, viewedZoneId,
  onFocusZone, onProductLoaded,
}: Props) {

  function effectiveImageUrl(zone: PrintZone): string {
    const isArm = /\barm\b/i.test(zone.name);
    return isArm ? product.imageUrl : (zone.imageUrl || product.imageUrl);
  }

  function displayXForZone(zone: PrintZone): number {
    const isRightArm = /right/i.test(zone.name);
    return isRightArm ? product.imageWidth - zone.x - zone.width : zone.x;
  }

  const isBackZone = (z: PrintZone) => /back/i.test(z.name);

  const viewedZone = product.printZones.find((z) => z.id === viewedZoneId);
  const viewedImageUrl = viewedZone ? effectiveImageUrl(viewedZone) : product.imageUrl;
  const viewedIsBack = viewedZone ? isBackZone(viewedZone) : false;

  const allSideZones = product.printZones.filter((z) => isBackZone(z) === viewedIsBack);
  const visibleZones = allSideZones.filter((z) => activeZoneIds.includes(z.id));

  const [productImage] = useImage(viewedImageUrl);

  // Build URL map: zoneId → logo URL for active zones that have an assignment
  const zoneLogoUrlMap: Record<string, string> = {};
  for (const zoneId of activeZoneIds) {
    const logoId = zoneLogoAssignments[zoneId];
    if (!logoId) continue;
    const logo = logos.find((l) => l.id === logoId);
    if (logo) zoneLogoUrlMap[zoneId] = logo.url;
  }
  const logoImages = useMultipleImages(zoneLogoUrlMap);

  const [logoStates, setLogoStates] = useState<Record<string, LogoState>>({});
  const [textStates, setTextStates] = useState<Record<string, TextState>>({});
  // Which canvas element (logo or text) is currently selected for the Transformer
  const [focusedElement, setFocusedElement] = useState<FocusedElement>(null);
  const [exporting, setExporting] = useState(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Image | null>>({});
  const textNodeRefs = useRef<Record<string, Konva.Text | null>>({});

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth  = product.imageWidth  * scale;
  const canvasHeight = product.imageHeight * scale;

  // ─── Reset logo placement when its assignment changes ─────────────────────

  const prevLogoAssignmentsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const prev = prevLogoAssignmentsRef.current;
    prevLogoAssignmentsRef.current = zoneLogoAssignments;
    const changed = Object.keys({ ...prev, ...zoneLogoAssignments }).filter(
      (z) => prev[z] !== zoneLogoAssignments[z]
    );
    if (changed.length === 0) return;
    setLogoStates((s) => {
      const next = { ...s };
      for (const z of changed) delete next[z];
      return next;
    });
  }, [zoneLogoAssignments]);

  // ─── Reset text placement when its assignment changes ─────────────────────

  const prevTextAssignmentsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const prev = prevTextAssignmentsRef.current;
    prevTextAssignmentsRef.current = zoneTextAssignments;
    const changed = Object.keys({ ...prev, ...zoneTextAssignments }).filter(
      (z) => prev[z] !== zoneTextAssignments[z]
    );
    if (changed.length === 0) return;
    setTextStates((s) => {
      const next = { ...s };
      for (const zoneId of changed) {
        if (zoneTextAssignments[zoneId]) {
          // Initialize at zone upper-left with a small inset
          const zone = product.printZones.find((z) => z.id === zoneId);
          if (zone) {
            const dispX = displayXForZone(zone);
            next[zoneId] = {
              x: dispX * scale + zone.width * scale * 0.08,
              y: zone.y  * scale + zone.height * scale * 0.15,
              fontSize: 24,
              color: "#000000",
            };
          }
        } else {
          delete next[zoneId];
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneTextAssignments]);

  // ─── Initialize logo placements for newly active zones ───────────────────

  useEffect(() => {
    setLogoStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const zoneId of activeZoneIds) {
        if (next[zoneId]) continue;
        const img = logoImages[zoneId];
        if (!img) continue;
        const zone = product.printZones.find((z) => z.id === zoneId);
        if (!zone) continue;
        const dispX = displayXForZone(zone);
        const zoneW = zone.width  * scale;
        const zoneH = zone.height * scale;
        const logoW = Math.min(img.width, zoneW * 0.5);
        const logoH = (img.height / img.width) * logoW;
        next[zoneId] = {
          x: dispX * scale + zoneW / 2 - logoW / 2,
          y: zone.y  * scale + zoneH / 2 - logoH / 2,
          width: logoW,
          height: logoH,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZoneIds, logoImages, scale]);

  // ─── Attach Transformer to focused element ────────────────────────────────

  useEffect(() => {
    if (!transformerRef.current) return;
    let node: Konva.Image | Konva.Text | null = null;

    if (focusedElement) {
      const { zoneId, type } = focusedElement;
      const zone = product.printZones.find((z) => z.id === zoneId);
      const isVisible = zone ? isBackZone(zone) === viewedIsBack : false;
      if (isVisible) {
        node = type === "logo"
          ? (nodeRefs.current[zoneId] ?? null)
          : (textNodeRefs.current[zoneId] ?? null);
      }
    }

    transformerRef.current.nodes(node ? [node as Konva.Node] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [focusedElement, logoStates, textStates, viewedIsBack]); // eslint-disable-line

  useEffect(() => {
    onProductLoaded(product);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  function clampToZone(lx: number, ly: number, lw: number, lh: number, zone: PrintZone) {
    const zoneDispX = displayXForZone(zone);
    return {
      x: Math.max(zoneDispX * scale, Math.min(lx, (zoneDispX + zone.width)  * scale - lw)),
      y: Math.max(zone.y    * scale, Math.min(ly, (zone.y     + zone.height) * scale - lh)),
    };
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function handleExportPng() {
    const logoPlacements = visibleZones.flatMap((zone) => {
      const state = logoStates[zone.id];
      const logoId = zoneLogoAssignments[zone.id];
      if (!state || !logoId) return [];
      return [{
        zoneId: zone.id, logoId,
        logoX: Math.round(state.x / scale),
        logoY: Math.round(state.y / scale),
        logoWidth:  Math.round(state.width  / scale),
        logoHeight: Math.round(state.height / scale),
      }];
    });

    const textPlacements = visibleZones.flatMap((zone) => {
      const state = textStates[zone.id];
      const textId = zoneTextAssignments[zone.id];
      const entry = textId ? texts.find((t) => t.id === textId) : null;
      if (!state || !entry) return [];
      return [{
        zoneId: zone.id,
        text: entry.text,
        x: Math.round(state.x / scale),
        y: Math.round(state.y / scale),
        fontSize: state.fontSize,
        color: state.color,
      }];
    });

    if (logoPlacements.length === 0 && textPlacements.length === 0) {
      alert("Ingen logoer eller tekster er placeret på den nuværende side.");
      return;
    }

    setExporting(true);
    try {
      const blob = await requestExportPng({
        productId: product.id,
        backgroundImageUrl: viewedImageUrl,
        placements: logoPlacements,
        textPlacements,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "logo-visualisering.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PNG eksport fejl:", error);
      alert("Kunne ikke eksportere PNG fra backend.");
    } finally {
      setExporting(false);
    }
  }

  // ─── Focused text state helpers ───────────────────────────────────────────

  const focusedTextZoneId =
    focusedElement?.type === "text" ? focusedElement.zoneId : null;
  const focusedTextState = focusedTextZoneId ? textStates[focusedTextZoneId] : null;

  function updateTextState(zoneId: string, patch: Partial<TextState>) {
    setTextStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], ...patch } }));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto">
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid #e8e8e8", borderRadius: "0.5rem" }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setFocusedElement(null);
          }}
        >
          <Layer>
            {productImage && (
              <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} />
            )}

            {/* Zone outlines */}
            {allSideZones.map((zone) => {
              const isActive  = activeZoneIds.includes(zone.id);
              const isFocused = focusedZoneId === zone.id;
              const dispX = displayXForZone(zone);
              return (
                <Rect
                  key={`zone-${zone.id}`}
                  x={dispX * scale}
                  y={zone.y * scale}
                  width={zone.width  * scale}
                  height={zone.height * scale}
                  stroke={isFocused ? "#ff6633" : isActive ? "#ff9966" : "#bbbbbb"}
                  strokeWidth={isFocused ? 2 : 1}
                  dash={[6, 3]}
                  fill={
                    isFocused
                      ? "rgba(255,102,51,0.06)"
                      : isActive
                      ? "rgba(255,102,51,0.03)"
                      : "transparent"
                  }
                />
              );
            })}

            {/* Per-zone logos */}
            {visibleZones.map((zone) => {
              const img   = logoImages[zone.id];
              const state = logoStates[zone.id];
              if (!img || !state) return null;
              const isLogoFocused =
                focusedElement?.zoneId === zone.id && focusedElement?.type === "logo";
              return (
                <KonvaImage
                  key={`logo-${zone.id}`}
                  ref={(node) => { nodeRefs.current[zone.id] = node; }}
                  image={img}
                  x={state.x}
                  y={state.y}
                  width={state.width}
                  height={state.height}
                  draggable={isLogoFocused}
                  onClick={() => { setFocusedElement({ zoneId: zone.id, type: "logo" }); onFocusZone(zone.id); }}
                  onTap={() => { setFocusedElement({ zoneId: zone.id, type: "logo" }); onFocusZone(zone.id); }}
                  dragBoundFunc={(pos) =>
                    clampToZone(pos.x, pos.y, state.width, state.height, zone)
                  }
                  onDragEnd={(e) => {
                    const { x, y } = e.target.position();
                    setLogoStates((prev) => ({ ...prev, [zone.id]: { ...prev[zone.id], x, y } }));
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Image;
                    const newWidth  = Math.max(20, node.width()  * node.scaleX());
                    const newHeight = Math.max(20, node.height() * node.scaleY());
                    node.scaleX(1); node.scaleY(1);
                    const clamped = clampToZone(node.x(), node.y(), newWidth, newHeight, zone);
                    node.position(clamped);
                    setLogoStates((prev) => ({
                      ...prev,
                      [zone.id]: { x: clamped.x, y: clamped.y, width: newWidth, height: newHeight },
                    }));
                  }}
                />
              );
            })}

            {/* Per-zone text items */}
            {visibleZones.map((zone) => {
              const textId = zoneTextAssignments[zone.id];
              const entry  = textId ? texts.find((t) => t.id === textId) : null;
              const state  = textStates[zone.id];
              if (!entry || !state) return null;
              return (
                <KonvaText
                  key={`text-${zone.id}`}
                  ref={(node) => { textNodeRefs.current[zone.id] = node; }}
                  text={entry.text}
                  x={state.x}
                  y={state.y}
                  fontSize={state.fontSize * scale}
                  fill={state.color}
                  fontFamily="Arial, sans-serif"
                  draggable
                  onClick={() => { setFocusedElement({ zoneId: zone.id, type: "text" }); onFocusZone(zone.id); }}
                  onTap={() => { setFocusedElement({ zoneId: zone.id, type: "text" }); onFocusZone(zone.id); }}
                  dragBoundFunc={(pos) => {
                    const node = textNodeRefs.current[zone.id];
                    const tw = (node?.width()  ?? 80) * (node?.scaleX() ?? 1);
                    const th = (node?.height() ?? state.fontSize * scale) * (node?.scaleY() ?? 1);
                    return clampToZone(pos.x, pos.y, tw, th, zone);
                  }}
                  onDragEnd={(e) => {
                    const { x, y } = e.target.position();
                    updateTextState(zone.id, { x, y });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Text;
                    // Scale factor applied by Transformer → convert back to product pixels
                    const newFontSize = Math.max(8, (node.fontSize() * node.scaleY()) / scale);
                    node.scaleX(1); node.scaleY(1);
                    updateTextState(zone.id, { x: node.x(), y: node.y(), fontSize: newFontSize });
                  }}
                />
              );
            })}

            {/* Single Transformer — attaches to whichever element is focused */}
            <Transformer
              ref={transformerRef}
              keepRatio={focusedElement?.type === "logo"}
              rotateEnabled={false}
              enabledAnchors={
                focusedElement?.type === "logo"
                  ? ["top-left", "top-right", "bottom-left", "bottom-right"]
                  : ["top-left", "top-right", "bottom-left", "bottom-right",
                     "middle-left", "middle-right", "top-center", "bottom-center"]
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (!focusedElement) return oldBox;
                const zone = product.printZones.find((z) => z.id === focusedElement.zoneId);
                if (!zone) return newBox;
                if (newBox.width < 20 || newBox.height < 8) return oldBox;
                const dispX = displayXForZone(zone);
                const zL = dispX * scale,  zT = zone.y * scale;
                const zR = (dispX + zone.width) * scale;
                const zB = (zone.y + zone.height) * scale;
                if (newBox.x < zL || newBox.y < zT ||
                    newBox.x + newBox.width  > zR ||
                    newBox.y + newBox.height > zB) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* Font controls — shown when a text element is focused */}
      {focusedTextZoneId && focusedTextState && (
        <div className="flex flex-wrap items-center gap-4 px-1 py-2 border border-border rounded-md bg-muted/20">
          <span className="text-xs font-medium text-muted-foreground">Tekst</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Størrelse</label>
            <input
              type="range"
              min={8}
              max={96}
              value={focusedTextState.fontSize}
              onChange={(e) =>
                updateTextState(focusedTextZoneId, { fontSize: Number(e.target.value) })
              }
              className="w-24 accent-primary"
            />
            <span className="text-xs w-8">{focusedTextState.fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Farve</label>
            <input
              type="color"
              value={focusedTextState.color}
              onChange={(e) =>
                updateTextState(focusedTextZoneId, { color: e.target.value })
              }
              className="w-8 h-7 cursor-pointer border border-border rounded"
            />
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting}>
        {exporting
          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          : <Download className="h-4 w-4 mr-2" />
        }
        {exporting ? "Eksporterer…" : "Download som PNG"}
      </Button>
    </div>
  );
}
