import axios from "axios";
import type { ApiResponse, LogoUploadResponse, Product } from "@logo-visualizer/shared";

const client = axios.create({ baseURL: "/api" });

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
    .post<ApiResponse<LogoUploadResponse>>("/logos", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// ─── PNG export (B4) ─────────────────────────────────────────────────────────

export const requestExportPng = (payload: {
  productId: string;
  zoneId: string;
  logoFileId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) =>
  client
    .post("/export/png", payload, { responseType: "blob" })
    .then((r) => r.data as Blob);
