import axios from "axios";
import type { Product, PrintZone } from "@logo-visualizer/shared";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ─── Midocean products (no DB — read from JSON) ───────────────────────────────

export const getMidoceanProducts = () =>
  client
    .get<Product[]>("/midocean-products/as-products")
    .then((r) => r.data);

export const getMidoceanProduct = (masterCode: string) =>
  client
    .get<Product>(`/midocean-products/${masterCode}/as-product`)
    .then((r) => r.data);

// ─── DB-backed product CRUD (requires database — not available in current setup) ──

export const getProducts = () =>
  client.get<{ items: Product[]; total: number; page: number; pageSize: number }>("/products").then((r) => r.data);

export const getProduct = (id: string) =>
  client.get<{ data: Product; success: boolean }>(`/products/${id}`).then((r) => r.data);

export const createProduct = (data: Omit<Product, "id" | "printZones">) =>
  client.post<{ data: Product; success: boolean }>("/products", data).then((r) => r.data);

export const updateProduct = (id: string, data: Partial<Omit<Product, "id">>) =>
  client.put<{ data: Product; success: boolean }>(`/products/${id}`, data).then((r) => r.data);

export const deleteProduct = (id: string) =>
  client.delete(`/products/${id}`);

export const uploadProductImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<{ data: { url: string; width: number; height: number }; success: boolean }>(
      "/products/image", form, { headers: { "Content-Type": "multipart/form-data" } }
    )
    .then((r) => r.data);
};

export const importProducts = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<{ data: Product[]; success: boolean }>("/products/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const exportProducts = async () => {
  const resp = await client.get("/products/export", { responseType: "blob" });
  const url = URL.createObjectURL(resp.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-export.json";
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Print zones ─────────────────────────────────────────────────────────────

export const createZone = (productId: string, zone: Omit<PrintZone, "id">) =>
  client.post<{ data: PrintZone; success: boolean }>(`/products/${productId}/zones`, zone).then((r) => r.data);

export const updateZone = (productId: string, zoneId: string, data: Partial<Omit<PrintZone, "id">>) =>
  client.put<{ data: PrintZone; success: boolean }>(`/products/${productId}/zones/${zoneId}`, data).then((r) => r.data);

export const deleteZone = (productId: string, zoneId: string) =>
  client.delete(`/products/${productId}/zones/${zoneId}`);
