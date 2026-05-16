// ─── Print techniques ───────────────────────────────────────────────────────

export const PRINT_TECHNIQUES = [
  "screen_print",
  "embroidery",
  "sublimation",
  "engraving",
  "digital_print",
  "pad_print",
] as const;

export type PrintTechnique = (typeof PRINT_TECHNIQUES)[number];

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
  allowedTechniques: string[];
  /** 0 = unlimited */
  maxColors: number;
  /** Product image URL specific to this print position (e.g. back, chest, arm) */
  imageUrl: string;
  /** Pre-set logo locked by admin — viewer cannot remove it, only adjust own logo on top */
  fixedLogoUrl?: string;
  /** File ID used by the export backend to resolve the fixed logo on disk */
  fixedLogoFileId?: string;
  fixedLogoX?: number;
  fixedLogoY?: number;
  fixedLogoWidth?: number;
  fixedLogoHeight?: number;
  /** Print technique to simulate on the fixed logo (set by admin, read-only in viewer) */
  fixedLogoTechnique?: string;
  /** Colour count to simulate (0 = full colour, 1 = black, 2 = greyscale, etc.) */
  fixedLogoColorCount?: number;
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

// ─── UI utilities ────────────────────────────────────────────────────────────

export { cn } from "./lib/utils";

// ─── UI components ───────────────────────────────────────────────────────────

export { Button, type ButtonProps } from "./components/ui/button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/ui/card";
export { Badge, type BadgeProps } from "./components/ui/badge";
export { Input, type InputProps } from "./components/ui/input";
export { Label } from "./components/ui/label";
