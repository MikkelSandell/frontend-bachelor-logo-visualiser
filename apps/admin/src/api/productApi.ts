import axios from "axios";
import type { Product, PrintZone } from "@logo-visualizer/shared";

const DEV_TOKEN_STORAGE_KEY = "logo-visualizer.admin.dev-token";

const client = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

type ApiEnvelope<T> = {
  data?: T;
  items?: T[];
  success?: boolean;
  message?: string;
};

type ImportSummary = {
  imported?: number;
  productIds?: Array<string | number>;
};

const API_FILES_PREFIXES = [
  "http://localhost:5000/api/files/",
  "https://localhost:5000/api/files/",
  "/api/files/",
];

export type ApiErrorPayload = {
  messages: string[];
  statusCode?: number;
};

type TechniqueDto = {
  name?: string;
  id?: string | number;
};

type ZoneUpsertPayload = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  maxPhysicalWidthMm: number;
  maxPhysicalHeightMm: number;
  maxColors: number;
  allowedTechniques: string[];
};

export type ProductUpsertPayload = {
  id: string | number;
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  printZones: ZoneUpsertPayload[];
};

export type CreateProductPayload = {
  title: string;
  imageFile: File;
  imageWidth: number;
  imageHeight: number;
};

function readFromEnvelope<T>(payload: T | ApiEnvelope<T>): T {
  const asEnvelope = payload as ApiEnvelope<T>;
  if (asEnvelope && typeof asEnvelope === "object" && "data" in asEnvelope && asEnvelope.data !== undefined) {
    return asEnvelope.data;
  }
  return payload as T;
}

function normalizeImageUrl(imageUrl: unknown): string {
  if (typeof imageUrl !== "string" || imageUrl.trim().length === 0) {
    return "";
  }

  for (const prefix of API_FILES_PREFIXES) {
    if (!imageUrl.startsWith(prefix)) {
      continue;
    }

    const encodedPath = imageUrl.slice(prefix.length);
    try {
      const decodedPath = decodeURIComponent(encodedPath);
      if (decodedPath.startsWith("http://") || decodedPath.startsWith("https://")) {
        return decodedPath;
      }
    } catch {
      // Keep original URL if decode fails.
    }
  }

  return imageUrl;
}

function normalizeProduct(product: Product): Product {
  const normalizedImageUrl = normalizeImageUrl(product.imageUrl);

  return {
    ...product,
    id: String(product.id),
    imageUrl: normalizedImageUrl,
    imageWidth: Number(product.imageWidth),
    imageHeight: Number(product.imageHeight),
    printZones: (product.printZones ?? []).map((zone) => ({
      ...zone,
      id: String(zone.id),
      x: Number(zone.x),
      y: Number(zone.y),
      width: Number(zone.width),
      height: Number(zone.height),
      maxPhysicalWidthMm: Number(zone.maxPhysicalWidthMm),
      maxPhysicalHeightMm: Number(zone.maxPhysicalHeightMm),
      maxColors: Number(zone.maxColors ?? 0),
      allowedTechniques: (zone.allowedTechniques ?? []).map((t: unknown) => {
        if (typeof t === "string") return t;
        if (t && typeof t === "object" && "name" in t) return (t as { name: string }).name;
        return null;
      }).filter(Boolean) as PrintZone["allowedTechniques"],
      imageUrl: normalizeImageUrl(zone.imageUrl ?? normalizedImageUrl),
    })),
  };
}

function applyToken(token: string) {
  client.defaults.headers.common.Authorization = `Bearer ${token}`;
}

let cachedToken: string | null = null;

function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore localStorage failures and keep token only in memory.
  }
}

