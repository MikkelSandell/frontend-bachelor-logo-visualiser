import axios from "axios";
import type { ApiResponse, LogoUploadResponse, Product } from "@logo-visualizer/shared";

const client = axios.create({
  baseURL: "/api",
});

// B2 – read-only, no auth required
export const getProduct = (id: string) =>
  client.get<ApiResponse<Product>>(`/products/${id}`).then((r) => r.data);

// B3 – logo upload; returns a temporary file reference
export const uploadLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<ApiResponse<LogoUploadResponse>>("/logos", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// B4 – request PNG export from backend
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
