import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { Product, PrintZone } from "@logo-visualizer/shared";
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

interface Props {
  product: Product;
  logoUrl?: string;
  logoId: string | null;
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
  product, logoUrl, logoId,
  activeZoneIds, focusedZoneId, viewedZoneId,
  onFocusZone, onProductLoaded,
}: Props) {

  function effectiveImageUrl(zone: PrintZone): string {
    const isArm = /\barm\b/i.test(zone.id);
    return isArm ? product.imageUrl : (zone.imageUrl || product.imageUrl);
  }

  function displayXForZone(zone: PrintZone): number {
    const isRightArm = /right/i.test(zone.id);
    return isRightArm ? product.imageWidth - zone.x - zone.width : zone.x;
  }

  const viewedZone = product.printZones.find((z) => z.id === viewedZoneId);
  const viewedImageUrl = viewedZone ? effectiveImageUrl(viewedZone) : product.imageUrl;

  // Zones to render on the current view: active zones whose image matches the viewed side
  const visibleZones = product.printZones.filter(
    (z) => activeZoneIds.includes(z.id) && effectiveImageUrl(z) === viewedImageUrl
  );

  const focusedZone = product.printZones.find((z) => z.id === focusedZoneId) ?? null;
  const focusedIsVisible = focusedZone ? effectiveImageUrl(focusedZone) === viewedImageUrl : false;

  const [productImage] = useImage(viewedImageUrl);
  const [logoImage] = useImage(logoUrl ?? "");

  // Per-zone logo placements
  const [logoStates, setLogoStates] = useState<Record<string, LogoState>>({});
  const [exporting, setExporting] = useState(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  // Map of zoneId → Konva.Image node — populated via ref callbacks
  const nodeRefs = useRef<Record<string, Konva.Image | null>>({});

  // Clear all placements when a new logo is uploaded
  useEffect(() => {
    setLogoStates({});
  }, [logoUrl]);

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth  = product.imageWidth  * scale;
  const canvasHeight = product.imageHeight * scale;

  // Initialize placement for any newly activated zone that doesn't have one yet
  useEffect(() => {
    if (!logoImage) return;
    setLogoStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const zoneId of activeZoneIds) {
        if (next[zoneId]) continue;
        const zone = product.printZones.find((z) => z.id === zoneId);
        if (!zone) continue;
        const dispX = displayXForZone(zone);
        const zoneW = zone.width  * scale;
        const zoneH = zone.height * scale;
        const logoW = Math.min(logoImage.width, zoneW * 0.5);
        const logoH = (logoImage.height / logoImage.width) * logoW;
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
  }, [activeZoneIds, logoImage, scale]);

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

  // V8 – export PNG for the focused zone
  async function handleExportPng() {
    const state = focusedZoneId ? logoStates[focusedZoneId] : null;
    if (!state || !focusedZone || !logoId) {
      alert("Vælg en printzone, upload et logo, og vent til det er uploadet.");
      return;
    }
    setExporting(true);
    try {
      const blob = await requestExportPng({
        productId: product.id,
        zoneId: focusedZone.id,
        logoId,
        logoX: Math.round(state.x / scale),
        logoY: Math.round(state.y / scale),
        logoWidth:  Math.round(state.width  / scale),
        logoHeight: Math.round(state.height / scale),
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
          onMouseDown={(e) => {
            // Clicking the stage background deselects focused zone
            if (e.target === e.target.getStage()) {
              // no-op — keep focused zone; user must click a logo to switch
            }
          }}
        >
          <Layer>
            {productImage && (
              <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} />
            )}

            {/* Render one logo per visible active zone */}
            {logoImage && visibleZones.map((zone) => {
              const state = logoStates[zone.id];
              if (!state) return null;
              const isFocused = focusedZoneId === zone.id;
              const dispX = displayXForZone(zone);
              return (
                <Rect
                  key={`zone-${zone.id}`}
                  x={dispX * scale}
                  y={zone.y * scale}
                  width={zone.width  * scale}
                  height={zone.height * scale}
                  stroke={isFocused ? "#ff6633" : "#aaaaaa"}
                  strokeWidth={isFocused ? 2 : 1}
                  dash={[6, 3]}
                  fill={isFocused ? "rgba(255,102,51,0.06)" : "rgba(0,0,0,0.02)"}
                />
              );
            })}

            {logoImage && visibleZones.map((zone) => {
              const state = logoStates[zone.id];
              if (!state) return null;
              const isFocused = focusedZoneId === zone.id;
              return (
                <KonvaImage
                  key={`logo-${zone.id}`}
                  ref={(node) => { nodeRefs.current[zone.id] = node; }}
                  image={logoImage}
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
                    updateLogoState(zone.id, { x: clamped.x, y: clamped.y, width: newWidth, height: newHeight });
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
        {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        {exporting ? "Eksporterer…" : "Download som PNG"}
      </Button>
    </div>
  );
}
