import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, Download, Loader2, Pencil, Upload } from "lucide-react";
import type { PrintZone, Product } from "@logo-visualizer/shared";
import { Layer, Image as KonvaImage, Rect, Stage, Text, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import {
  deleteProduct,
  exportProduct,
  getProduct,
  getTechniques,
  importProducts,
  parseApiError,
  updateProduct,
} from "../api/productApi";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const MAX_CANVAS_WIDTH = 900;

type ZoneDraft = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  maxColors: number;
  allowedTechniques: string[];
};

const EMPTY_DRAFT: ZoneDraft = {
  id: "",
  name: "",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  maxPhysicalWidthMm: 100,
  maxPhysicalHeightMm: 100,
  maxColors: 0,
  allowedTechniques: [],
};

function validateZone(zone: ZoneDraft, imageWidth: number, imageHeight: number): string[] {
  const errors: string[] = [];

  if (!zone.name.trim()) errors.push("Zone-navn må ikke være tomt.");
  if (zone.width <= 0 || zone.height <= 0) errors.push(`Zone ${zone.name || "(uden navn)"}: width/height skal være større end 0.`);
  if (zone.x < 0 || zone.y < 0) errors.push(`Zone ${zone.name || "(uden navn)"}: x/y skal være >= 0.`);
  if (zone.x + zone.width > imageWidth) errors.push(`Zone ${zone.name || "(uden navn)"}: x + width må ikke overstige imageWidth.`);
  if (zone.y + zone.height > imageHeight) errors.push(`Zone ${zone.name || "(uden navn)"}: y + height må ikke overstige imageHeight.`);

  return errors;
}

function toDraft(zone: PrintZone): ZoneDraft {
  return {
    id: String(zone.id),
    name: zone.name,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height,
    maxPhysicalWidthMm: zone.maxPhysicalWidthMm,
    maxPhysicalHeightMm: zone.maxPhysicalHeightMm,
    maxColors: zone.maxColors,
    allowedTechniques: [...(zone.allowedTechniques as string[])],
  };
}

