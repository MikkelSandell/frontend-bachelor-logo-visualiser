import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? "http://localhost:5000";
export const ADMIN_BASE_URL = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:5173";
export const VIEWER_BASE_URL = process.env.E2E_VIEWER_BASE_URL ?? "http://localhost:5174";

export type TestProduct = {
  id: string;
  title: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
};

export type TestZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowedTechniques: string[];
};

export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now()} ${randomUUID().slice(0, 8)}`;
}

export function productPngFixturePath(): string {
  return path.resolve(process.cwd(), "e2e/fixtures/product-512.png");
}

export function logoPngFixturePath(): string {
  return path.resolve(process.cwd(), "e2e/fixtures/logo-128.png");
}

export async function getDevToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/auth/dev-token`);
  if (!response.ok()) {
    throw new Error(`Failed to get dev token: ${response.status()} ${response.statusText()}`);
  }

  const json = (await response.json()) as { token?: string; data?: { token?: string } };
  const token = json.token ?? json.data?.token;
  if (!token) {
    throw new Error("Dev token response did not include token field.");
  }

  return token;
}

export async function createTestProduct(
  request: APIRequestContext,
  token: string,
  title: string,
  imagePath: string
): Promise<TestProduct> {
  const imageBuffer = await fs.readFile(imagePath);

  const form = {
    Title: title,
    Image: {
      name: path.basename(imagePath),
      mimeType: "image/png",
      buffer: imageBuffer,
    },
    ImageWidth: "1200",
    ImageHeight: "1200",
  };

  const response = await request.post(`${API_BASE_URL}/api/products`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    multipart: form,
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to create product: ${response.status()} ${body}`);
  }

  const json = (await response.json()) as {
    id: string | number;
    title: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
  };

  return {
    id: String(json.id),
    title: json.title,
    imageUrl: json.imageUrl,
    imageWidth: Number(json.imageWidth),
    imageHeight: Number(json.imageHeight),
  };
}

export async function createTestZone(
  request: APIRequestContext,
  token: string,
  productId: string,
  zoneName = "Front",
  allowedTechniques = ["digital_print"]
): Promise<TestZone> {
  const payload = {
    id: 0,
    name: zoneName,
    x: 200,
    y: 220,
    width: 360,
    height: 300,
    maxPhysicalWidthMm: 120,
    maxPhysicalHeightMm: 100,
    maxColors: 4,
    allowedTechniques,
  };

  const response = await request.post(`${API_BASE_URL}/api/products/${productId}/zones`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: payload,
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to create zone: ${response.status()} ${body}`);
  }

  const json = (await response.json()) as {
    id: string | number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    allowedTechniques: string[];
  };

  return {
    id: String(json.id),
    name: json.name,
    x: Number(json.x),
    y: Number(json.y),
    width: Number(json.width),
    height: Number(json.height),
    allowedTechniques: json.allowedTechniques ?? [],
  };
}

export async function cleanupProduct(request: APIRequestContext, token: string, productId: string): Promise<void> {
  const response = await request.delete(`${API_BASE_URL}/api/products/${productId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Cleanup should be best-effort. 404 means already deleted.
  if (!response.ok() && response.status() !== 404) {
    const body = await response.text();
    throw new Error(`Failed to cleanup product ${productId}: ${response.status()} ${body}`);
  }
}

export async function getProductById(request: APIRequestContext, productId: string) {
  const response = await request.get(`${API_BASE_URL}/api/products/${productId}`);
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Failed to fetch product ${productId}: ${response.status()} ${body}`);
  }
  return response.json();
}
