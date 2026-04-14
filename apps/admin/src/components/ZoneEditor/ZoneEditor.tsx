import { useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect } from "react-konva";
import useImage from "use-image";
import type { Product, PrintZone, PrintTechnique } from "@logo-visualizer/shared";
import { ZoneForm } from "../ZoneForm/ZoneForm";

interface Props {
  product: Product;
  onZoneCreated: (zone: Omit<PrintZone, "id">) => void;
  onZoneUpdated: (zone: PrintZone) => void;
  onZoneDeleted: (zoneId: string) => void;
}

// Scale canvas to max 800px wide while preserving aspect ratio
const MAX_WIDTH = 800;

export function ZoneEditor({
  product,
  onZoneCreated,
  onZoneUpdated,
  onZoneDeleted,
}: Props) {
  const [productImage] = useImage(product.imageUrl);
  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth = product.imageWidth * scale;
  const canvasHeight = product.imageHeight * scale;

  // Pending rectangle being drawn
  const [drawing, setDrawing] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);

  // Zone being configured in the form
  const [pendingZone, setPendingZone] = useState<Omit<PrintZone, "id"> | null>(null);
  // A4 – selected zone for editing / deleting
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<PrintZone | null>(null);

  // Pointer events for drawing a new zone (A2)
  function handleMouseDown(e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } }) {
    if (selectedZoneId) {
      setSelectedZoneId(null);
      return;
    }
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    drawStart.current = pos;
    setDrawing({ x: pos.x, y: pos.y, width: 0, height: 0 });
  }

  function handleMouseMove(e: { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } | null } }) {
    if (!drawStart.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setDrawing({
      x: Math.min(drawStart.current.x, pos.x),
      y: Math.min(drawStart.current.y, pos.y),
      width: Math.abs(pos.x - drawStart.current.x),
      height: Math.abs(pos.y - drawStart.current.y),
    });
  }

  function handleMouseUp() {
    if (!drawing || drawing.width < 10 || drawing.height < 10) {
      setDrawing(null);
      drawStart.current = null;
      return;
    }
    // Convert back to original image coordinates (A3)
    setPendingZone({
      name: "",
      x: Math.round(drawing.x / scale),
      y: Math.round(drawing.y / scale),
      width: Math.round(drawing.width / scale),
      height: Math.round(drawing.height / scale),
      maxPhysicalWidthMm: 0,
      maxPhysicalHeightMm: 0,
      allowedTechniques: [],
      maxColors: 0,
    });
    setDrawing(null);
    drawStart.current = null;
  }

  function handleZoneFormSubmit(meta: {
    name: string;
    maxPhysicalWidthMm: number;
    maxPhysicalHeightMm: number;
    allowedTechniques: PrintTechnique[];
    maxColors: number;
  }) {
    if (!pendingZone) return;
    onZoneCreated({ ...pendingZone, ...meta });
    setPendingZone(null);
  }

  return (
    <div>
      <p style={{ marginBottom: "0.5rem" }}>
        Tegn en zone ved at klikke og trække på billedet.
      </p>

      <Stage
        width={canvasWidth}
        height={canvasHeight}
        style={{ border: "1px solid #ccc", cursor: "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer>
          {/* Product image */}
          {productImage && (
            <KonvaImage
              image={productImage}
              width={canvasWidth}
              height={canvasHeight}
            />
          )}

          {/* Existing zones (A4 – click to select; double-click to edit) */}
          {product.printZones.map((zone) => (
            <Rect
              key={zone.id}
              x={zone.x * scale}
              y={zone.y * scale}
              width={zone.width * scale}
              height={zone.height * scale}
              stroke={selectedZoneId === zone.id ? "#0057ff" : "#ff6600"}
              strokeWidth={2}
              fill="rgba(255,100,0,0.15)"
              onClick={() => setSelectedZoneId(zone.id)}
              onDblClick={() => {
                setSelectedZoneId(zone.id);
                setEditingZone(zone);
              }}
            />
          ))}

          {/* In-progress drawing */}
          {drawing && (
            <Rect
              x={drawing.x}
              y={drawing.y}
              width={drawing.width}
              height={drawing.height}
              stroke="#0057ff"
              strokeWidth={2}
              dash={[6, 3]}
            />
          )}

        </Layer>
      </Stage>

      {/* A3 – zone metadata form shown after drawing */}
      {pendingZone && (
        <ZoneForm
          initial={pendingZone}
          onSubmit={handleZoneFormSubmit}
          onCancel={() => setPendingZone(null)}
        />
      )}

      {/* A4 – edit existing zone */}
      {editingZone && (
        <ZoneForm
          initial={editingZone}
          onSubmit={(meta) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            onZoneUpdated({ ...editingZone!, ...meta });
            setEditingZone(null);
          }}
          onCancel={() => setEditingZone(null)}
        />
      )}

      {/* A4 – selected zone actions */}
      {selectedZoneId && !editingZone && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            onClick={() => {
              onZoneDeleted(selectedZoneId);
              setSelectedZoneId(null);
            }}
            style={{ color: "red" }}
          >
            Slet zone
          </button>
        </div>
      )}
    </div>
  );
}