async function ensureToken() {
  if (cachedToken) {
    applyToken(cachedToken);
    return;
  }

  const storedToken = loadStoredToken();
  if (storedToken) {
    cachedToken = storedToken;
    applyToken(storedToken);
    return;
  }

  const response = await client.post<{ token?: string } | ApiEnvelope<{ token: string }>>("/auth/dev-token");
  const tokenPayload = readFromEnvelope(response.data as { token: string } | ApiEnvelope<{ token: string }>);
  const token = tokenPayload.token;
  if (!token) {
    throw new Error("Kunne ikke hente admin token fra backend.");
  }

  cachedToken = token;
  storeToken(token);
  applyToken(token);
}

function toZoneUpsertPayload(zone: PrintZone): ZoneUpsertPayload {
  const numericId = Number(zone.id);
  const isNew = Number.isNaN(numericId) || zone.id.startsWith("temp-") || zone.id === "0";

  return {
    id: isNew ? 0 : numericId,
    name: zone.name,
    x: Math.round(zone.x),
    y: Math.round(zone.y),
    width: Math.round(zone.width),
    height: Math.round(zone.height),
    maxPhysicalWidthMm: Math.round(zone.maxPhysicalWidthMm),
    maxPhysicalHeightMm: Math.round(zone.maxPhysicalHeightMm),
    maxColors: Math.round(zone.maxColors),
    allowedTechniques: [...(zone.allowedTechniques as string[])],
  };
}

function toProductUpsertPayload(product: Product): ProductUpsertPayload {
  const numericId = Number(product.id);
  return {
    id: Number.isNaN(numericId) ? product.id : numericId,
    title: product.title,
    imageUrl: product.imageUrl,
    imageWidth: Math.round(product.imageWidth),
    imageHeight: Math.round(product.imageHeight),
    printZones: (product.printZones ?? []).map(toZoneUpsertPayload),
  };
}

export function parseApiError(error: unknown): ApiErrorPayload {
  if (error instanceof Error && error.message) {
    return { messages: [error.message], statusCode: undefined };
  }

  if (!axios.isAxiosError(error)) {
    return { messages: ["Ukendt fejl. Prøv igen."], statusCode: undefined };
  }

  const statusCode = error.response?.status;
  const data = error.response?.data as
    | undefined
    | {
        message?: string;
        title?: string;
        errors?: Record<string, string[] | string>;
        detail?: string;
      };

  const messages: string[] = [];

  if (data?.message) {
    messages.push(data.message);
  }

  if (data?.title && data.title !== data.message) {
    messages.push(data.title);
  }

  if (data?.detail) {
    messages.push(data.detail);
  }

  if (data?.errors) {
    for (const value of Object.values(data.errors)) {
      if (Array.isArray(value)) {
        messages.push(...value);
      } else if (typeof value === "string") {
        messages.push(value);
      }
    }
  }

  if (messages.length === 0 && error.message) {
    messages.push(error.message);
  }

  if (messages.length === 0) {
    messages.push("Anmodningen fejlede.");
  }

  return { messages: [...new Set(messages)], statusCode };
}

export async function getProducts(): Promise<Product[]> {
  const response = await client.get<Product[] | ApiEnvelope<Product[]> | { items: Product[] }>("/products");
  const payload = response.data;

  if (Array.isArray(payload)) {
    return payload.map(normalizeProduct);
  }

  if (payload && typeof payload === "object" && "items" in payload && Array.isArray(payload.items)) {
    return (payload.items as Product[]).map(normalizeProduct);
  }

  const data = readFromEnvelope(payload as Product[] | ApiEnvelope<Product[]>);
  return (data ?? []).map(normalizeProduct);
}

