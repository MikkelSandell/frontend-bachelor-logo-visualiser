import axios from "axios";
import type {
  Product,
  PrintZone,
  ApiResponse,
  PaginatedResponse,
} from "@logo-visualizer/shared";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// ─── Products ────────────────────────────────────────────────────────────────

export const getProducts = () =>
  client.get<PaginatedResponse<Product>>("/products").then((r) => r.data);

export const getProduct = (id: string) =>
  client.get<ApiResponse<Product>>(`/products/${id}`).then((r) => r.data);

export const createProduct = (
  data: Omit<Product, "id" | "printZones">
) =>
  client.post<ApiResponse<Product>>("/products", data).then((r) => r.data);

export const updateProduct = (
  id: string,
  data: Partial<Omit<Product, "id">>
) =>
  client
    .put<ApiResponse<Product>>(`/products/${id}`, data)
    .then((r) => r.data);

export const deleteProduct = (id: string) =>
  client.delete(`/products/${id}`);

/** A1 – upload product image; returns URL stored by the backend */
export const uploadProductImage = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<ApiResponse<{ url: string; width: number; height: number }>>(
      "/products/image",
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
    .then((r) => r.data);
};

/** A5 – import products from a vendor JSON file */
export const importProducts = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post<ApiResponse<Product[]>>("/products/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

/** A6 – download all products as JSON */
export const exportProducts = async () => {
  const resp = await client.get("/products/export", {
    responseType: "blob",
  });
  const url = URL.createObjectURL(resp.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products-export.json";
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Print zones ─────────────────────────────────────────────────────────────

export const createZone = (productId: string, zone: Omit<PrintZone, "id">) =>
  client
    .post<ApiResponse<PrintZone>>(`/products/${productId}/zones`, zone)
    .then((r) => r.data);

export const updateZone = (
  productId: string,
  zoneId: string,
  data: Partial<Omit<PrintZone, "id">>
) =>
  client
    .put<ApiResponse<PrintZone>>(
      `/products/${productId}/zones/${zoneId}`,
      data
    )
    .then((r) => r.data);

export const deleteZone = (productId: string, zoneId: string) =>
  client.delete(`/products/${productId}/zones/${zoneId}`);