function toZone(draft: ZoneDraft, productImageUrl: string): PrintZone {
  return {
    id: draft.id,
    name: draft.name.trim(),
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    maxPhysicalWidthMm: draft.maxPhysicalWidthMm,
    maxPhysicalHeightMm: draft.maxPhysicalHeightMm,
    maxColors: draft.maxColors,
    allowedTechniques: draft.allowedTechniques as unknown as PrintZone["allowedTechniques"],
    imageUrl: productImageUrl,
  };
}

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [zones, setZones] = useState<PrintZone[]>([]);
  const [title, setTitle] = useState("");

  const [techniques, setTechniques] = useState<string[]>([]);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [productImage] = useImage(product?.imageUrl ?? "");
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const zoneRectRefs = useRef<Record<string, Konva.Rect | null>>({});

  const canvasScale = useMemo(() => {
    if (!product || product.imageWidth <= 0) return 1;
    return Math.min(1, MAX_CANVAS_WIDTH / product.imageWidth);
  }, [product]);

  const canvasWidth = useMemo(() => {
    if (!product) return 0;
    return product.imageWidth * canvasScale;
  }, [product, canvasScale]);

  const canvasHeight = useMemo(() => {
    if (!product) return 0;
    return product.imageHeight * canvasScale;
  }, [product, canvasScale]);

  const knownTechniques = useMemo(() => {
    const dynamic = new Set(techniques);
    for (const zone of zones) {
      for (const technique of zone.allowedTechniques as string[]) {
        dynamic.add(technique);
      }
    }
    return [...dynamic].sort((a, b) => a.localeCompare(b));
  }, [techniques, zones]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setErrors(["Manglende produkt-id i URL."]);
      return;
    }

    const productId = id;

    async function loadData() {
      setLoading(true);
      setErrors([]);
      setSuccessMessage(null);
      setNotFound(false);

      try {
        const [loadedProduct, loadedTechniques] = await Promise.all([getProduct(productId), getTechniques()]);
        setProduct(loadedProduct);
        setZones(loadedProduct.printZones);
        setTitle(loadedProduct.title);
        setTechniques(loadedTechniques);
      } catch (error) {
        const parsed = parseApiError(error);
        if (parsed.statusCode === 404) {
          setProduct(null);
          setNotFound(true);
          setErrors([]);
        } else {
          setErrors(parsed.messages);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [id]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (editingZoneId && zoneRectRefs.current[editingZoneId]) {
      transformer.nodes([zoneRectRefs.current[editingZoneId] as Konva.Rect]);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [editingZoneId, zones]);

  function resetZoneDraft() {
    setEditingZoneId(null);
    setSelectedZoneId(null);
    setZoneDraft(EMPTY_DRAFT);
  }

  function handleZoneSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    const zoneErrors = validateZone(zoneDraft, product.imageWidth, product.imageHeight);
    if (zoneErrors.length > 0) {
      setErrors(zoneErrors);
      return;
    }

    const nextZone: PrintZone = toZone(
      {
        ...zoneDraft,
        id: editingZoneId ?? `temp-${Date.now()}`,
      },
      product.imageUrl
    );

    if (editingZoneId) {
      setZones((prev) => prev.map((zone) => (zone.id === editingZoneId ? nextZone : zone)));
      setSuccessMessage("Zone opdateret lokalt.");
    } else {
      setZones((prev) => [...prev, nextZone]);
      setSuccessMessage("Zone tilføjet lokalt.");
    }

    setErrors([]);
    resetZoneDraft();
  }

  function handleZoneEdit(zone: PrintZone) {
    setEditingZoneId(zone.id);
    setSelectedZoneId(zone.id);
    setZoneDraft(toDraft(zone));
    setSuccessMessage(null);
  }

  function handleZoneDelete(zoneId: string) {
    setZones((prev) => prev.filter((zone) => zone.id !== zoneId));
    if (editingZoneId === zoneId) {
      resetZoneDraft();
    }
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
    setSuccessMessage("Zone fjernet lokalt.");
  }

  function updateZoneGeometry(zoneId: string, updates: Pick<ZoneDraft, "x" | "y" | "width" | "height">) {
    setZones((prev) =>
      prev.map((zone) => {
        if (zone.id !== zoneId) return zone;
        return {
          ...zone,
          x: updates.x,
          y: updates.y,
          width: updates.width,
          height: updates.height,
        };
      })
    );

    if (editingZoneId === zoneId) {
      setZoneDraft((prev) => ({
        ...prev,
        x: updates.x,
        y: updates.y,
        width: updates.width,
        height: updates.height,
      }));
    }
  }

  function clampRectToImage(x: number, y: number, width: number, height: number) {
    if (!product) {
      return { x, y, width, height };
    }

    const maxX = Math.max(0, product.imageWidth - width);
    const maxY = Math.max(0, product.imageHeight - height);
    return {
      x: Math.max(0, Math.min(Math.round(x), maxX)),
      y: Math.max(0, Math.min(Math.round(y), maxY)),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  async function handleSaveAll() {
    if (!product || saving) return;

    const validationErrors: string[] = [];

    if (!title.trim()) {
      validationErrors.push("Produkttitel må ikke være tom.");
    }

    if (product.imageWidth <= 0 || product.imageHeight <= 0) {
      validationErrors.push("Billedbredde og billedhøjde skal være større end 0.");
    }

    for (const zone of zones) {
      validationErrors.push(...validateZone(toDraft(zone), product.imageWidth, product.imageHeight));
    }

    if (validationErrors.length > 0) {
      setErrors([...new Set(validationErrors)]);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSuccessMessage(null);

    try {
      const saved = await updateProduct(product.id, {
        ...product,
        title: title.trim(),
        printZones: zones,
      });

      setProduct(saved);
      setZones(saved.printZones);
      setTitle(saved.title);
      setSuccessMessage("Produkt og zoner gemt.");
    } catch (error) {
      const apiError = parseApiError(error);
      if (apiError.statusCode === 400) {
        setErrors(apiError.messages);
      } else {
        setErrors(apiError.messages);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (!product || exporting) return;

    setExporting(true);
    setErrors([]);

    try {
      const blob = await exportProduct(product.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${product.title || "product"}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrors(parseApiError(error).messages);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    if (importing) return;

    setImporting(true);
    setErrors([]);

    try {
      const imported = await importProducts(file);
      if (imported.length === 0) {
        setErrors(["Import lykkedes ikke: ingen produkter i filen."]);
      } else if (imported.length === 1) {
        navigate(`/products/${imported[0].id}`);
      } else {
        setSuccessMessage(`Importerede ${imported.length} produkter.`);
      }
    } catch (error) {
      setErrors(parseApiError(error).messages);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete() {
    if (!product || deleting) return;
    if (!window.confirm(`Slet produktet "${product.title}"? Dette kan ikke fortrydes.`)) return;

    setDeleting(true);
    setErrors([]);

    try {
      await deleteProduct(product.id);
      navigate("/");
    } catch (error) {
      setErrors(parseApiError(error).messages);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Indlæser produkt...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-24 text-center text-muted-foreground space-y-4">
        <p>{notFound ? "Produktet findes ikke længere." : "Produktet blev ikke fundet."}</p>
        <Button variant="outline" onClick={() => navigate("/")}>Tilbage til produkter</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-24">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage
          </Button>
          <h1 className="text-2xl font-semibold">Produkteditor</h1>
          <Badge variant="secondary">{product.id}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowMetadata((prev) => !prev)} className="gap-2">
            <Pencil className="h-4 w-4" />
            {showMetadata ? "Skjul metadata" : "Rediger metadata"}
          </Button>
          <input
            id="editor-import-input"
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImport(file);
              }
              event.currentTarget.value = "";
            }}
          />
          <Button variant="outline" onClick={() => document.getElementById("editor-import-input")?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 text-sm text-green-800 flex items-start gap-2">
            <Check className="h-4 w-4 mt-0.5" />
            <span>{successMessage}</span>
          </CardContent>
        </Card>
      )}

      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-sm text-red-800 space-y-1">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                {errors.map((error) => (
                  <p key={error}>• {error}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Canvas</CardTitle>
          <CardDescription>
            Klik og træk på billedet for at tegne en ny zone. Klik på en eksisterende zone for at vælge den, og tryk "Rediger zone" for at flytte/resize den.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto border rounded-md" style={{ cursor: drawStart ? "crosshair" : "default" }}>
            <Stage
              width={canvasWidth}
              height={canvasHeight}
              style={{ cursor: editingZoneId ? "default" : "crosshair" }}
              onMouseDown={(e) => {
                if (e.target !== e.target.getStage()) return;
                resetZoneDraft();
                setSelectedZoneId(null);
                const pos = e.target.getStage()?.getPointerPosition();
                if (pos) {
                  setDrawStart({ x: pos.x, y: pos.y });
                  setDrawPreview(null);
                }
              }}
              onMouseMove={(e) => {
                if (!drawStart) return;
                const pos = e.target.getStage()?.getPointerPosition();
                if (!pos) return;
                setDrawPreview({
                  x: Math.min(drawStart.x, pos.x),
                  y: Math.min(drawStart.y, pos.y),
                  width: Math.abs(pos.x - drawStart.x),
                  height: Math.abs(pos.y - drawStart.y),
                });
              }}
              onMouseUp={() => {
                if (!drawStart) return;
                setDrawStart(null);
                const preview = drawPreview;
                setDrawPreview(null);
                if (!preview || preview.width < 10 || preview.height < 10) return;
                const newZone: PrintZone = {
                  id: `temp-${Date.now()}`,
                  name: "",
                  x: Math.round(preview.x / canvasScale),
                  y: Math.round(preview.y / canvasScale),
                  width: Math.round(preview.width / canvasScale),
                  height: Math.round(preview.height / canvasScale),
                  maxPhysicalWidthMm: 100,
                  maxPhysicalHeightMm: 100,
                  maxColors: 0,
                  allowedTechniques: [],
                  imageUrl: product.imageUrl,
                };
                setZones((prev) => [...prev, newZone]);
                setSelectedZoneId(newZone.id);
                handleZoneEdit(newZone);
              }}
            >
              <Layer>
                {productImage && <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} listening={false} />}

                {zones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  const isEditing = zone.id === editingZoneId;
                  return (
                    <Rect
                      key={zone.id}
                      ref={(node) => {
                        zoneRectRefs.current[zone.id] = node;
                      }}
                      x={zone.x * canvasScale}
                      y={zone.y * canvasScale}
                      width={zone.width * canvasScale}
                      height={zone.height * canvasScale}
                      stroke={isEditing ? "#0057ff" : isSelected ? "#0057ff" : "#ff6633"}
                      strokeWidth={isSelected || isEditing ? 2.5 : 2}
                      fill={isEditing ? "rgba(0,87,255,0.08)" : isSelected ? "rgba(0,87,255,0.05)" : "rgba(255,102,51,0.12)"}
                      draggable={isEditing}
                      onClick={() => {
                        if (editingZoneId && editingZoneId !== zone.id) {
                          resetZoneDraft();
                        }
                        setSelectedZoneId(zone.id);
                      }}
                      onDragEnd={(event) => {
                        const next = clampRectToImage(
                          event.target.x() / canvasScale,
                          event.target.y() / canvasScale,
                          zone.width,
                          zone.height
                        );
                        updateZoneGeometry(zone.id, next);
                      }}
                      onTransformEnd={(event) => {
                        const node = event.target as Konva.Rect;
                        const nextWidth = (node.width() * node.scaleX()) / canvasScale;
                        const nextHeight = (node.height() * node.scaleY()) / canvasScale;
                        const nextX = node.x() / canvasScale;
                        const nextY = node.y() / canvasScale;
                        node.scaleX(1);
                        node.scaleY(1);
                        const next = clampRectToImage(nextX, nextY, nextWidth, nextHeight);
                        updateZoneGeometry(zone.id, next);
                      }}
                    />
                  );
                })}

                {zones.map((zone) => (
                  <Text
                    key={`${zone.id}-label`}
                    x={zone.x * canvasScale + 4}
                    y={zone.y * canvasScale + 4}
                    text={zone.name || "(uden navn)"}
                    fontSize={12}
                    fill={zone.id === selectedZoneId ? "#0057ff" : "#ff6633"}
                    listening={false}
                  />
                ))}

                {drawPreview && drawPreview.width > 0 && drawPreview.height > 0 && (
                  <Rect
                    x={drawPreview.x}
                    y={drawPreview.y}
                    width={drawPreview.width}
                    height={drawPreview.height}
                    stroke="#0057ff"
                    strokeWidth={1.5}
                    fill="rgba(0,87,255,0.08)"
                    dash={[6, 3]}
                    listening={false}
                  />
                )}

                <Transformer
                  ref={transformerRef}
                  keepRatio={false}
                  rotateEnabled={false}
                  enabledAnchors={[
                    "top-left",
                    "top-center",
                    "top-right",
                    "middle-right",
                    "bottom-right",
                    "bottom-center",
                    "bottom-left",
                    "middle-left",
                  ]}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 10 || newBox.height < 10) return oldBox;
                    if (newBox.x < 0 || newBox.y < 0) return oldBox;
                    if (newBox.x + newBox.width > canvasWidth) return oldBox;
                    if (newBox.y + newBox.height > canvasHeight) return oldBox;
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>

          {selectedZoneId && !editingZoneId && (
            <div className="mt-3 flex items-center gap-3 rounded-md border px-3 py-2">
              <span className="text-sm font-medium">{zones.find((z) => z.id === selectedZoneId)?.name}</span>
              <Button
                size="sm"
                onClick={() => {
                  const zone = zones.find((z) => z.id === selectedZoneId);
                  if (zone) handleZoneEdit(zone);
                }}
              >
                Rediger zone
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedZoneId(null)}>
                Fravælg
              </Button>
            </div>
          )}

          {editingZoneId && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-sm font-medium text-blue-800">
                Redigerer: {zones.find((z) => z.id === editingZoneId)?.name}
              </span>
              <Button size="sm" variant="outline" onClick={resetZoneDraft}>
                Færdig
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showMetadata && (
        <Card>
          <CardHeader>
            <CardTitle>Produktmetadata</CardTitle>
            <CardDescription>Metadata gemmes sammen med alle zoner i Save All.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="product-title">Titel</Label>
              <Input id="product-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-width">Billedbredde (px)</Label>
              <Input id="product-width" value={product.imageWidth} disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-height">Billedhøjde (px)</Label>
              <Input id="product-height" value={product.imageHeight} disabled />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="product-image-url">Image URL</Label>
              <Input id="product-image-url" value={product.imageUrl} disabled />
            </div>

            <div className="md:col-span-2 border rounded-md bg-muted/20 p-3 max-w-sm">
              <img src={product.imageUrl} alt={product.title} className="w-full h-auto object-contain" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Zone-egenskaber</CardTitle>
            <CardDescription>
              {editingZoneId
                ? "Rediger egenskaber for den valgte zone."
                : "Tegn en ny zone på billedet, eller klik på en eksisterende zone og tryk \"Rediger zone\"."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!editingZoneId ? (
              <p className="text-sm text-muted-foreground">Ingen zone valgt.</p>
            ) : (
              <form onSubmit={handleZoneSubmit} className="space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="zone-name">Navn</Label>
                  <Input
                    id="zone-name"
                    value={zoneDraft.name}
                    placeholder="fx. Forside, Ryg, Venstre ærme…"
                    onChange={(event) => {
                      const name = event.target.value;
                      setZoneDraft((prev) => ({ ...prev, name }));
                      setZones((prev) => prev.map((zone) => (zone.id === editingZoneId ? { ...zone, name } : zone)));
                    }}
                    required
                  />
                </div>

                {/* Position */}
                <div className="space-y-1.5">
                  <Label>Position (px)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">X</span>
                      <Input
                        id="zone-x"
                        type="number"
                        value={zoneDraft.x}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const x = Number(event.target.value);
                          setZoneDraft((prev) => ({ ...prev, x }));
                          updateZoneGeometry(editingZoneId, { x, y: zoneDraft.y, width: zoneDraft.width, height: zoneDraft.height });
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Y</span>
                      <Input
                        id="zone-y"
                        type="number"
                        value={zoneDraft.y}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const y = Number(event.target.value);
                          setZoneDraft((prev) => ({ ...prev, y }));
                          updateZoneGeometry(editingZoneId, { x: zoneDraft.x, y, width: zoneDraft.width, height: zoneDraft.height });
                        }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Size */}
                <div className="space-y-1.5">
                  <Label>Størrelse (px)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Bredde</span>
                      <Input
                        id="zone-width"
                        type="number"
                        min={1}
                        value={zoneDraft.width}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const width = Number(event.target.value);
                          setZoneDraft((prev) => ({ ...prev, width }));
                          updateZoneGeometry(editingZoneId, { x: zoneDraft.x, y: zoneDraft.y, width, height: zoneDraft.height });
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Højde</span>
                      <Input
                        id="zone-height"
                        type="number"
                        min={1}
                        value={zoneDraft.height}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          const height = Number(event.target.value);
                          setZoneDraft((prev) => ({ ...prev, height }));
                          updateZoneGeometry(editingZoneId, { x: zoneDraft.x, y: zoneDraft.y, width: zoneDraft.width, height });
                        }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Max colors */}
                <div className="space-y-1.5">
                  <Label htmlFor="zone-max-colors">Maks farver <span className="text-muted-foreground font-normal">(0 = ubegrænset)</span></Label>
                  <Input
                    id="zone-max-colors"
                    type="number"
                    min={0}
                    value={zoneDraft.maxColors}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setZoneDraft((prev) => ({ ...prev, maxColors: Number(event.target.value) }))}
                    required
                  />
                </div>

                {/* Techniques */}
                <div className="space-y-2">
                  <Label>Tilladte teknikker</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {knownTechniques.length === 0 ? (
                      <p className="text-sm text-muted-foreground col-span-2">Ingen teknikker tilgængelige.</p>
                    ) : (
                      knownTechniques.map((technique) => (
                        <label key={technique} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={zoneDraft.allowedTechniques.includes(technique)}
                            onChange={(event) => {
                              setZoneDraft((prev) => {
                                const next = event.target.checked
                                  ? [...prev.allowedTechniques, technique]
                                  : prev.allowedTechniques.filter((value) => value !== technique);
                                return { ...prev, allowedTechniques: next };
                              });
                            }}
                          />
                          {technique}
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit">Gem zone</Button>
                  <Button type="button" variant="outline" onClick={resetZoneDraft}>
                    Annuller
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zoner ({zones.length})</CardTitle>
            <CardDescription>Zoner gemmes til backend når du trykker "Gem ændringer".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {zones.length === 0 && <p className="text-sm text-muted-foreground">Ingen zoner endnu. Tegn en zone på billedet ovenfor.</p>}

            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`rounded-md border p-3 space-y-1.5 transition-colors ${zone.id === editingZoneId ? "border-blue-300 bg-blue-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{zone.name || <span className="text-muted-foreground italic">(uden navn)</span>}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedZoneId(zone.id);
                        handleZoneEdit(zone);
                      }}
                    >
                      Rediger
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm(`Slet zonen "${zone.name || "(uden navn)"}"?`)) {
                          handleZoneDelete(zone.id);
                        }
                      }}
                    >
                      Slet
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Position: x={zone.x}, y={zone.y} &nbsp;·&nbsp; Størrelse: {zone.width}×{zone.height} px
                </p>
                <p className="text-xs text-muted-foreground">
                  Fysisk: {zone.maxPhysicalWidthMm}×{zone.maxPhysicalHeightMm} mm &nbsp;·&nbsp; Farver: {zone.maxColors || "∞"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Teknikker: {(zone.allowedTechniques as string[]).join(", ") || "Ingen"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto flex gap-2">
          <Button onClick={handleSaveAll} disabled={saving || deleting} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Gemmer..." : "Gem ændringer"}
          </Button>
          <Button variant="outline" disabled={saving || deleting} onClick={() => navigate("/")}>
            Tilbage til produkter
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={saving || deleting} className="gap-2 ml-auto">
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Sletter..." : "Slet produkt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
