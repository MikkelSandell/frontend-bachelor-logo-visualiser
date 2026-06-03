import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import type { Product, PrintZone } from "@logo-visualizer/shared";
import type { LogoEntry, TextEntry } from "../../types";
import { requestExportPdf, requestExportPng } from "../../api/viewerApi";
import type { ExportPageRequest } from "../../api/viewerApi";
import { cn } from "../../lib/utils";
import { getTechniqueFilterConfig } from "../../lib/techniqueFilters";

export interface ProductCanvasHandle {
  exportPng: () => void;
  exportPdf: () => void;
}

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

type Side = "front" | "back";

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
      // Strip absolute localhost origin so the request goes through the Vite proxy.
      // Without this the canvas is tainted by cross-origin data and node.cache()
      // (used by technique filters) throws a getImageData security error.
      img.src = url.replace(/^https?:\/\/localhost:\d+/, "");
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
  zoneTechniqueAssignments: Record<string, string>;
  zoneColorAssignments: Record<string, number>;
  activeZoneIds: string[];
  focusedZoneId: string | null;
  viewedZoneId: string | null;
  onFocusZone: (zoneId: string) => void;
  onActivateZone?: (zoneId: string) => void;
  onDeactivateZone?: (zoneId: string) => void;
  onProductLoaded: (product: Product) => void;
}

/**
 * Recolour a logo to simulate N-colour printing.
 * Fetches the image via the Vite proxy (relative URL) so the canvas is never
 * tainted by cross-origin data, then manipulates pixels directly.
 */
async function processImageForColors(
  srcUrl: string,
  colorCount: number,
  maxColors: number,
): Promise<HTMLImageElement> {
  // Strip the absolute origin so the request goes through the Vite proxy.
  const proxyUrl = srcUrl.replace(/^https?:\/\/localhost:\d+/, "");

  const blob = await fetch(proxyUrl).then((r) => r.blob());
  const blobUrl = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = blobUrl;
  });

  URL.revokeObjectURL(blobUrl);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return img;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  if (colorCount === 1) {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
    }
  } else if (colorCount === 2) {
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = g; d[i + 1] = g; d[i + 2] = g;
    }
  } else {
    const levels = Math.max(2, Math.round((colorCount / maxColors) * 8));
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.round(Math.round(d[i]     / step) * step);
      d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
      d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<HTMLImageElement>((resolve) => {
    const out = new Image();
    out.onload = () => resolve(out);
    out.src = canvas.toDataURL();
  });
}