export async function getProduct(id: string): Promise<Product> {
  const response = await client.get<Product | ApiEnvelope<Product>>(`/products/${id}`);
  return normalizeProduct(readFromEnvelope(response.data));
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  await ensureToken();

  const form = new FormData();
  form.append("title", payload.title);
  form.append("image", payload.imageFile);
  form.append("file", payload.imageFile);
  form.append("imageWidth", String(payload.imageWidth));
  form.append("imageHeight", String(payload.imageHeight));

  const response = await client.post<Product | ApiEnvelope<Product>>("/products", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return normalizeProduct(readFromEnvelope(response.data));
}

export async function updateProduct(id: string, product: Product): Promise<Product> {
  await ensureToken();

  const response = await client.put<Product | ApiEnvelope<Product>>(
    `/products/${id}`,
    toProductUpsertPayload(product)
  );

  return normalizeProduct(readFromEnvelope(response.data));
}

export async function deleteProduct(id: string): Promise<void> {
  await ensureToken();
  await client.delete(`/products/${id}`);
}

export async function getProductZones(productId: string): Promise<PrintZone[]> {
  const response = await client.get<PrintZone[] | ApiEnvelope<PrintZone[]>>(`/products/${productId}/zones`);
  const zones = readFromEnvelope(response.data) ?? [];
  return zones.map((zone) => ({
    ...zone,
    id: String(zone.id),
    x: Number(zone.x),
    y: Number(zone.y),
    width: Number(zone.width),
    height: Number(zone.height),
    maxPhysicalWidthMm: Number(zone.maxPhysicalWidthMm),
    maxPhysicalHeightMm: Number(zone.maxPhysicalHeightMm),
    maxColors: Number(zone.maxColors ?? 0),
    allowedTechniques: (zone.allowedTechniques ?? []).map((t: unknown) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object" && "name" in t) return (t as { name: string }).name;
      return null;
    }).filter(Boolean) as PrintZone["allowedTechniques"],
  }));
}

export async function createZone(productId: string, zone: PrintZone): Promise<PrintZone> {
  await ensureToken();
  const payload = toZoneUpsertPayload(zone);
  const response = await client.post<PrintZone | ApiEnvelope<PrintZone>>(`/products/${productId}/zones`, payload);
  const saved = readFromEnvelope(response.data);
  return {
    ...saved,
    id: String(saved.id),
    imageUrl: saved.imageUrl ?? zone.imageUrl,
  };
}

export async function updateZone(productId: string, zoneId: string, zone: PrintZone): Promise<PrintZone> {
  await ensureToken();
  const payload = toZoneUpsertPayload(zone);
  const response = await client.put<PrintZone | ApiEnvelope<PrintZone>>(
    `/products/${productId}/zones/${zoneId}`,
    payload
  );
  const saved = readFromEnvelope(response.data);
  return {
    ...saved,
    id: String(saved.id),
    imageUrl: saved.imageUrl ?? zone.imageUrl,
  };
}

export async function deleteZone(productId: string, zoneId: string): Promise<void> {
  await ensureToken();
  await client.delete(`/products/${productId}/zones/${zoneId}`);
}

export async function getTechniques(): Promise<string[]> {
  const response = await client.get<string[] | TechniqueDto[] | ApiEnvelope<string[] | TechniqueDto[]>>("/techniques");
  const payload = readFromEnvelope(response.data);
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (typeof item === "string") return item;
      return item.name;
    })
    .filter((name): name is string => Boolean(name));
}

export async function importProducts(file: File): Promise<Product[]> {
  await ensureToken();

  const form = new FormData();
  form.append("file", file);

  const response = await client.post<
    Product[] | Product | ImportSummary | ApiEnvelope<Product[] | Product | ImportSummary>
  >(
    "/products/import",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );

  const payload = readFromEnvelope(response.data);

  if (Array.isArray(payload)) {
    return payload.map((product) => normalizeProduct(product));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const maybeSummary = payload as ImportSummary;
  if (Array.isArray(maybeSummary.productIds)) {
    const importedProducts = await Promise.all(
      maybeSummary.productIds.map(async (id) => {
        try {
          return await getProduct(String(id));
        } catch {
          return null;
        }
      })
    );

    return importedProducts.filter((product): product is Product => product !== null);
  }

  return [normalizeProduct(payload as Product)];
}

export async function exportProduct(productId: string): Promise<Blob> {
  const response = await client.get(`/products/${productId}/export`, {
    responseType: "blob",
  });
  return response.data as Blob;
}
