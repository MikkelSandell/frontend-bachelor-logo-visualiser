import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Rect,
  Group,
} from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import { getProduct } from "../../api/viewerApi";

const MAX_WIDTH = 700;

interface LogoState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  preloadedProductId?: string;
  logoUrl?: string;
  activeZoneId: string | null;
  onProductLoaded: (product: Product) => void;
}

export function ProductCanvas({
  preloadedProductId,
  logoUrl,
  activeZoneId,
  onProductLoaded,
}: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [productImage] = useImage(product?.imageUrl ?? "");
  const [logoImage] = useImage(logoUrl ?? "");
  const [logoState, setLogoState] = useState<LogoState | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const logoRef = useRef<Konva.Image>(null);

  // Load product (B2)
  useEffect(() => {
    if (!preloadedProductId) return;
    getProduct(preloadedProductId).then((r) => {
      if (r.success) {
        setProduct(r.data);
        onProductLoaded(r.data);
      }
    });
  }, [preloadedProductId, onProductLoaded]);

  const activeZone: PrintZone | null =
    product?.printZones.find((z) => z.id === activeZoneId) ?? null;

  const scale = product ? Math.min(1, MAX_WIDTH / product.imageWidth) : 1;
  const canvasWidth = (product?.imageWidth ?? MAX_WIDTH) * scale;
  const canvasHeight = (product?.imageHeight ?? 500) * scale;

  // V2 – place logo centrally in zone when zone or logo changes
  useEffect(() => {
    if (!activeZone || !logoImage) return;
    const zoneW = activeZone.width * scale;
    const zoneH = activeZone.height * scale;
    // Start logo at 50% of zone dimensions, centred
    const logoW = Math.min(logoImage.width, zoneW * 0.5);
    const logoH = (logoImage.height / logoImage.width) * logoW;
    setLogoState({
      x: activeZone.x * scale + zoneW / 2 - logoW / 2,
      y: activeZone.y * scale + zoneH / 2 - logoH / 2,
      width: logoW,
      height: logoH,
    });
  }, [activeZone, logoImage, scale]);

  // V6 – clamp logo inside zone on drag end
  function clampToZone(
    lx: number,
    ly: number,
    lw: number,
    lh: number,
    zone: PrintZone
  ): { x: number; y: number } {
    const minX = zone.x * scale;
    const minY = zone.y * scale;
    const maxX = (zone.x + zone.width) * scale - lw;
    const maxY = (zone.y + zone.height) * scale - lh;
    return {
      x: Math.max(minX, Math.min(lx, maxX)),
      y: Math.max(minY, Math.min(ly, maxY)),
    };
  }

  // V8 – export canvas as PNG (client-side via Konva)
  function handleExportPng() {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ mimeType: "image/png" });
    const a = document.createElement("a");
    a.href = uri;
    a.download = "logo-visualisering.png";
    a.click();
  }

  if (!product) return <p>Vælg et produkt for at starte…</p>;

  return (
    <div>
      <Stage ref={stageRef} width={canvasWidth} height={canvasHeight}>
        <Layer>
          {/* Product image */}
          {productImage && (
            <KonvaImage
              image={productImage}
              width={canvasWidth}
              height={canvasHeight}
            />
          )}

          {/* Active print zone indicator */}
          {activeZone && (
            <Rect
              x={activeZone.x * scale}
              y={activeZone.y * scale}
              width={activeZone.width * scale}
              height={activeZone.height * scale}
              stroke="#0057ff"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}

          {/* V4/V5 – draggable, scalable logo */}
          {logoImage && logoState && activeZone && (
            <Group
              x={logoState.x}
              y={logoState.y}
              draggable
              onDragEnd={(e) => {
                const node = e.target;
                const clamped = clampToZone(
                  node.x(),
                  node.y(),
                  logoState.width,
                  logoState.height,
                  activeZone
                );
                node.position(clamped);
                setLogoState((prev) =>
                  prev ? { ...prev, ...clamped } : prev
                );
              }}
              // V6 – prevent dragging outside zone
              dragBoundFunc={(pos) => {
                const clamped = clampToZone(
                  pos.x,
                  pos.y,
                  logoState.width,
                  logoState.height,
                  activeZone
                );
                return clamped;
              }}
            >
              <KonvaImage
                ref={logoRef}
                image={logoImage}
                width={logoState.width}
                height={logoState.height}
              />
            </Group>
          )}
        </Layer>
      </Stage>

      {/* V8 – PNG export */}
      <button onClick={handleExportPng} style={{ marginTop: "0.75rem" }}>
        Download som PNG
      </button>
    </div>
  );
}
