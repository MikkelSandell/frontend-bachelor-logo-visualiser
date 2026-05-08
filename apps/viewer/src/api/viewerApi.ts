import axios from "axios";
import type { ApiResponse, LogoUploadResponse, Product } from "@logo-visualizer/shared";

const client = axios.create({ baseURL: "http://localhost:5000/api" });

// ─── Products (Midocean JSON data — no DB required) ──────────────────────────

export const getMidoceanProducts = () =>
  client
    .get<Product[]>("/midocean-products/as-products")
    .then((r) => r.data);

export const getMidoceanProduct = (masterCode: string) =>
  client
    .get<Product>(`/midocean-products/${masterCode}/as-product`)
    .then((r) => r.data);

// ─── Logo upload (B3) ────────────────────────────────────────────────────────

export const uploadLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<ApiResponse<LogoUploadResponse>>("/logos/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// ─── PNG export (B4) ─────────────────────────────────────────────────────────

export interface ZonePlacement {
  zoneId: string;
  logoId: string;
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  /** Technique slug (e.g. "engraving"). Omit if user has not selected a technique. */
  selectedTechniqueName?: string;
}

export interface TextPlacement {
  zoneId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export interface ExportPageRequest {
  productId: string;
  /** Full URL of the product background image for the exported side. */
  backgroundImageUrl: string;
  placements: ZonePlacement[];
  textPlacements: TextPlacement[];
}

export const requestExportPng = (payload: ExportPageRequest) =>
  client
    .post("/export/png", payload, { responseType: "blob" })
    .then((r) => r.data as Blob);

export const requestExportPdf = (payload: { pages: ExportPageRequest[] }) =>
  client
    .post("/export/pdf", payload, { responseType: "blob" })
    .then((r) => r.data as Blob);
