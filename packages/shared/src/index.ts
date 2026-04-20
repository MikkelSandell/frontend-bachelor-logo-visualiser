// ─── Print techniques ───────────────────────────────────────────────────────

export type PrintTechnique =
  | "screen_print"
  | "embroidery"
  | "engraving"
  | "sublimation"
  | "digital_print"
  | "pad_print";

// ─── Print zone ─────────────────────────────────────────────────────────────

export interface PrintZone {
  id: string;
  /** Human-readable label, e.g. "Forside" or "Venstre bryst" */
  name: string;
  /** Position relative to the product image (pixels) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Maximum physical print size in millimetres */
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  /** Which print techniques are allowed on this zone */
  allowedTechniques: PrintTechnique[];
  /** 0 = unlimited */
  maxColors: number;
  /** Product image URL specific to this print position (e.g. back, chest, arm) */
  imageUrl: string;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  title: string;
  /** URL or relative path to the product image */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  printZones: PrintZone[];
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Logo placement state (shared between Admin preview and Viewer) ──────────

export interface LogoPlacement {
  /** Absolute pixel position within the product image coordinate space */
  x: number;
  y: number;
  width: number;
  height: number;
  technique: PrintTechnique;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export interface LogoUploadResponse {
  fileId: string;
  url: string;
  originalName: string;
  mimeType: string;
}
