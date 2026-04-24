import axios from "axios";
import type { Product, PrintZone } from "@logo-visualizer/shared";

const client = axios.create({
  baseURL: "http://localhost:5000/api",
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

// ─── Dev auth (Development only) ─────────────────────────────────────────────

let _token: string | null = null;

async function ensureToken() {
  if (_token) return;
  try {
    const res = await client.post<{ token: string }>("/auth/dev-token");
    _token = res.data.token;
    client.defaults.headers.common["Authorization"] = `Bearer ${_token}`;
  } catch {
    // No dev-token endpoint (production) — caller will get 401
  }
}

// ─── Print zones ─────────────────────────────────────────────────────────────

interface ZoneRequest {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  maxColors: number;
  imageUrl?: string;
  allowedTechniqueNames: string[];
}

interface ZoneResponse {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  maxColors: number | null;
  imageUrl?: string;
  allowedTechniques: { id: number; name: string }[];
}

function toRequest(zone: Omit<PrintZone, "id">): ZoneRequest {
  return {
    name: zone.name,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height,
    maxPhysicalWidthMm: zone.maxPhysicalWidthMm,
    maxPhysicalHeightMm: zone.maxPhysicalHeightMm,
    maxColors: zone.maxColors,
    imageUrl: zone.imageUrl,
    allowedTechniqueNames: zone.allowedTechniques,
  };
}

export function fromZoneResponse(z: ZoneResponse, fallbackImageUrl: string): PrintZone {
  return {
    id: z.id.toString(),
    name: z.name,
    x: z.x,
    y: z.y,
    width: z.width,
    height: z.height,
    maxPhysicalWidthMm: Number(z.maxPhysicalWidthMm),
    maxPhysicalHeightMm: Number(z.maxPhysicalHeightMm),
    maxColors: z.maxColors ?? 0,
    imageUrl: z.imageUrl ?? fallbackImageUrl,
    allowedTechniques: z.allowedTechniques.map(
      (t) => t.name.toLowerCase().replace(/ /g, "_") as PrintZone["allowedTechniques"][number]
    ),
  };
}

export const createZone = async (productId: string, zone: Omit<PrintZone, "id">) => {
  await ensureToken();
  return client
    .post<ZoneResponse>(`/products/${productId}/zones`, toRequest(zone))
    .then((r) => r.data);
};

export const updateZone = async (productId: string, zoneId: string, zone: Omit<PrintZone, "id">) => {
  await ensureToken();
  return client
    .put(`/products/${productId}/zones/${zoneId}`, toRequest(zone))
    .then((r) => r.data);
};

export const deleteZone = async (productId: string, zoneId: string) => {
  await ensureToken();
  return client.delete(`/products/${productId}/zones/${zoneId}`);
};
