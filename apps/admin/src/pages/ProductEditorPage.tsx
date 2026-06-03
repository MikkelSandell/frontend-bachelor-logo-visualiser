import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Check, Download, Lock, Loader2, Pencil, Upload, Wand2, X } from "lucide-react";
import { getTechniqueFilterConfig } from "../lib/techniqueFilters";
import { PRINT_TECHNIQUES, type PrintZone, type Product } from "@logo-visualizer/shared";
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
  uploadBumArtikel,
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
  bumArtikelUrl?: string;
  bumArtikelFileId?: string;
  bumArtikelX?: number;
  bumArtikelY?: number;
  bumArtikelWidth?: number;
  bumArtikelHeight?: number;
  bumArtikelTechnique?: string;
  bumArtikelColorCount?: number;
};

const TECHNIQUE_SET = new Set<string>(PRINT_TECHNIQUES);

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
  if (zone.allowedTechniques.some((technique) => !TECHNIQUE_SET.has(technique))) {
    errors.push(`Zone ${zone.name || "(uden navn)"}: indeholder en ukendt teknik.`);
  }

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
    allowedTechniques: [...zone.allowedTechniques],
    bumArtikelUrl: zone.bumArtikelUrl,
    bumArtikelFileId: zone.bumArtikelFileId,
    bumArtikelX: zone.bumArtikelX,
    bumArtikelY: zone.bumArtikelY,
    bumArtikelWidth: zone.bumArtikelWidth,
    bumArtikelHeight: zone.bumArtikelHeight,
    bumArtikelTechnique: zone.bumArtikelTechnique,
    bumArtikelColorCount: zone.bumArtikelColorCount,
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
    allowedTechniques: draft.allowedTechniques,
    imageUrl: productImageUrl,
    bumArtikelUrl: draft.bumArtikelUrl,
    bumArtikelFileId: draft.bumArtikelFileId,
    bumArtikelX: draft.bumArtikelX,
    bumArtikelY: draft.bumArtikelY,
    bumArtikelWidth: draft.bumArtikelWidth,
    bumArtikelHeight: draft.bumArtikelHeight,
    bumArtikelTechnique: draft.bumArtikelTechnique,
    bumArtikelColorCount: draft.bumArtikelColorCount,
  };
}

async function processImageForColors(srcUrl: string, colorCount: number): Promise<HTMLImageElement> {
  const fetchUrl = srcUrl.replace(/^https?:\/\/localhost:\d+/, "");
  const blob = await fetch(fetchUrl).then((r) => r.blob());
  const blobUrl = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = blobUrl;
  });
  URL.revokeObjectURL(blobUrl);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return img;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  if (colorCount === 1) {
    for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
  } else if (colorCount === 2) {
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = g; d[i + 1] = g; d[i + 2] = g;
    }
  } else {
    const levels = Math.max(2, Math.round((colorCount / 8) * 8));
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.round(Math.round(d[i]     / step) * step);
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise<HTMLImageElement>((resolve) => {
    const out = new Image(); out.onload = () => resolve(out); out.src = canvas.toDataURL();
  });
}

/**
 * Flood-fill background removal — seeds from all edge pixels and makes
 * connected pixels that match the top-left corner colour transparent.
 * Fetches via the Vite proxy so the canvas is never cross-origin tainted.
 */
