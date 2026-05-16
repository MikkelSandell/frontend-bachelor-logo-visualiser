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

// Math.round(levels * 254) + 1 gives discrete levels per channel:
//   0.015 → ~5 levels  (screen print graphic look)
//   0.02  → ~6 levels  (pad print)
//   0.03  → ~9 levels  (embroidery, softer)
const CONFIGS: Record<string, TechniqueFilterConfig> = {
  digital_print: NONE,

  sublimation: {
    filters: [Konva.Filters.Enhance],
    enhance: 0.25,
  },

  screen_print: {
    filters: [Konva.Filters.Posterize, Konva.Filters.Blur],
    levels: 0.015,
    blurRadius: 1.5,
  },

  pad_print: {
    filters: [Konva.Filters.Posterize],
    levels: 0.02,
  },

  embroidery: {
    filters: [Konva.Filters.Posterize, Konva.Filters.Noise, Konva.Filters.Enhance],
    levels: 0.03,
    noise: 0.12,
    enhance: 0.3,
  },

  engraving: {
    filters: [Konva.Filters.Grayscale],
  },
};

export function getTechniqueFilterConfig(technique: string | undefined): TechniqueFilterConfig {
  if (!technique) return NONE;
  return CONFIGS[technique] ?? NONE;
}