export const ProductCanvas = forwardRef<ProductCanvasHandle, Props>(function ProductCanvas({
  product, logos, zoneLogoAssignments,
  texts, zoneTextAssignments, zoneTechniqueAssignments, zoneColorAssignments,
  activeZoneIds, focusedZoneId, viewedZoneId,
  onFocusZone, onActivateZone, onDeactivateZone, onProductLoaded,
}: Props, ref) {

  function effectiveImageUrl(zone: PrintZone): string {
    const isArm = /\barm\b/i.test(zone.name);
    return isArm ? product.imageUrl : (zone.imageUrl || product.imageUrl);
  }

  const isFrontExact = (z: PrintZone) => z.name.trim().toLowerCase() === "front";
  const isBackExact = (z: PrintZone) => z.name.trim().toLowerCase() === "back";
  const isFrontLoose = (z: PrintZone) => /front/i.test(z.name);
  const isBackLoose = (z: PrintZone) => /back/i.test(z.name);

  function displayXForZone(zone: PrintZone): number {
    const isRightArm = /right/i.test(zone.name);
    return isRightArm ? product.imageWidth - zone.x - zone.width : zone.x;
  }

  // When zone names don't contain "front"/"back", use imageUrl to determine the side.
  // The first zone imageUrl that differs from product.imageUrl is the "back" side.
  const backSideImageUrl: string | null = (() => {
    const namedBack = product.printZones.find(isBackExact);
    if (namedBack?.imageUrl) return namedBack.imageUrl;
    for (const z of product.printZones) {
      if (z.imageUrl && z.imageUrl !== product.imageUrl) return z.imageUrl;
    }
    return null;
  })();

  const isBackZone = (z: PrintZone): boolean => {
    if (isBackLoose(z)) return true;
    if (isFrontLoose(z)) return false;
    return backSideImageUrl !== null && !!z.imageUrl && z.imageUrl === backSideImageUrl;
  };

  const viewedZone = product.printZones.find((z) => z.id === viewedZoneId);
  const viewedImageUrl = viewedZone ? effectiveImageUrl(viewedZone) : product.imageUrl;
  const viewedIsBack = viewedZone ? isBackZone(viewedZone) : false;

  const allSideZones = product.printZones.filter((z) => isBackZone(z) === viewedIsBack);
  const visibleZones = allSideZones.filter((z) => activeZoneIds.includes(z.id));

  const [productImage] = useImage(viewedImageUrl);

  // Build URL map for bum-artikler — all zones on the current side that have one
  const bumArtikelUrlMap: Record<string, string> = {};
  for (const zone of allSideZones) {
    if (zone.bumArtikelUrl) bumArtikelUrlMap[zone.id] = zone.bumArtikelUrl;
  }
  const bumArtikelImages = useMultipleImages(bumArtikelUrlMap);

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
  const [processedLogoImages, setProcessedLogoImages] = useState<Record<string, HTMLImageElement | undefined>>({});
  const [processedBumArtikelImages, setProcessedBumArtikelImages] = useState<Record<string, HTMLImageElement | undefined>>({});
  const [textStates, setTextStates] = useState<Record<string, TextState>>({});
  // Which canvas element (logo or text) is currently selected for the Transformer
  const [focusedElement, setFocusedElement] = useState<FocusedElement>(null);
  const [, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [canvasCursor, setCanvasCursor] = useState<"default" | "pointer" | "move" | "nwse-resize">("default");
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Image | null>>({});
  const bumArtikelNodeRefs = useRef<Record<string, Konva.Image | null>>({});
  const textNodeRefs = useRef<Record<string, Konva.Text | null>>({});
  const processedImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

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

  // ─── Re-process logo images when colour count changes ────────────────────

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const entries = Object.entries(logoImages).filter(
        (entry): entry is [string, HTMLImageElement] => !!entry[1]
      );

      if (entries.length === 0) {
        if (!cancelled) setProcessedLogoImages({});
        return;
      }

      const processed = await Promise.all(
        entries.map(async ([zoneId, img]) => {
          const colorCount = zoneColorAssignments[zoneId];
          const zone = product.printZones.find((z) => z.id === zoneId);
          const maxColors = zone?.maxColors ?? 0;

          if (!colorCount || maxColors === 0 || colorCount >= maxColors) {
            return [zoneId, img] as const;
          }

          const cacheKey = `${img.src}:${colorCount}:${maxColors}`;
          const cached = processedImageCache.current.get(cacheKey);
          if (cached) return [zoneId, cached] as const;

          const result = await processImageForColors(img.src, colorCount, maxColors);
          processedImageCache.current.set(cacheKey, result);
          return [zoneId, result] as const;
        })
      );

      if (!cancelled) setProcessedLogoImages(Object.fromEntries(processed));
    }

    // Failures are non-fatal: the canvas already falls back to the original via ?? img.
    run().catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoImages, zoneColorAssignments]);

  // ─── Apply technique filter effects to logo nodes ─────────────────────────
  // Runs after every image or technique change. Uses rAF so react-konva has
  // committed the latest `image` prop before we call cache().

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      for (const [zoneId, node] of Object.entries(nodeRefs.current)) {
        if (!node) continue;
        const hasImage = !!(processedLogoImages[zoneId] ?? logoImages[zoneId]);
        if (!hasImage) continue;

        // Fall back to the zone's first allowed technique for canvas preview so the
        // visual effect matches the TechniqueSelector's visual default from the start.
        // The export payload still only sends selectedTechniqueName when explicitly chosen.
        const zone = product.printZones.find((z) => z.id === zoneId);
        const technique = zoneTechniqueAssignments[zoneId] ?? zone?.allowedTechniques[0];
        const cfg = getTechniqueFilterConfig(technique);

        const attrs: Record<string, unknown> = { filters: cfg.filters };
        if (cfg.blurRadius !== undefined) attrs.blurRadius = cfg.blurRadius;
        if (cfg.noise     !== undefined) attrs.noise      = cfg.noise;
        if (cfg.enhance   !== undefined) attrs.enhance    = cfg.enhance;
        if (cfg.levels    !== undefined) attrs.levels     = cfg.levels;

        node.setAttrs(attrs);

        if (cfg.filters.length > 0) {
          node.cache();
        } else {
          node.clearCache();
        }
      }
      stageRef.current?.batchDraw();
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneTechniqueAssignments, processedLogoImages, logoImages]);

  // ─── Process bum-artikel colour count (admin-set, read-only in viewer) ─────

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const entries = Object.entries(bumArtikelImages).filter(
        (entry): entry is [string, HTMLImageElement] => !!entry[1]
      );
      if (entries.length === 0) { if (!cancelled) setProcessedBumArtikelImages({}); return; }

      const processed = await Promise.all(
        entries.map(async ([zoneId, img]) => {
          const zone = product.printZones.find((z) => z.id === zoneId);
          const count = zone?.bumArtikelColorCount ?? 0;
          if (!count) return [zoneId, img] as const;

          const cacheKey = `bumArtikel:${img.src}:${count}`;
          const cached = processedImageCache.current.get(cacheKey);
          if (cached) return [zoneId, cached] as const;

          const result = await processImageForColors(img.src, count, Math.max(count + 1, 8));
          processedImageCache.current.set(cacheKey, result);
          return [zoneId, result] as const;
        })
      );
      if (!cancelled) setProcessedBumArtikelImages(Object.fromEntries(processed));
    }
    run().catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumArtikelImages]);

  // ─── Apply technique filter to bum-artikel nodes (admin-set, read-only) ───

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      for (const [zoneId, node] of Object.entries(bumArtikelNodeRefs.current)) {
        if (!node) continue;
        if (!(processedBumArtikelImages[zoneId] ?? bumArtikelImages[zoneId])) continue;
        const zone = product.printZones.find((z) => z.id === zoneId);
        const cfg = getTechniqueFilterConfig(zone?.bumArtikelTechnique);
        const attrs: Record<string, unknown> = { filters: cfg.filters };
        if (cfg.blurRadius !== undefined) attrs.blurRadius = cfg.blurRadius;
        if (cfg.noise      !== undefined) attrs.noise      = cfg.noise;
        if (cfg.enhance    !== undefined) attrs.enhance    = cfg.enhance;
        if (cfg.levels     !== undefined) attrs.levels     = cfg.levels;
        node.setAttrs(attrs);
        if (cfg.filters.length > 0) { node.cache(); } else { node.clearCache(); }
      }
      stageRef.current?.batchDraw();
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedBumArtikelImages, bumArtikelImages]);

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
        next[zoneId] = fitLogoToZone(zone, img);
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

  // ─── Sync element focus when the focused zone changes ────────────────────
  // Handles both canvas zone-rect clicks AND ZoneSelector clicks (external).
  const prevFocusedZoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (focusedZoneId === prevFocusedZoneRef.current) return;
    prevFocusedZoneRef.current = focusedZoneId;
    setFocusedElement(
      focusedZoneId && zoneLogoAssignments[focusedZoneId]
        ? { zoneId: focusedZoneId, type: "logo" }
        : null
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedZoneId]);

  function clampToZone(lx: number, ly: number, lw: number, lh: number, zone: PrintZone) {
    const zoneDispX = displayXForZone(zone);
    return {
      x: Math.max(zoneDispX * scale, Math.min(lx, (zoneDispX + zone.width)  * scale - lw)),
      y: Math.max(zone.y    * scale, Math.min(ly, (zone.y     + zone.height) * scale - lh)),
    };
  }

  function fitLogoToZone(zone: PrintZone, image: HTMLImageElement): LogoState {
    const zoneDispX = displayXForZone(zone);
    const zoneW = zone.width * scale;
    const zoneH = zone.height * scale;

    // Match backend fit rule: preserve ratio and fit entirely inside the zone.
    const srcW = Math.max(1, image.width);
    const srcH = Math.max(1, image.height);
    const fitScale = Math.min(zoneW / srcW, zoneH / srcH);
    const logoW = srcW * fitScale;
    const logoH = srcH * fitScale;

    return {
      x: zoneDispX * scale + (zoneW - logoW) / 2,
      y: zone.y * scale + (zoneH - logoH) / 2,
      width: logoW,
      height: logoH,
    };
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  function initializeDefaultLogoState(zone: PrintZone, image: HTMLImageElement): LogoState {
    return fitLogoToZone(zone, image);
  }

  function initializeDefaultTextState(zone: PrintZone): TextState {
    const dispX = displayXForZone(zone);
    return {
      x: dispX * scale + zone.width * scale * 0.08,
      y: zone.y * scale + zone.height * scale * 0.15,
      fontSize: 24,
      color: "#000000",
    };
  }

  function findSideAnchor(side: Side): PrintZone | null {
    if (side === "front") {
      return product.printZones.find(isFrontExact)
        ?? product.printZones.find(isFrontLoose)
        ?? product.printZones.find((z) => !isBackZone(z))
        ?? null;
    }

    return product.printZones.find(isBackExact)
      ?? product.printZones.find(isBackLoose)
      ?? null;
  }

  function sideZones(side: Side): PrintZone[] {
    return product.printZones.filter((z) => (side === "back" ? isBackZone(z) : !isBackZone(z)));
  }

  function buildExportPayloadForZones(
    zones: PrintZone[],
    backgroundImageUrl: string,
    currentLogoStates: Record<string, LogoState>,
    currentTextStates: Record<string, TextState>
  ): ExportPageRequest {
    const exportZoneSet = new Set(zones.map((z) => z.id));
    const exportZones = zones.filter((z) => activeZoneIds.includes(z.id));

    // Bum-artikler are composited first (bottom layer) so the customer logo renders on top.
    // Use all side zones (not just active ones) — bum-artikler are always visible on the canvas
    // regardless of whether the user has activated the zone.
    const bumArtikelPlacements = zones.flatMap((zone) => {
      if (!zone.bumArtikelFileId || zone.bumArtikelX == null) return [];
      const bumColorCount = zone.bumArtikelColorCount ?? 0;
      const bumArtikelWidth = zone.bumArtikelWidth ?? 0;
      const isRightArm = /right/i.test(zone.name);
      // Admin stores raw coordinates; viewer mirrors right arm for display.
      // Apply the same mirror here so the export matches the canvas preview.
      const exportBumArtikelX = isRightArm
        ? product.imageWidth - (zone.bumArtikelX) - bumArtikelWidth
        : zone.bumArtikelX;
      return [{
        zoneId: zone.id,
        logoId: zone.bumArtikelFileId,
        logoX: exportBumArtikelX,
        logoY: zone.bumArtikelY ?? 0,
        logoWidth: bumArtikelWidth,
        logoHeight: zone.bumArtikelHeight ?? 0,
        ...(zone.bumArtikelTechnique ? { selectedTechniqueName: zone.bumArtikelTechnique } : {}),
        colorCount: bumColorCount,
        maxColors: Math.max(bumColorCount + 1, 8),
      }];
    });

    const logoPlacements = exportZones.flatMap((zone) => {
      const state = currentLogoStates[zone.id];
      const logoId = zoneLogoAssignments[zone.id];
      if (!state || !logoId) return [];
      // Only send a technique when the user explicitly chose one — do not fall back to
      // allowedTechniques[0], which would apply effects the canvas is not showing.
      const selectedTechniqueName = zoneTechniqueAssignments[zone.id];
      const colorCount = zoneColorAssignments[zone.id] ?? 0;
      const maxColors = zone.maxColors ?? 0;

      const logoWidthPx  = Math.round(state.width  / scale);
      const logoHeightPx = Math.round(state.height / scale);
      // state.x is already in display/canvas coordinates which include the right-arm
      // mirror. Use it directly so the export matches what the user sees in the canvas.
      const logoX = Math.round(state.x / scale);

      return [{
        zoneId: zone.id,
        logoId,
        logoX,
        logoY: Math.round(state.y / scale),
        logoWidth: logoWidthPx,
        logoHeight: logoHeightPx,
        ...(selectedTechniqueName ? { selectedTechniqueName } : {}),
        colorCount,
        maxColors,
      }];
    });

    const textPlacements = exportZones.flatMap((zone) => {
      const state = currentTextStates[zone.id];
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

    return {
      productId: product.id,
      backgroundImageUrl,
      placements: [
        ...bumArtikelPlacements.filter((p) => exportZoneSet.has(p.zoneId)),
        ...logoPlacements.filter((p) => exportZoneSet.has(p.zoneId)),
      ],
      textPlacements: textPlacements.filter((p) => exportZoneSet.has(p.zoneId)),
    };
  }

  async function ensureExportStatesForZones(zones: PrintZone[]) {
    const neededZones = zones.filter((z) => activeZoneIds.includes(z.id));
    const nextLogoStates: Record<string, LogoState> = { ...logoStates };
    const nextTextStates: Record<string, TextState> = { ...textStates };

    for (const zone of neededZones) {
      const logoId = zoneLogoAssignments[zone.id];
      if (logoId && !nextLogoStates[zone.id]) {
        const existingImage = logoImages[zone.id];
        let imageForPlacement = existingImage;

        if (!imageForPlacement) {
          const logo = logos.find((l) => l.id === logoId);
          if (logo) {
            imageForPlacement = await new Promise<HTMLImageElement | undefined>((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => resolve(undefined);
              img.src = logo.url;
            });
          }
        }

        if (imageForPlacement) {
          nextLogoStates[zone.id] = initializeDefaultLogoState(zone, imageForPlacement);
        }
      }

      const textId = zoneTextAssignments[zone.id];
      if (textId && !nextTextStates[zone.id]) {
        nextTextStates[zone.id] = initializeDefaultTextState(zone);
      }
    }

    if (Object.keys(nextLogoStates).length !== Object.keys(logoStates).length) {
      setLogoStates(nextLogoStates);
    }
    if (Object.keys(nextTextStates).length !== Object.keys(textStates).length) {
      setTextStates(nextTextStates);
    }

    return { nextLogoStates, nextTextStates };
  }

  async function handleExportPng() {
    setErrorMessages([]);
    setExportSuccess(null);

    // Ensure logo/text states are initialized (image may not have loaded yet) — same
    // pattern as handleExportPdf. Without this, buildExportPayloadForZones returns
    // empty placements when the logo was just assigned and hasn't rendered yet.
    const { nextLogoStates, nextTextStates } = await ensureExportStatesForZones(visibleZones);
    // Use allSideZones (not just visibleZones) so bum-artikler from all zones on this
    // side are included regardless of whether the zone is active.
    // User logos and text are still filtered to active zones inside the function.
    const payload = buildExportPayloadForZones(allSideZones, viewedImageUrl, nextLogoStates, nextTextStates);

    if (payload.placements.length === 0 && payload.textPlacements.length === 0) {
      setErrorMessages(["Ingen logoer eller tekster er placeret på den nuværende side."]);
      return;
    }

    setExporting(true);
    try {
      const blob = await requestExportPng(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "logo-visualisering.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportSuccess("Download startet");
    } catch (error) {
      console.error("PNG eksport fejl:", error);
      if (typeof error === "object" && error !== null) {
        const maybe = error as {
          response?: { data?: { messages?: string[]; message?: string } };
          message?: string;
        };
        const backendMessages = maybe.response?.data?.messages;
        if (Array.isArray(backendMessages) && backendMessages.length > 0) {
          setErrorMessages(backendMessages);
        } else if (maybe.response?.data?.message) {
          setErrorMessages([maybe.response.data.message]);
        } else if (maybe.message) {
          setErrorMessages([maybe.message]);
        } else {
          setErrorMessages(["Kunne ikke eksportere PNG fra backend."]);
        }
      } else {
        setErrorMessages(["Kunne ikke eksportere PNG fra backend."]);
      }
    } finally {
      setExporting(false);
      setCanvasCursor("default");
    }
  }

  async function handleExportPdf() {
    setErrorMessages([]);
    setExportSuccess(null);

    setExporting(true);
    try {
      const frontAnchor = findSideAnchor("front");
      const backAnchor = findSideAnchor("back");

      const frontZones = frontAnchor ? sideZones("front") : [];
      const backZones = backAnchor ? sideZones("back") : [];

      const exportZones = [...frontZones, ...backZones];
      const { nextLogoStates, nextTextStates } = await ensureExportStatesForZones(exportZones);

      const pages: ExportPageRequest[] = [];

      if (frontAnchor) {
        const frontBackgroundImageUrl = effectiveImageUrl(frontAnchor);
        if (frontBackgroundImageUrl) {
          pages.push(
            buildExportPayloadForZones(frontZones, frontBackgroundImageUrl, nextLogoStates, nextTextStates)
          );
        }
      }

      if (backAnchor) {
        const backBackgroundImageUrl = effectiveImageUrl(backAnchor);
        if (backBackgroundImageUrl) {
          pages.push(
            buildExportPayloadForZones(backZones, backBackgroundImageUrl, nextLogoStates, nextTextStates)
          );
        }
      }

      if (pages.length === 0) {
        setErrorMessages(["Kunne ikke oprette PDF-sider til eksport."]);
        return;
      }

      // Only include pages that have at least one placement — backend rejects empty pages
      const nonEmptyPages = pages.filter(
        (page) => page.placements.length > 0 || page.textPlacements.length > 0
      );
      if (nonEmptyPages.length === 0) {
        setErrorMessages(["Ingen logoer eller tekster er placeret på de valgte sider."]);
        return;
      }

      const blob = await requestExportPdf({ pages: nonEmptyPages });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "logo-visualisering.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportSuccess("Download startet");
    } catch (error) {
      console.error("PDF eksport fejl:", error);
      if (typeof error === "object" && error !== null) {
        const maybe = error as {
          response?: { data?: { messages?: string[]; message?: string } };
          message?: string;
        };
        const backendMessages = maybe.response?.data?.messages;
        if (Array.isArray(backendMessages) && backendMessages.length > 0) {
          setErrorMessages(backendMessages);
        } else if (maybe.response?.data?.message) {
          setErrorMessages([maybe.response.data.message]);
        } else if (maybe.message) {
          setErrorMessages([maybe.message]);
        } else {
          setErrorMessages(["Kunne ikke eksportere PDF fra backend."]);
        }
      } else {
        setErrorMessages(["Kunne ikke eksportere PDF fra backend."]);
      }
    } finally {
      setExporting(false);
      setCanvasCursor("default");
    }
  }

  // ─── Focused text state helpers ───────────────────────────────────────────

  const focusedTextZoneId =
    focusedElement?.type === "text" ? focusedElement.zoneId : null;
  const focusedTextState = focusedTextZoneId ? textStates[focusedTextZoneId] : null;

  function updateTextState(zoneId: string, patch: Partial<TextState>) {
    setTextStates((prev) => ({ ...prev, [zoneId]: { ...prev[zoneId], ...patch } }));
  }

  const focusedLogoState =
    focusedElement?.type === "logo" ? logoStates[focusedElement.zoneId] : null;

  useImperativeHandle(ref, () => ({ exportPng: handleExportPng, exportPdf: handleExportPdf }));

  return (
    <div className="space-y-3 w-full">
      {errorMessages.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 space-y-1">
          {errorMessages.map((message) => (
            <p key={message}>• {message}</p>
          ))}
        </div>
      )}

      {exportSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {exportSuccess}
        </div>
      )}

      <div className={cn("w-full overflow-auto flex justify-center", canvasCursor === "move" ? "cursor-move" : canvasCursor === "nwse-resize" ? "cursor-nwse-resize" : canvasCursor === "pointer" ? "cursor-pointer" : "cursor-default")}>
        <div className="inline-block rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setFocusedElement(null);
            }}
          >
          <Layer>
            {productImage && (
              <KonvaImage
                image={productImage}
                width={canvasWidth}
                height={canvasHeight}
                onClick={() => setFocusedElement(null)}
              />
            )}

            {/* Zone outlines */}
            {allSideZones.map((zone) => {
              const isActive  = activeZoneIds.includes(zone.id);
              const isFocused = focusedZoneId === zone.id;
              const isHovered = hoveredZoneId === zone.id;
              const dispX = displayXForZone(zone);
              return (
                <Rect
                  key={`zone-${zone.id}`}
                  x={dispX * scale}
                  y={zone.y * scale}
                  width={zone.width  * scale}
                  height={zone.height * scale}
                  stroke={isFocused ? "#d9480f" : isActive ? "#ff9966" : isHovered ? "#d9480f" : "#bbbbbb"}
                  strokeWidth={isFocused ? 3 : isHovered ? 2 : 1}
                  dash={[6, 3]}
                  fill={
                    isFocused
                      ? "rgba(255,102,51,0.11)"
                      : isHovered
                      ? "rgba(255,102,51,0.07)"
                      : isActive
                      ? "rgba(255,102,51,0.03)"
                      : "rgba(0,0,0,0.001)"
                  }
                  onMouseEnter={() => { setHoveredZoneId(zone.id); setCanvasCursor("pointer"); }}
                  onMouseLeave={() => { setHoveredZoneId(null); setCanvasCursor("default"); }}
                  onClick={() => {
                    if (!isActive) {
                      setFocusedElement(null);
                      onActivateZone?.(zone.id);
                    } else if (isFocused) {
                      setFocusedElement(null);
                      onDeactivateZone?.(zone.id);
                    } else {
                      // Switching to another active zone — the focusedZoneId effect will
                      // auto-focus its logo, but also set it immediately for instant feedback.
                      onFocusZone(zone.id);
                      setFocusedElement(
                        zoneLogoAssignments[zone.id]
                          ? { zoneId: zone.id, type: "logo" }
                          : null
                      );
                    }
                  }}
                />
              );
            })}

            {/* Zone label — only for focused zone */}
            {allSideZones.map((zone) => {
              if (focusedZoneId !== zone.id) return null;
              const dispX = displayXForZone(zone);
              return (
                <KonvaText
                  key={`zone-label-${zone.id}`}
                  x={dispX * scale + 6}
                  y={zone.y * scale + 6}
                  text={zone.name}
                  fontSize={11}
                  fill="#d9480f"
                  fontStyle="bold"
                  listening={false}
                />
              );
            })}

            {/* Bum-artikler — locked, non-interactive, always below customer logos */}
            {allSideZones.map((zone) => {
              const img = bumArtikelImages[zone.id];
              if (!img || zone.bumArtikelX == null) return null;
              const displayImg = processedBumArtikelImages[zone.id] ?? img;
              const isRightArm = /right/i.test(zone.name);
              const logoDispX = isRightArm
                ? product.imageWidth - (zone.bumArtikelX) - (zone.bumArtikelWidth ?? 0)
                : zone.bumArtikelX;
              return (
                <KonvaImage
                  key={`bum-artikel-${zone.id}`}
                  ref={(node) => { bumArtikelNodeRefs.current[zone.id] = node; }}
                  image={displayImg}
                  x={logoDispX * scale}
                  y={(zone.bumArtikelY ?? 0) * scale}
                  width={(zone.bumArtikelWidth ?? 0) * scale}
                  height={(zone.bumArtikelHeight ?? 0) * scale}
                  listening={false}
                  opacity={activeZoneIds.includes(zone.id) ? 1 : 0.55}
                />
              );
            })}

            {/* Per-zone logos */}
            {visibleZones.map((zone) => {
              const img   = logoImages[zone.id];
              const state = logoStates[zone.id];
              if (!img || !state) return null;
              const displayImg = processedLogoImages[zone.id] ?? img;
              const isLogoFocused =
                focusedElement?.zoneId === zone.id && focusedElement?.type === "logo";
              return (
                <KonvaImage
                  key={`logo-${zone.id}`}
                  ref={(node) => { nodeRefs.current[zone.id] = node; }}
                  image={displayImg}
                  x={state.x}
                  y={state.y}
                  width={state.width}
                  height={state.height}
                  draggable={isLogoFocused}
                  onClick={() => { setFocusedElement({ zoneId: zone.id, type: "logo" }); onFocusZone(zone.id); }}
                  onTap={() => { setFocusedElement({ zoneId: zone.id, type: "logo" }); onFocusZone(zone.id); }}
                  onMouseEnter={() => {
                    if (isLogoFocused) setCanvasCursor("move");
                  }}
                  onMouseLeave={() => setCanvasCursor("default")}
                  onDragStart={() => setCanvasCursor("move")}
                  dragBoundFunc={(pos) =>
                    clampToZone(pos.x, pos.y, state.width, state.height, zone)
                  }
                  onDragEnd={(e) => {
                    const { x, y } = e.target.position();
                    setLogoStates((prev) => ({ ...prev, [zone.id]: { ...prev[zone.id], x, y } }));
                    setCanvasCursor("move");
                  }}
                  onTransformStart={() => setCanvasCursor("nwse-resize")}
                  onTransformEnd={(e) => {
                    const node = e.target as Konva.Image;
                    const newWidth  = Math.max(20, node.width()  * node.scaleX());
                    const newHeight = Math.max(20, node.height() * node.scaleY());
                    node.scaleX(1); node.scaleY(1);
                    node.width(newWidth);
                    node.height(newHeight);
                    const clamped = clampToZone(node.x(), node.y(), newWidth, newHeight, zone);
                    node.position(clamped);
                    // Technique filters use node.cache() — regenerate at the new dimensions
                    // so the visual updates immediately without waiting for a colour/technique change.
                    if (node.isCached()) node.cache();
                    setLogoStates((prev) => ({
                      ...prev,
                      [zone.id]: { x: clamped.x, y: clamped.y, width: newWidth, height: newHeight },
                    }));
                    setCanvasCursor("move");
                  }}
                />
              );
            })}

            {focusedElement?.type === "logo" && focusedLogoState && (
              <Rect
                x={focusedLogoState.x}
                y={focusedLogoState.y}
                width={focusedLogoState.width}
                height={focusedLogoState.height}
                stroke="#d9480f"
                strokeWidth={1.5}
                dash={[4, 2]}
                listening={false}
              />
            )}

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
                  fontFamily="Inter, sans-serif"
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
                    setCanvasCursor("default");
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
              borderStroke="#d9480f"
              borderStrokeWidth={1.5}
              anchorFill="#ffffff"
              anchorStroke="#d9480f"
              anchorStrokeWidth={1.5}
              anchorSize={8}
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

    </div>
  );
});
