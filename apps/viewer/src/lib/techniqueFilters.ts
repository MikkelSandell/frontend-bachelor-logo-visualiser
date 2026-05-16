import Konva from "konva";

type KonvaFilter = (this: Konva.Node, imageData: ImageData) => void;

interface TechniqueFilterConfig {
  filters: KonvaFilter[];
  blurRadius?: number;
  noise?: number;
  enhance?: number;
  /** Konva Posterize `levels` param: 0–1 where lower = fewer discrete levels */
  levels?: number;
}

const NONE: TechniqueFilterConfig = { filters: [] };

// Posterize: Math.round(levels * 254) + 1 = discrete levels per channel.
//   0.01  → 4 levels  (very graphic / flat)
//   0.015 → 5 levels
//   0.02  → 6 levels
// Noise: ± (noise * 255) added per pixel — 0.25 is clearly visible grain.
const CONFIGS: Record<string, TechniqueFilterConfig> = {
  // Full colour, no effect
  digital_print: NONE,

  // Vibrant, slightly punchy colours
  sublimation: {
    filters: [Konva.Filters.Enhance],
    enhance: 0.5,
  },

  // Flat graphic look + ink-spread blur + fabric grain
  screen_print: {
    filters: [Konva.Filters.Posterize, Konva.Filters.Noise, Konva.Filters.Blur],
    levels: 0.01,
    noise: 0.25,
    blurRadius: 3,
  },

  // Similar to screen print but softer edges, less grain
  pad_print: {
    filters: [Konva.Filters.Posterize, Konva.Filters.Blur],
    levels: 0.015,
    blurRadius: 2,
  },

  // Heavy thread-like grain + limited thread colours + contrast boost
  embroidery: {
    filters: [Konva.Filters.Posterize, Konva.Filters.Noise, Konva.Filters.Enhance],
    levels: 0.015,
    noise: 0.4,
    enhance: 0.5,
  },

  // Monochrome — matches backend export behaviour
  engraving: {
    filters: [Konva.Filters.Grayscale, Konva.Filters.Enhance],
    enhance: 0.5,
  },
};

export function getTechniqueFilterConfig(technique: string | undefined): TechniqueFilterConfig {
  if (!technique) return NONE;
  return CONFIGS[technique] ?? NONE;
}
