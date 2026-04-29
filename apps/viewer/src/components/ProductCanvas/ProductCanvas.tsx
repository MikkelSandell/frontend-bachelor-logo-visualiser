import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import type { LogoEntry } from "../../types";
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

/** Loads multiple images keyed by an arbitrary string (zone ID). */
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

    if (entries.length === 0) {
      setImages({});
      return;
    }

    setImages({});

    entries.forEach(([key, url]) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setImages((prev) => ({ ...prev, [key]: img }));
      };
      img.src = url;
    });

    return () => {
      cancelled = true;
    };
  }, [urlString]); // eslint-disable-line react-hooks/exhaustive-deps

  return images;
}

interface Props {
  product: Product;
  logos: LogoEntry[];
  zoneLogoAssignments: Record<string, string>;
  /** All zones that have a logo placed on them */
  activeZoneIds: string[];
  /** Which active zone is currently selected for editing */
  focusedZoneId: string | null;
  /** Which zone's image is currently displayed */
  viewedZoneId: string | null;
  onFocusZone: (zoneId: string) => void;
  onProductLoaded: (product: Product) => void;
}

export function ProductCanvas({
  product,
  logos,
  zoneLogoAssignments,
  activeZoneIds,
  focusedZoneId,
  viewedZoneId,
  onFocusZone,
  onProductLoaded,
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

  const focusedZone = product.printZones.find((z) => z.id === focusedZoneId) ?? null;
  const focusedIsVisible = focusedZone ? isBackZone(focusedZone) === viewedIsBack : false;

  const [productImage] = useImage(viewedImageUrl);

  // Build a map of zoneId → logo URL for all active zones that have an assignment
  const zoneLogoUrlMap: Record<string, string> = {};
  for (const zoneId of activeZoneIds) {
    const logoId = zoneLogoAssignments[zoneId];
    if (!logoId) continue;
    const logo = logos.find((l) => l.id === logoId);
    if (logo) zoneLogoUrlMap[zoneId] = logo.url;
  }

  const logoImages = useMultipleImages(zoneLogoUrlMap);

  const [logoStates, setLogoStates] = useState<Record<string, LogoState>>({});
  const [exporting, setExporting] = useState(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Image | null>>({});

  // Reset placement for a zone when its assigned logo changes
  const prevAssignmentsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const prev = prevAssignmentsRef.current;
    prevAssignmentsRef.current = zoneLogoAssignments;

    const changedZones = Object.keys({ ...prev, ...zoneLogoAssignments }).filter(
      (zoneId) => prev[zoneId] !== zoneLogoAssignments[zoneId]
    );
    if (changedZones.length === 0) return;

    setLogoStates((existing) => {
      const next = { ...existing };
      for (const zoneId of changedZones) delete next[zoneId];
      return next;
    });
  }, [zoneLogoAssignments]);

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth  = product.imageWidth  * scale;
  const canvasHeight = product.imageHeight * scale;

  // Initialize placement for any newly activated zone that has a loaded logo image
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
          y: zone.y * scale + zoneH / 2 - logoH / 2,
          width: logoW,
          height: logoH,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZoneIds, logoImages, scale]);

  // Attach transformer to the focused logo node
  useEffect(() => {
    if (!transformerRef.current) return;
    if (focusedZoneId && focusedIsVisible && nodeRefs.current[focusedZoneId]) {
      transformerRef.current.nodes([nodeRefs.current[focusedZoneId]!]);
    } else {
      transformerRef.current.nodes([]);
    }
    transformerRef.current.getLayer()?.batchDraw();
  }, [focusedZoneId, focusedIsVisible, logoStates]);

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

  function updateLogoState(zoneId: string, patch: Partial<LogoState>) {
    setLogoStates((prev) => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], ...patch },
    }));
  }

  // V8 – export PNG: composites all logos visible on the current side into one image
  async function handleExportPng() {
    const placements = visibleZones.flatMap((zone) => {
      const state = logoStates[zone.id];
      const logoId = zoneLogoAssignments[zone.id];
      if (!state || !logoId) return [];
      return [{
        zoneId: zone.id,
        logoId,
        logoX: Math.round(state.x / scale),
        logoY: Math.round(state.y / scale),
        logoWidth:  Math.round(state.width  / scale),
        logoHeight: Math.round(state.height / scale),
      }];
    });

    if (placements.length === 0) {
      alert("Ingen logoer er placeret på den nuværende side. Upload et logo og placer det i en printzone.");
      return;
    }

    setExporting(true);
    try {
      const blob = await requestExportPng({
        productId: product.id,
        backgroundImageUrl: viewedImageUrl,
        placements,
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

  return (
    <div className="space-y-3">
      <div className="overflow-auto">
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid #e8e8e8", borderRadius: "0.5rem" }}
        >
          <Layer>
            {productImage && (
              <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} />
            )}

            {/* Zone outlines — always visible so the user can see print areas */}
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
              const isFocused = focusedZoneId === zone.id;
              return (
                <KonvaImage
                  key={`logo-${zone.id}`}
                  ref={(node) => { nodeRefs.current[zone.id] = node; }}
                  image={img}
                  x={state.x}
                  y={state.y}
                  width={state.width}
                  height={state.height}
                  draggable={isFocused}
                  onClick={() => onFocusZone(zone.id)}
                  onTap={() => onFocusZone(zone.id)}
                  dragBoundFunc={(pos) =>
                    clampToZone(pos.x, pos.y, state.width, state.height, zone)
                  }
                  onDragEnd={(e) => {
                    const { x, y } = e.target.position();
                    updateLogoState(zone.id, { x, y });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Image;
                    const newWidth  = Math.max(20, node.width()  * node.scaleX());
                    const newHeight = Math.max(20, node.height() * node.scaleY());
                    node.scaleX(1);
                    node.scaleY(1);
                    const clamped = clampToZone(node.x(), node.y(), newWidth, newHeight, zone);
                    node.position(clamped);
                    updateLogoState(zone.id, {
                      x: clamped.x,
                      y: clamped.y,
                      width: newWidth,
                      height: newHeight,
                    });
                  }}
                />
              );
            })}

            {/* Single Transformer — attached to the focused logo */}
            <Transformer
              ref={transformerRef}
              keepRatio={true}
              rotateEnabled={false}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              boundBoxFunc={(oldBox, newBox) => {
                if (!focusedZone || !focusedIsVisible) return oldBox;
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                const dispX = displayXForZone(focusedZone);
                const zoneLeft   = dispX * scale;
                const zoneTop    = focusedZone.y * scale;
                const zoneRight  = (dispX + focusedZone.width)  * scale;
                const zoneBottom = (focusedZone.y + focusedZone.height) * scale;
                if (
                  newBox.x < zoneLeft  ||
                  newBox.y < zoneTop   ||
                  newBox.x + newBox.width  > zoneRight  ||
                  newBox.y + newBox.height > zoneBottom
                ) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>

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
