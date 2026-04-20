import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group } from "react-konva";
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
  activeZoneId: string | null;
  onProductLoaded: (product: Product) => void;
}

export function ProductCanvas({ product, logoUrl, logoId, activeZoneId, onProductLoaded }: Props) {
  const activeZone_forImg = product.printZones.find((z) => z.id === activeZoneId);
  const zoneImageUrl = /^(front|back)/i.test(activeZone_forImg?.id ?? "")
    ? activeZone_forImg?.imageUrl
    : undefined;
  const [productImage] = useImage(zoneImageUrl || product.imageUrl);
  const [logoImage] = useImage(logoUrl ?? "");
  const [logoState, setLogoState] = useState<LogoState | null>(null);
  const [exporting, setExporting] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);

  // Notify parent when product is available
  useEffect(() => {
    onProductLoaded(product);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const activeZone: PrintZone | null =
    product.printZones.find((z) => z.id === activeZoneId) ?? null;

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth  = product.imageWidth  * scale;
  const canvasHeight = product.imageHeight * scale;

  // V2 – place logo centrally in zone when zone or logo changes
  useEffect(() => {
    if (!activeZone || !logoImage) return;
    const zoneW = activeZone.width  * scale;
    const zoneH = activeZone.height * scale;
    const logoW = Math.min(logoImage.width, zoneW * 0.5);
    const logoH = (logoImage.height / logoImage.width) * logoW;
    setLogoState({
      x: activeZone.x * scale + zoneW / 2 - logoW / 2,
      y: activeZone.y * scale + zoneH / 2 - logoH / 2,
      width: logoW,
      height: logoH,
    });
  }, [activeZone, logoImage, scale]);

  // V6 – clamp logo position inside zone boundaries
  function clampToZone(lx: number, ly: number, lw: number, lh: number, zone: PrintZone) {
    return {
      x: Math.max(zone.x * scale, Math.min(lx, (zone.x + zone.width)  * scale - lw)),
      y: Math.max(zone.y * scale, Math.min(ly, (zone.y + zone.height) * scale - lh)),
    };
  }

  // V8 – eksporter PNG via backend
  async function handleExportPng() {
    if (!logoState || !activeZone || !logoId) {
      alert("Vælg en zone, upload et logo, og vent til det er uploadet.");
      return;
    }
    setExporting(true);
    try {
      const blob = await requestExportPng({
        productId: product.id,
        zoneId: activeZone.id,
        logoId: logoId, // Brug faktiske logoId, ikke logoUrl!
        logoX: Math.round(logoState.x / scale),
        logoY: Math.round(logoState.y / scale),
        logoWidth: Math.round(logoState.width / scale),
        logoHeight: Math.round(logoState.height / scale),
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
          ref={stageRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid #e8e8e8", borderRadius: "0.5rem" }}
        >
          <Layer>
            {/* Product image */}
            {productImage && (
              <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} />
            )}

            {/* Active print zone indicator */}
            {activeZone && (
              <Rect
                x={activeZone.x * scale}
                y={activeZone.y * scale}
                width={activeZone.width * scale}
                height={activeZone.height * scale}
                stroke="#ff6633"
                strokeWidth={2}
                dash={[6, 3]}
                fill="rgba(255,102,51,0.06)"
              />
            )}

            {/* V4/V5 – draggable, scalable logo constrained to zone */}
            {logoImage && logoState && activeZone && (
              <Group
                x={logoState.x}
                y={logoState.y}
                draggable
                dragBoundFunc={(pos) =>
                  clampToZone(pos.x, pos.y, logoState.width, logoState.height, activeZone)
                }
                onDragEnd={(e) => {
                  const { x, y } = e.target.position();
                  setLogoState((prev) => (prev ? { ...prev, x, y } : prev));
                }}
              >
                <KonvaImage image={logoImage} width={logoState.width} height={logoState.height} />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>

      {/* V8 – PNG eksport */}
      <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting}>
        {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        {exporting ? "Eksporterer…" : "Download som PNG"}
      </Button>
    </div>
  );
}
