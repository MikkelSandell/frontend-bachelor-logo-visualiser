import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Transformer } from "react-konva";
import Konva from "konva";
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
  focusZoneId?: string | null;
  onFocusConsumed?: () => void;
}

const MAX_WIDTH = 800;

function isBackZone(zoneName: string): boolean {
  return zoneName.toLowerCase().includes("back");
}

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

export function ZoneEditor({ product, zones, onZoneCreated, onZoneUpdated, onZoneDeleted, focusZoneId, onFocusConsumed }: Props) {
  const [view, setView] = useState<"front" | "back">("front");

  const viewImageUrl = getViewImageUrl(zones, view, product.imageUrl);
  const [productImage] = useImage(viewImageUrl);

  const scale = Math.min(1, MAX_WIDTH / product.imageWidth);
  const canvasWidth  = product.imageWidth  * scale;
  const canvasHeight = product.imageHeight * scale;

  const visibleZones = zones.filter((z) =>
    view === "front" ? !isBackZone(z.name) : isBackZone(z.name)
  );

  // ── Drawing state ──────────────────────────────────────────────────────────
  const [drawing, setDrawing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);

  // ── Pending zone (drawn, not yet saved) ────────────────────────────────────
  // pendingCanvas: live canvas-space coords (updated while dragging/resizing)
  // pendingZone:   unscaled zone data passed to ZoneForm
  const [pendingCanvas, setPendingCanvas] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pendingZone,   setPendingZone]   = useState<Omit<PrintZone, "id"> | null>(null);

  // ── Selected / editing existing zone ──────────────────────────────────────
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [editingZone,    setEditingZone]    = useState<PrintZone | null>(null);
  const [originalZone,   setOriginalZone]   = useState<PrintZone | null>(null);

  // Pixel-to-mm ratios derived from the zone's state at the moment editing started.
  // Must be declared after originalZone useState.
  const mmPerPxW = originalZone && originalZone.width > 0 && originalZone.maxPhysicalWidthMm > 0
    ? originalZone.maxPhysicalWidthMm / originalZone.width
    : 1;
  const mmPerPxH = originalZone && originalZone.height > 0 && originalZone.maxPhysicalHeightMm > 0
    ? originalZone.maxPhysicalHeightMm / originalZone.height
    : 1;

  // ── Konva refs ─────────────────────────────────────────────────────────────
  const transformerRef  = useRef<Konva.Transformer>(null);
  const pendingRectRef  = useRef<Konva.Rect | null>(null);
  const zoneRectRefs    = useRef<Record<string, Konva.Rect | null>>({});

  // Select and open edit form for a zone triggered from outside (zone list)
  useEffect(() => {
    if (!focusZoneId) return;
    const zone = zones.find((z) => z.id === focusZoneId);
    if (zone) {
      setSelectedZoneId(focusZoneId);
      setEditingZone(zone);
      setOriginalZone(zone);
    }
    onFocusConsumed?.();
  }, [focusZoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach the transformer only to the zone actively being edited (or the pending zone)
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (pendingCanvas && pendingRectRef.current) {
      tr.nodes([pendingRectRef.current]);
    } else if (editingZone && zoneRectRefs.current[editingZone.id]) {
      tr.nodes([zoneRectRefs.current[editingZone.id]!]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [pendingCanvas, editingZone]);

  // Keep pendingZone's unscaled coords in sync with pendingCanvas
  function syncPending(canvas: { x: number; y: number; width: number; height: number }) {
    setPendingCanvas(canvas);
    setPendingZone((prev) =>
      prev
        ? {
            ...prev,
            x:      Math.round(canvas.x      / scale),
            y:      Math.round(canvas.y      / scale),
            width:  Math.round(canvas.width  / scale),
            height: Math.round(canvas.height / scale),
          }
        : null
    );
  }

  // ── Mouse handlers for drawing ─────────────────────────────────────────────
  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (pendingCanvas) return; // positioning mode — no new drawing
    if (e.target !== e.target.getStage()) return; // only react to stage background
    setSelectedZoneId(null);
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    drawStart.current = pos;
    setDrawing({ x: pos.x, y: pos.y, width: 0, height: 0 });
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!drawStart.current) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setDrawing({
      x:      Math.min(drawStart.current.x, pos.x),
      y:      Math.min(drawStart.current.y, pos.y),
      width:  Math.abs(pos.x - drawStart.current.x),
      height: Math.abs(pos.y - drawStart.current.y),
    });
  }

  function handleMouseUp() {
    if (!drawing || drawing.width < 10 || drawing.height < 10) {
      setDrawing(null);
      drawStart.current = null;
      return;
    }
    const canvas = { x: drawing.x, y: drawing.y, width: drawing.width, height: drawing.height };
    setPendingCanvas(canvas);
    const zoneW = Math.round(canvas.width  / scale);
    const zoneH = Math.round(canvas.height / scale);
    setPendingZone({
      name: "",
      x:      Math.round(canvas.x / scale),
      y:      Math.round(canvas.y / scale),
      width:  zoneW,
      height: zoneH,
      maxPhysicalWidthMm:  zoneW,
      maxPhysicalHeightMm: zoneH,
      allowedTechniques: [],
      maxColors: 0,
      imageUrl: viewImageUrl,
    });
    setDrawing(null);
    drawStart.current = null;
  }

  // ── Form handlers ──────────────────────────────────────────────────────────
  function handlePendingSubmit(meta: {
    name: string;
    maxPhysicalWidthMm: number;
    maxPhysicalHeightMm: number;
    allowedTechniques: PrintTechnique[];
    maxColors: number;
  }) {
    if (!pendingZone) return;
    onZoneCreated({ ...pendingZone, ...meta });
    setPendingZone(null);
    setPendingCanvas(null);
  }

  function cancelPending() {
    setPendingZone(null);
    setPendingCanvas(null);
  }

  // ── Existing zone transform end ────────────────────────────────────────────
  function handleExistingTransformEnd(zone: PrintZone, e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect;
    const newWidth  = Math.max(20, node.width()  * node.scaleX());
    const newHeight = Math.max(20, node.height() * node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    const newX = Math.max(0, Math.min(node.x(), canvasWidth  - newWidth));
    const newY = Math.max(0, Math.min(node.y(), canvasHeight - newHeight));
    node.position({ x: newX, y: newY });
    node.width(newWidth);
    node.height(newHeight);
    const newWidthPx  = Math.round(newWidth  / scale);
    const newHeightPx = Math.round(newHeight / scale);
    onZoneUpdated({
      ...zone,
      x:                   Math.round(newX / scale),
      y:                   Math.round(newY / scale),
      width:               newWidthPx,
      height:              newHeightPx,
      maxPhysicalWidthMm:  Math.round(newWidthPx  * mmPerPxW),
      maxPhysicalHeightMm: Math.round(newHeightPx * mmPerPxH),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {pendingCanvas
          ? "Flyt eller tilpas zonen — træk i hjørnerne for at ændre størrelse. Udfyld metadata nedenfor og gem."
          : editingZone
          ? "Træk zonen eller resize via hjørnerne. Opdater metadata nedenfor og gem."
          : "Tegn en ny zone ved at klikke og trække. Klik på en eksisterende zone for at vælge den, og tryk derefter 'Rediger zone'."}
      </p>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>
          Forside
        </Button>
        <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>
          Bagside
        </Button>
      </div>

      <div className="overflow-auto">
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "1px solid #e8e8e8", borderRadius: "0.5rem", cursor: pendingCanvas ? "default" : "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {productImage && (
              <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} listening={false} />
            )}

            {/* Existing zones */}
            {visibleZones.map((zone) => {
              const isArm      = /arm/i.test(zone.name);
              const isRightArm = /right/i.test(zone.name);
              const zoneX      = isRightArm
                ? (product.imageWidth - zone.x - zone.width) * scale
                : zone.x * scale;
              const isSelected = selectedZoneId === zone.id;

              return (
                <React.Fragment key={zone.id}>
                  <Rect
                    ref={(node) => { zoneRectRefs.current[zone.id] = node; }}
                    x={zoneX}
                    y={zone.y * scale}
                    width={zone.width  * scale}
                    height={zone.height * scale}
                    stroke={isSelected ? "#0057ff" : "#ff6633"}
                    strokeWidth={2}
                    fill={isSelected ? "rgba(0,87,255,0.08)" : "rgba(255,102,51,0.12)"}
                    draggable={!isArm && !pendingCanvas && editingZone?.id === zone.id}
                    dragBoundFunc={(pos) => ({
                      x: Math.max(0, Math.min(pos.x, canvasWidth  - zone.width  * scale)),
                      y: Math.max(0, Math.min(pos.y, canvasHeight - zone.height * scale)),
                    })}
                    onDragStart={() => { setSelectedZoneId(zone.id); }}
                    onClick={() => { if (!pendingCanvas) setSelectedZoneId(zone.id); }}
                    onDblClick={() => { if (!pendingCanvas) { setSelectedZoneId(zone.id); setEditingZone(zone); setOriginalZone(zone); } }}
                    onDragEnd={(e) => {
                      onZoneUpdated({
                        ...zone,
                        x: Math.round(e.target.x() / scale),
                        y: Math.round(e.target.y() / scale),
                      });
                    }}
                    onTransformEnd={(e) => handleExistingTransformEnd(zone, e)}
                  />
                  {zone.name && (
                    <Text
                      key={`label-${zone.id}`}
                      x={zoneX + 4}
                      y={zone.y * scale + 4}
                      width={zone.width * scale - 8}
                      text={zone.name}
                      fontSize={12}
                      fontStyle="bold"
                      fontFamily="Inter, sans-serif"
                      fill={isSelected ? "#0057ff" : "#ff6633"}
                      shadowColor="white"
                      shadowBlur={3}
                      shadowOpacity={1}
                      listening={false}
                      wrap="none"
                      ellipsis
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Live drawing preview */}
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

            {/* Pending zone — draggable/resizable before saving */}
            {pendingCanvas && (
              <Rect
                ref={(node) => { pendingRectRef.current = node; }}
                x={pendingCanvas.x}
                y={pendingCanvas.y}
                width={pendingCanvas.width}
                height={pendingCanvas.height}
                stroke="#0057ff"
                strokeWidth={2}
                fill="rgba(0,87,255,0.08)"
                draggable
                dragBoundFunc={(pos) => ({
                  x: Math.max(0, Math.min(pos.x, canvasWidth  - pendingCanvas.width)),
                  y: Math.max(0, Math.min(pos.y, canvasHeight - pendingCanvas.height)),
                })}
                onDragEnd={(e) => {
                  syncPending({ ...pendingCanvas, x: e.target.x(), y: e.target.y() });
                }}
                onTransformEnd={(e) => {
                  const node = e.target as Konva.Rect;
                  const newWidth  = Math.max(20, node.width()  * node.scaleX());
                  const newHeight = Math.max(20, node.height() * node.scaleY());
                  node.scaleX(1);
                  node.scaleY(1);
                  const next = {
                    x:      Math.max(0, Math.min(node.x(), canvasWidth  - newWidth)),
                    y:      Math.max(0, Math.min(node.y(), canvasHeight - newHeight)),
                    width:  newWidth,
                    height: newHeight,
                  };
                  node.position({ x: next.x, y: next.y });
                  node.width(next.width);
                  node.height(next.height);
                  syncPending(next);
                }}
              />
            )}

            {/* Single Transformer — attaches to the zone being edited or the pending zone */}
            <Transformer
              ref={transformerRef}
              keepRatio={false}
              rotateEnabled={false}
              enabledAnchors={[
                "top-left", "top-center", "top-right",
                "middle-right", "bottom-right",
                "bottom-center", "bottom-left", "middle-left",
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                if (
                  newBox.x < 0 || newBox.y < 0 ||
                  newBox.x + newBox.width  > canvasWidth ||
                  newBox.y + newBox.height > canvasHeight
                ) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* Metadata form for newly drawn zone */}
      {pendingZone && (
        <ZoneForm
          initial={pendingZone}
          onSubmit={handlePendingSubmit}
          onCancel={cancelPending}
          onDimensionsChange={(wMm, hMm) => {
            if (!pendingCanvas) return;
            syncPending({
              ...pendingCanvas,
              width:  Math.max(20, wMm * scale),
              height: Math.max(20, hMm * scale),
            });
          }}
        />
      )}

      {/* Edit form for existing zone — changes flow live to local state; Annuller restores original */}
      {editingZone && (() => {
        const current = zones.find((z) => z.id === editingZone.id);
        return (
          <ZoneForm
            initial={editingZone}
            showSubmit={false}
            forcedWidthMm={current?.maxPhysicalWidthMm}
            forcedHeightMm={current?.maxPhysicalHeightMm}
            onChange={(meta) => {
              if (!current) return;
              onZoneUpdated({
                ...current,
                ...meta,
                width:  Math.max(1, Math.round(meta.maxPhysicalWidthMm  / mmPerPxW)),
                height: Math.max(1, Math.round(meta.maxPhysicalHeightMm / mmPerPxH)),
              });
            }}
            onDone={() => {
              setEditingZone(null);
              setOriginalZone(null);
              setSelectedZoneId(null);
            }}
            onCancel={() => {
              if (originalZone) onZoneUpdated(originalZone);
              setEditingZone(null);
              setOriginalZone(null);
              setSelectedZoneId(null);
            }}
          />
        );
      })()}

      {/* Actions for selected existing zone */}
      {selectedZoneId && !editingZone && !pendingZone && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { onZoneDeleted(selectedZoneId); setSelectedZoneId(null); }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Slet zone
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const zone = zones.find((z) => z.id === selectedZoneId);
              if (zone) { setEditingZone(zone); setOriginalZone(zone); }
            }}
          >
            Rediger zone
          </Button>
        </div>
      )}
    </div>
  );
}
