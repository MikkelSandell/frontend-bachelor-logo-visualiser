import { useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect } from "react-konva";
import useImage from "use-image";
import type { Product, PrintZone, PrintTechnique } from "@logo-visualizer/shared";
import { ZoneForm } from "../ZoneForm/ZoneForm";
import { Button } from "../ui/button";
import { Trash2 } from "lucide-react";

interface Props {
  product: Product;
  zones: PrintZone[];
  onZoneCreated: (zone: Omit<PrintZone, "id">) => void;
  onZoneUpdated: (zone: PrintZone) => void;
  onZoneDeleted: (zoneId: string) => void;
}

// Scale canvas to max 800px wide while preserving aspect ratio
const MAX_WIDTH = 800;

// Determine if a zone belongs to the back view (name contains "back")
// ARM zones are shown on the front view since the sleeves are visible in the front photo
function isBackZone(zoneName: string): boolean {
  return zoneName.toLowerCase().includes("back");
}

// Pick the canvas background image for the current view.
// Each Midocean zone has its own position-specific image; we use the "primary"
// zone's image (FRONT or BACK) so coordinates align with the correct photo.
function getViewImageUrl(zones: PrintZone[], view: "front" | "back", fallback: string): string {
  if (view === "front") {
    return (
      zones.find((z) => z.name.toUpperCase() === "FRONT")?.imageUrl ||
      zones.find((z) => !isBackZone(z.name))?.imageUrl ||
      fallback
    );
  }
  return (
    zones.find((z) => z.name.toUpperCase() === "BACK")?.imageUrl ||
    zones.find((z) => isBackZone(z.name) && !z.name.toLowerCase().includes("arm"))?.imageUrl ||
    zones.find((z) => isBackZone(z.name))?.imageUrl ||
    fallback
  );
}

export function ZoneEditor({
  product,
  zones,
  onZoneCreated,
  onZoneUpdated,
  onZoneDeleted,
}: Props) {
  const [view, setView] = useState<"front" | "back">("front");

  // Use the position-specific image for the current view so zone coordinates
  // are drawn on the correct background (FRONT coords on FRONT image, etc.)
  const viewImageUrl = getViewImageUrl(zones, view, product.imageUrl);
  const [productImage] = useImage(viewImageUrl);

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth = product.imageWidth * scale;
  const canvasHeight = product.imageHeight * scale;

  // Filter zones based on current view
  const visibleZones = zones.filter((z) =>
    view === "front" ? !isBackZone(z.name) : isBackZone(z.name)
  );

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
      imageUrl: viewImageUrl,
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tegn en zone ved at klikke og trække på billedet. Dobbeltklik på en eksisterende zone for at redigere den.
      </p>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={view === "front" ? "default" : "outline"}
          onClick={() => setView("front")}
        >
          Forside
        </Button>
        <Button
          size="sm"
          variant={view === "back" ? "default" : "outline"}
          onClick={() => setView("back")}
        >
          Bagside
        </Button>
      </div>

      <div className="overflow-auto">
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid #e8e8e8", borderRadius: "0.5rem", cursor: "crosshair" }}
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

            {/* Visible zones based on view (front or back) */}
            {visibleZones.map((zone) => {
              // ARM RIGHT coordinates reference an arm close-up image where the arm
              // is on the left — mirror horizontally so it renders on the right sleeve.
              const zoneX = zone.name.toUpperCase() === "ARM RIGHT"
                ? (product.imageWidth - zone.x - zone.width) * scale
                : zone.x * scale;
              return (
              <Rect
                key={zone.id}
                x={zoneX}
                y={zone.y * scale}
                width={zone.width * scale}
                height={zone.height * scale}
                stroke={selectedZoneId === zone.id ? "#0057ff" : "#ff6633"}
                strokeWidth={2}
                fill="rgba(255,102,51,0.12)"
                onClick={() => setSelectedZoneId(zone.id)}
                onDblClick={() => {
                  setSelectedZoneId(zone.id);
                  setEditingZone(zone);
                }}
              />
              );
            })}

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
      </div>

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
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onZoneDeleted(selectedZoneId);
              setSelectedZoneId(null);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Slet zone
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const zone = zones.find((z) => z.id === selectedZoneId);
              if (zone) setEditingZone(zone);
            }}
          >
            Rediger zone
          </Button>
        </div>
      )}
    </div>
  );
}