async function removeBackground(srcUrl: string): Promise<string> {
  const fetchUrl = srcUrl.replace(/^https?:\/\/localhost:\d+/, "");
  const blob = await fetch(fetchUrl).then((r) => r.blob());
  const objectUrl = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return srcUrl;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  const bgR = d[0], bgG = d[1], bgB = d[2];
  const TOL_SQ = 50 * 50;

  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  function tryEnqueue(idx: number) {
    if (idx < 0 || idx >= w * h || visited[idx]) return;
    const i = idx * 4;
    if (d[i + 3] < 10) { visited[idx] = 1; return; }
    const dr = d[i] - bgR, dg = d[i + 1] - bgG, db = d[i + 2] - bgB;
    if (dr * dr + dg * dg + db * db <= TOL_SQ) { visited[idx] = 1; queue.push(idx); }
  }

  for (let x = 0; x < w; x++) { tryEnqueue(x); tryEnqueue((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { tryEnqueue(y * w); tryEnqueue(y * w + w - 1); }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    d[idx * 4 + 3] = 0;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0)     tryEnqueue(idx - 1);
    if (x < w - 1) tryEnqueue(idx + 1);
    if (y > 0)     tryEnqueue(idx - w);
    if (y < h - 1) tryEnqueue(idx + w);
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<string>((resolve) => {
    canvas.toBlob((b) => { resolve(b ? URL.createObjectURL(b) : srcUrl); }, "image/png");
  });
}

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [zones, setZones] = useState<PrintZone[]>([]);
  const [title, setTitle] = useState("");

  const [techniques, setTechniques] = useState<string[]>([...PRINT_TECHNIQUES]);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft>(EMPTY_DRAFT);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [viewedSide, setViewedSide] = useState<"front" | "back">("front");
  const [manualBackImageUrl, setManualBackImageUrl] = useState("");

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

  // Mirror viewer's side detection: name-based first, imageUrl fallback for unnamed zones.
  const backSideImageUrl = useMemo(() => {
    if (!product) return null;
    const namedBack = zones.find((z) => z.name.trim().toLowerCase() === "back");
    if (namedBack?.imageUrl) return namedBack.imageUrl;
    for (const z of zones) {
      if (z.imageUrl && z.imageUrl !== product.imageUrl) return z.imageUrl;
    }
    return null;
  }, [zones, product]);

  function isBackZone(z: PrintZone): boolean {
    if (/back/i.test(z.name)) return true;
    if (/front/i.test(z.name)) return false;
    return backSideImageUrl !== null && !!z.imageUrl && z.imageUrl === backSideImageUrl;
  }

  const effectiveBackImageUrl = backSideImageUrl ?? (manualBackImageUrl || null);

  const currentSideImageUrl = viewedSide === "back" && effectiveBackImageUrl
    ? effectiveBackImageUrl
    : (product?.imageUrl ?? "");

  const sideZones = useMemo(() => {
    if (!product) return zones;
    if (viewedSide === "front") return zones.filter((z) => !isBackZone(z));
    const backUrl = effectiveBackImageUrl;
    if (!backUrl) return [];
    return zones.filter((z) => isBackZone(z));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, product, viewedSide, effectiveBackImageUrl, backSideImageUrl]);

  const [productImage] = useImage(currentSideImageUrl);
  const [bumArtikelImage] = useImage(editingZoneId ? (zoneDraft.bumArtikelUrl ?? "") : "");
  const [uploadingBumArtikel, setUploadingBumArtikel] = useState(false);
  const [removingBumArtikelBg, setRemovingBumArtikelBg] = useState(false);
  const [processedBumArtikelImage, setProcessedBumArtikelImage] = useState<HTMLImageElement | null>(null);

  const transformerRef = useRef<Konva.Transformer | null>(null);
  const bumArtikelTransformerRef = useRef<Konva.Transformer | null>(null);
  const bumArtikelNodeRef = useRef<Konva.Image | null>(null);
  const zoneRectRefs = useRef<Record<string, Konva.Rect | null>>({});

  const canvasScale = useMemo(() => {
    if (!product || product.imageWidth <= 0) return 1;
    return Math.min(1, MAX_CANVAS_WIDTH / product.imageWidth);
  }, [product]);

  // Mirrors right arm zones to the correct visual side, matching viewer behaviour.
  function displayXForZone(zone: { name: string; x: number; width: number }): number {
    const isRightArm = /right/i.test(zone.name);
    return isRightArm && product ? product.imageWidth - zone.x - zone.width : zone.x;
  }

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
      for (const technique of zone.allowedTechniques) {
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

  useEffect(() => {
    const tr = bumArtikelTransformerRef.current;
    if (!tr) return;
    if (editingZoneId && bumArtikelImage && bumArtikelNodeRef.current) {
      tr.nodes([bumArtikelNodeRef.current]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [editingZoneId, bumArtikelImage]);

  // ─── Process bum-artikel colour count for canvas preview ──────────────────
  useEffect(() => {
    let cancelled = false;
    const count = zoneDraft.bumArtikelColorCount ?? 0;
    if (!bumArtikelImage || count === 0) {
      setProcessedBumArtikelImage(null);
      return;
    }
    processImageForColors(bumArtikelImage.src, count)
      .then((img) => { if (!cancelled) setProcessedBumArtikelImage(img); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumArtikelImage, zoneDraft.bumArtikelColorCount]);

  // ─── Apply technique filter to bum-artikel node for canvas preview ────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const node = bumArtikelNodeRef.current;
      if (!node || !bumArtikelImage) return;
      const cfg = getTechniqueFilterConfig(zoneDraft.bumArtikelTechnique);
      const attrs: Record<string, unknown> = { filters: cfg.filters };
      if (cfg.blurRadius !== undefined) attrs.blurRadius = cfg.blurRadius;
      if (cfg.noise      !== undefined) attrs.noise      = cfg.noise;
      if (cfg.enhance    !== undefined) attrs.enhance    = cfg.enhance;
      if (cfg.levels     !== undefined) attrs.levels     = cfg.levels;
      node.setAttrs(attrs);
      if (cfg.filters.length > 0) { node.cache(); } else { node.clearCache(); }
      node.getLayer()?.batchDraw();
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneDraft.bumArtikelTechnique, processedBumArtikelImage, bumArtikelImage]);

  function resetZoneDraft() {
    setEditingZoneId(null);
    setSelectedZoneId(null);
    setZoneDraft(EMPTY_DRAFT);
  }

  function fitLogoToZone(imgWidth: number, imgHeight: number, zone: ZoneDraft) {
    const fitScale = Math.min(zone.width / imgWidth, zone.height / imgHeight);
    const w = Math.round(imgWidth * fitScale);
    const h = Math.round(imgHeight * fitScale);
    return {
      bumArtikelX: Math.round(zone.x + (zone.width - w) / 2),
      bumArtikelY: Math.round(zone.y + (zone.height - h) / 2),
      bumArtikelWidth: w,
      bumArtikelHeight: h,
    };
  }

  async function handleBumArtikelUpload(file: File) {
    if (uploadingBumArtikel) return;
    setUploadingBumArtikel(true);
    setErrors([]);
    try {
      const result = await uploadBumArtikel(file);
      const img = new Image();
      img.onload = () => {
        const fit = fitLogoToZone(img.naturalWidth, img.naturalHeight, zoneDraft);
        setZoneDraft((prev) => ({
          ...prev,
          bumArtikelUrl: result.logoUrl,
          bumArtikelFileId: result.logoId,
          ...fit,
        }));
      };
      img.src = result.logoUrl;
    } catch (error) {
      setErrors(["Kunne ikke uploade bum-artikel. Prøv igen."]);
    } finally {
      setUploadingBumArtikel(false);
    }
  }

  function handleRemoveBumArtikel() {
    setZoneDraft((prev) => ({
      ...prev,
      bumArtikelUrl: undefined,
      bumArtikelFileId: undefined,
      bumArtikelX: undefined,
      bumArtikelY: undefined,
      bumArtikelWidth: undefined,
      bumArtikelHeight: undefined,
    }));
  }

  async function handleRemoveBumArtikelBg() {
    if (!zoneDraft.bumArtikelUrl || removingBumArtikelBg) return;
    setRemovingBumArtikelBg(true);
    setErrors([]);
    try {
      const processedBlobUrl = await removeBackground(zoneDraft.bumArtikelUrl);
      // Re-upload so the stored URL is persistent (blob URLs vanish on refresh)
      const blob = await fetch(processedBlobUrl).then((r) => r.blob());
      URL.revokeObjectURL(processedBlobUrl);
      const file = new File([blob], "bum-artikel-no-bg.png", { type: "image/png" });
      const result = await uploadBumArtikel(file);
      setZoneDraft((prev) => ({
        ...prev,
        bumArtikelUrl: result.logoUrl,
        bumArtikelFileId: result.logoId,
      }));
    } catch {
      setErrors(["Kunne ikke fjerne baggrund. Prøv igen."]);
    } finally {
      setRemovingBumArtikelBg(false);
    }
  }

  function handleZoneSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    const zoneErrors = validateZone(zoneDraft, product.imageWidth, product.imageHeight);
    if (zoneErrors.length > 0) {
      setErrors(zoneErrors);
      return;
    }

    const preservedImageUrl = editingZoneId
      ? (zones.find((z) => z.id === editingZoneId)?.imageUrl || currentSideImageUrl)
      : currentSideImageUrl;

    const nextZone: PrintZone = toZone(
      {
        ...zoneDraft,
        id: editingZoneId ?? `temp-${Date.now()}`,
      },
      preservedImageUrl
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

  function handleSideSwitch(side: "front" | "back") {
    if (editingZoneId) resetZoneDraft();
    setSelectedZoneId(null);
    setViewedSide(side);
  }

  function handleZoneEdit(zone: PrintZone) {
    setViewedSide(isBackZone(zone) ? "back" : "front");
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
      setSuccessMessage("Ændringer gemt");
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Canvas</CardTitle>
              <CardDescription>
                Klik og træk på billedet for at tegne en ny zone. Klik på en eksisterende zone for at vælge den, og tryk "Rediger zone" for at flytte/resize den.
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex rounded-md border border-border overflow-hidden text-sm font-medium">
                <button
                  type="button"
                  onClick={() => handleSideSwitch("front")}
                  className={`px-4 py-1.5 transition-colors ${viewedSide === "front" ? "bg-primary text-white" : "bg-background hover:bg-muted"}`}
                >
                  Forside
                </button>
                <button
                  type="button"
                  onClick={() => handleSideSwitch("back")}
                  className={`px-4 py-1.5 transition-colors border-l border-border ${viewedSide === "back" ? "bg-primary text-white" : "bg-background hover:bg-muted"}`}
                >
                  Bagside
                </button>
              </div>
              {viewedSide === "back" && !backSideImageUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Bagside billed-URL:</span>
                  <input
                    type="text"
                    value={manualBackImageUrl}
                    onChange={(e) => setManualBackImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="text-xs border border-input rounded px-2 py-1 w-64 bg-background"
                  />
                </div>
              )}
            </div>
          </div>
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
                  imageUrl: currentSideImageUrl,
                };
                setZones((prev) => [...prev, newZone]);
                setSelectedZoneId(newZone.id);
                handleZoneEdit(newZone);
              }}
            >
              <Layer>
                {productImage && <KonvaImage image={productImage} width={canvasWidth} height={canvasHeight} listening={false} />}

                {sideZones.map((zone) => {
                  const isSelected = zone.id === selectedZoneId;
                  const isEditing = zone.id === editingZoneId;
                  return (
                    <Rect
                      key={zone.id}
                      ref={(node) => {
                        zoneRectRefs.current[zone.id] = node;
                      }}
                      x={displayXForZone(zone) * canvasScale}
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
                        const isRightArm = /right/i.test(zone.name);
                        const displayX = event.target.x() / canvasScale;
                        const rawX = isRightArm && product
                          ? product.imageWidth - displayX - zone.width
                          : displayX;
                        const next = clampRectToImage(rawX, event.target.y() / canvasScale, zone.width, zone.height);
                        updateZoneGeometry(zone.id, next);
                      }}
                      onTransformEnd={(event) => {
                        const node = event.target as Konva.Rect;
                        const nextWidth  = (node.width()  * node.scaleX()) / canvasScale;
                        const nextHeight = (node.height() * node.scaleY()) / canvasScale;
                        const isRightArm = /right/i.test(zone.name);
                        const displayX = node.x() / canvasScale;
                        const rawX = isRightArm && product
                          ? product.imageWidth - displayX - nextWidth
                          : displayX;
                        node.scaleX(1);
                        node.scaleY(1);
                        const next = clampRectToImage(rawX, node.y() / canvasScale, nextWidth, nextHeight);
                        updateZoneGeometry(zone.id, next);
                      }}
                    />
                  );
                })}

                {sideZones.map((zone) => (
                  <Text
                    key={`${zone.id}-label`}
                    x={displayXForZone(zone) * canvasScale + 4}
                    y={zone.y * canvasScale + 4}
                    text={(zone.name || "(uden navn)") + (zone.bumArtikelUrl ? " 🔒" : "")}
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

                {/* Bum-artikel — draggable/resizable when editing that zone */}
                {editingZoneId && bumArtikelImage && zoneDraft.bumArtikelX != null && (
                  <KonvaImage
                    ref={bumArtikelNodeRef}
                    image={processedBumArtikelImage ?? bumArtikelImage}
                    x={displayXForZone({ name: zoneDraft.name, x: zoneDraft.bumArtikelX ?? 0, width: zoneDraft.bumArtikelWidth ?? 0 }) * canvasScale}
                    y={(zoneDraft.bumArtikelY ?? 0) * canvasScale}
                    width={(zoneDraft.bumArtikelWidth ?? 0) * canvasScale}
                    height={(zoneDraft.bumArtikelHeight ?? 0) * canvasScale}
                    draggable
                    dragBoundFunc={(pos) => {
                      const isRightArm = /right/i.test(zoneDraft.name);
                      const dispZoneX = isRightArm && product
                        ? product.imageWidth - zoneDraft.x - zoneDraft.width
                        : zoneDraft.x;
                      const w = (zoneDraft.bumArtikelWidth ?? 0) * canvasScale;
                      const h = (zoneDraft.bumArtikelHeight ?? 0) * canvasScale;
                      return {
                        x: Math.max(dispZoneX * canvasScale, Math.min(pos.x, (dispZoneX + zoneDraft.width) * canvasScale - w)),
                        y: Math.max(zoneDraft.y * canvasScale, Math.min(pos.y, (zoneDraft.y + zoneDraft.height) * canvasScale - h)),
                      };
                    }}
                    onDragEnd={(e) => {
                      const isRightArm = /right/i.test(zoneDraft.name);
                      const displayX = e.target.x() / canvasScale;
                      const rawX = isRightArm && product
                        ? product.imageWidth - displayX - (zoneDraft.bumArtikelWidth ?? 0)
                        : displayX;
                      setZoneDraft((prev) => ({
                        ...prev,
                        bumArtikelX: Math.round(rawX),
                        bumArtikelY: Math.round(e.target.y() / canvasScale),
                      }));
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target as Konva.Image;
                      const newW = Math.max(10, Math.round((node.width() * node.scaleX()) / canvasScale));
                      const newH = Math.max(10, Math.round((node.height() * node.scaleY()) / canvasScale));
                      node.scaleX(1); node.scaleY(1);
                      node.width(newW * canvasScale);
                      node.height(newH * canvasScale);
                      // Technique filter uses node.cache() — regenerate at new dimensions immediately.
                      if (node.isCached()) node.cache();
                      const isRightArm = /right/i.test(zoneDraft.name);
                      const displayX = node.x() / canvasScale;
                      const rawX = isRightArm && product
                        ? product.imageWidth - displayX - newW
                        : displayX;
                      setZoneDraft((prev) => ({
                        ...prev,
                        bumArtikelX: Math.round(rawX),
                        bumArtikelY: Math.round(node.y() / canvasScale),
                        bumArtikelWidth: newW,
                        bumArtikelHeight: newH,
                      }));
                    }}
                  />
                )}

                <Transformer
                  ref={bumArtikelTransformerRef}
                  keepRatio
                  rotateEnabled={false}
                  enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                  borderStroke="#f59e0b"
                  borderStrokeWidth={1.5}
                  anchorFill="#ffffff"
                  anchorStroke="#f59e0b"
                  anchorStrokeWidth={1.5}
                  anchorSize={8}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 10 || newBox.height < 10) return oldBox;
                    const z = zoneDraft;
                    const isRightArm = /right/i.test(z.name);
                    const dispZoneX = isRightArm && product
                      ? product.imageWidth - z.x - z.width
                      : z.x;
                    if (newBox.x < dispZoneX * canvasScale || newBox.y < z.y * canvasScale) return oldBox;
                    if (newBox.x + newBox.width > (dispZoneX + z.width) * canvasScale) return oldBox;
                    if (newBox.y + newBox.height > (z.y + z.height) * canvasScale) return oldBox;
                    return newBox;
                  }}
                />

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

                {/* Bum-artikel */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Bum-artikel
                  </Label>
                  {zoneDraft.bumArtikelUrl ? (
                    <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="h-10 w-10 shrink-0 rounded border border-amber-200 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:8px_8px] flex items-center justify-center overflow-hidden">
                        {removingBumArtikelBg
                          ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                          : <img src={zoneDraft.bumArtikelUrl} alt="Bum-artikel" className="max-h-full max-w-full object-contain" />
                        }
                      </div>
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <span className="text-xs text-amber-800">
                          Logo sat — træk og resize på canvas for at justere position.
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleRemoveBumArtikelBg()}
                          disabled={removingBumArtikelBg}
                          className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-default w-fit"
                        >
                          {removingBumArtikelBg
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Wand2 className="h-3 w-3" />
                          }
                          {removingBumArtikelBg ? "Fjerner baggrund…" : "Fjern baggrund"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveBumArtikel}
                        disabled={removingBumArtikelBg}
                        className="text-amber-700 hover:text-red-600 disabled:opacity-40"
                        aria-label="Fjern bum-artikel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Technique for bum-artikel */}
                    <div className="space-y-1">
                      <Label className="text-xs">Print-teknik for bum-artikel</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["", ...zoneDraft.allowedTechniques].map((t) => (
                          <button
                            key={t || "_none"}
                            type="button"
                            onClick={() => setZoneDraft((prev) => ({ ...prev, bumArtikelTechnique: t || undefined }))}
                            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                              (zoneDraft.bumArtikelTechnique ?? "") === t
                                ? "bg-amber-500 text-white border-amber-500 font-medium"
                                : "bg-background border-input hover:bg-muted"
                            }`}
                          >
                            {t || "Ingen"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Colour count for bum-artikel */}
                    <div className="flex items-center gap-3">
                      <Label className="text-xs shrink-0">Farver (0 = fuld)</Label>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={zoneDraft.bumArtikelColorCount ?? 0}
                        onChange={(e) => setZoneDraft((prev) => ({ ...prev, bumArtikelColorCount: Number(e.target.value) }))}
                        className="w-16 h-7 text-xs border border-input rounded px-2"
                      />
                    </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        id="bum-artikel-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleBumArtikelUpload(file);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingBumArtikel}
                        onClick={() => document.getElementById("bum-artikel-upload")?.click()}
                        className="gap-2"
                      >
                        {uploadingBumArtikel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload bum-artikel
                      </Button>
                    </div>
                  )}
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

            {zones.map((zone) => {
              const isBack = isBackZone(zone);
              return (
              <div
                key={zone.id}
                className={`rounded-md border p-3 space-y-1.5 transition-colors ${zone.id === editingZoneId ? "border-blue-300 bg-blue-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate">{zone.name || <span className="text-muted-foreground italic">(uden navn)</span>}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${isBack ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>
                      {isBack ? "Bagside" : "Forside"}
                    </span>
                  </div>
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
                <p className="text-xs text-muted-foreground">Teknikker: {zone.allowedTechniques.join(", ") || "Ingen"}</p>
                {zone.bumArtikelUrl && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Bum-artikel sat
                  </p>
                )}
              </div>
              );
            })}
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
