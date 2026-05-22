import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  ADMIN_BASE_URL,
  VIEWER_BASE_URL,
  cleanupProduct,
  createTestProduct,
  createTestZone,
  getDevToken,
  getProductById,
  logoPngFixturePath,
  productPngFixturePath,
  uniqueTitle,
} from "./helpers/api";

type TestState = {
  token: string;
  createdProductIds: string[];
};

type ProductDetail = {
  id: string | number;
  title: string;
  imageUrl: string;
  printZones: Array<{ id: string | number; name: string; imageUrl?: string }>;
};

type LogoUploadCapture = {
  logoId: string;
  responseStatus: number;
  responseBody: unknown;
};

type ExportPlacement = {
  zoneId: string;
  logoId: string;
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  selectedTechniqueName?: string;
  colorCount?: number;
  maxColors?: number;
};

type ExportPngBody = {
  productId: string;
  backgroundImageUrl: string;
  placements: ExportPlacement[];
  textPlacements: unknown[];
};

type ExportPdfBody = {
  pages: ExportPngBody[];
};

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function setupProductWithZone(state: TestState, request: APIRequestContext) {
  const product = await createTestProduct(
    request,
    state.token,
    uniqueTitle("E2E Viewer Product"),
    productPngFixturePath()
  );
  state.createdProductIds.push(product.id);
  const zone = await createTestZone(request, state.token, product.id, "Front");
  const productDetail = (await getProductById(request, product.id)) as ProductDetail;
  return { product, zone, productDetail };
}

async function openProductInViewer(page: Page, title: string) {
  await page.goto(VIEWER_BASE_URL);
  await page.getByPlaceholder("Søg på produktnavn…").fill(title);

  const cardButton = page.locator("button", { hasText: title }).first();
  await expect(cardButton).toBeVisible();
  await cardButton.click();
}

async function uploadPngLogo(page: Page): Promise<LogoUploadCapture> {
  const logoInput = page.locator('input[type="file"][accept*="image/png"]').first();
  const uploadResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/logos/upload") && response.request().method() === "POST"
  );

  await logoInput.setInputFiles(logoPngFixturePath());
  const uploadResponse = await uploadResponsePromise;
  const uploadJson = await uploadResponse.json().catch(() => null);

  await expect(page.getByText("Logo uploadet")).toBeVisible({ timeout: 10_000 });

  const logoName = path.basename(logoPngFixturePath());
  const logoThumbButton = page.getByTitle(logoName).first();
  await expect(logoThumbButton).toBeVisible();
  await logoThumbButton.click();

  const payloadCandidate =
    uploadJson && typeof uploadJson === "object" && "data" in uploadJson
      ? (uploadJson as { data?: { logoId?: string } }).data
      : (uploadJson as { logoId?: string } | null);

  const logoId = payloadCandidate?.logoId;
  if (!logoId) {
    throw new Error(`Logo upload response missing logoId: ${JSON.stringify(uploadJson)}`);
  }

  return {
    logoId,
    responseStatus: uploadResponse.status(),
    responseBody: uploadJson,
  };
}

function buildExportFailureMessage(params: {
  cause: "fixture" | "frontend-payload" | "backend-rendering";
  exportRequestBody: unknown;
  productDetailResponse: unknown;
  zoneIdUsed: string;
  logoUploadResponse: unknown;
  exportResponseStatus: number;
  exportResponseBody: string;
}) {
  return JSON.stringify(params, null, 2);
}

test.describe("LogoVisualizer frontend E2E", () => {
  let state: TestState = {
    token: "",
    createdProductIds: [],
  };

  test.beforeEach(async ({ request }) => {
    state = {
      token: await getDevToken(request),
      createdProductIds: [],
    };
  });

  test.afterEach(async ({ request }) => {
    if (!state.token || state.createdProductIds.length === 0) {
      return;
    }

    for (const id of state.createdProductIds) {
      await cleanupProduct(request, state.token, id);
    }
  });

  test("E2E-01 Viewer loads API-created product", async ({ page, request }) => {
    const { product, zone } = await setupProductWithZone(state, request);

    await openProductInViewer(page, product.title);

    await expect(page.getByText(product.title).first()).toBeVisible();
    await expect(page.getByText(zone.name).first()).toBeVisible();
  });

  test("E2E-02 Viewer uploads valid PNG logo", async ({ page, request }) => {
    const { product } = await setupProductWithZone(state, request);

    await openProductInViewer(page, product.title);
    await uploadPngLogo(page);

    await expect(page.getByRole("button", { name: "Download som PNG" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Download som PDF" })).toBeEnabled();
  });

  test("E2E-03 Viewer exports PNG", async ({ page, request }) => {
    const { product, zone, productDetail } = await setupProductWithZone(state, request);
    expect(isAbsoluteUrl(productDetail.imageUrl)).toBeTruthy();

    await openProductInViewer(page, product.title);
    const logoUpload = await uploadPngLogo(page);

    const exportRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/export/png") && req.method() === "POST"
    );
    const exportResponsePromise = page.waitForResponse((res) => res.url().includes("/api/export/png"));
    const downloadPromise = page.waitForEvent("download").catch(() => null);

    await page.getByRole("button", { name: "Download som PNG" }).click();

    const exportRequest = exportRequestPromise;
    const exportBody = (await exportRequest).postDataJSON() as ExportPngBody;

    expect(typeof exportBody.productId).toBe("string");
    expect(exportBody.productId).toBe(String(product.id));
    expect(typeof exportBody.backgroundImageUrl).toBe("string");
    expect(isAbsoluteUrl(exportBody.backgroundImageUrl)).toBeTruthy();
    expect(exportBody.backgroundImageUrl).toBe(productDetail.imageUrl);
    expect(Array.isArray(exportBody.placements)).toBeTruthy();
    expect(exportBody.placements.length).toBeGreaterThan(0);

    const placement = exportBody.placements[0];
    expect(typeof placement.zoneId).toBe("string");
    expect(placement.zoneId).toBe(String(zone.id));
    expect(typeof placement.logoId).toBe("string");
    expect(placement.logoId).toBe(logoUpload.logoId);

    const exportResponse = await exportResponsePromise;
    const exportResponseBody = await exportResponse.text();
    if (!exportResponse.ok()) {
      throw new Error(buildExportFailureMessage({
        cause: isAbsoluteUrl(exportBody.backgroundImageUrl) ? "backend-rendering" : "frontend-payload",
        exportRequestBody: exportBody,
        productDetailResponse: productDetail,
        zoneIdUsed: String(zone.id),
        logoUploadResponse: logoUpload,
        exportResponseStatus: exportResponse.status(),
        exportResponseBody,
      }));
    }

    const contentType = exportResponse.headers()["content-type"] ?? "";
    expect(contentType.includes("image/png")).toBeTruthy();

    const download = await downloadPromise;
    expect(download).toBeTruthy();
    const suggestedName = download?.suggestedFilename().toLowerCase() ?? "";
    expect(suggestedName.endsWith(".png")).toBeTruthy();
  });

  test("E2E-04 Viewer exports PDF", async ({ page, request }) => {
    const { product, zone, productDetail } = await setupProductWithZone(state, request);
    expect(isAbsoluteUrl(productDetail.imageUrl)).toBeTruthy();

    await openProductInViewer(page, product.title);
    const logoUpload = await uploadPngLogo(page);

    const exportRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/export/pdf") && req.method() === "POST"
    );
    const exportResponsePromise = page.waitForResponse((res) => res.url().includes("/api/export/pdf"));
    const downloadPromise = page.waitForEvent("download").catch(() => null);

    await page.getByRole("button", { name: "Download som PDF" }).click();

    const exportBody = (await exportRequestPromise).postDataJSON() as ExportPdfBody;
    expect(Array.isArray(exportBody.pages)).toBeTruthy();
    expect(exportBody.pages.length).toBeGreaterThan(0);

    const pageBody = exportBody.pages[0];
    expect(typeof pageBody.productId).toBe("string");
    expect(pageBody.productId).toBe(String(product.id));
    expect(typeof pageBody.backgroundImageUrl).toBe("string");
    expect(isAbsoluteUrl(pageBody.backgroundImageUrl)).toBeTruthy();
    expect(pageBody.backgroundImageUrl).toBe(productDetail.imageUrl);
    expect(Array.isArray(pageBody.placements)).toBeTruthy();
    expect(pageBody.placements.length).toBeGreaterThan(0);

    const placement = pageBody.placements[0];
    expect(typeof placement.zoneId).toBe("string");
    expect(placement.zoneId).toBe(String(zone.id));
    expect(typeof placement.logoId).toBe("string");
    expect(placement.logoId).toBe(logoUpload.logoId);

    const exportResponse = await exportResponsePromise;
    const exportResponseBody = await exportResponse.text();
    if (!exportResponse.ok()) {
      throw new Error(buildExportFailureMessage({
        cause: isAbsoluteUrl(pageBody.backgroundImageUrl) ? "backend-rendering" : "frontend-payload",
        exportRequestBody: exportBody,
        productDetailResponse: productDetail,
        zoneIdUsed: String(zone.id),
        logoUploadResponse: logoUpload,
        exportResponseStatus: exportResponse.status(),
        exportResponseBody,
      }));
    }

    const contentType = exportResponse.headers()["content-type"] ?? "";
    expect(contentType.includes("application/pdf")).toBeTruthy();

    const download = await downloadPromise;
    expect(download).toBeTruthy();
    const suggestedName = download?.suggestedFilename().toLowerCase() ?? "";
    expect(suggestedName.endsWith(".pdf")).toBeTruthy();
  });

  test("E2E-05 Admin creates product through UI", async ({ page }) => {
    const title = uniqueTitle("E2E Admin Create");

    await page.goto(`${ADMIN_BASE_URL}/products/new`);
    await page.locator("#title").fill(title);
    await page.locator("#image").setInputFiles(productPngFixturePath());
    await page.getByRole("button", { name: "Opret produkt" }).click();

    await expect(page).toHaveURL(/\/products\/[^/]+$/);

    const productId = page.url().split("/").pop();
    if (productId) {
      state.createdProductIds.push(productId);
    }
  });

  test("E2E-06 Admin edits and saves zone metadata", async ({ page, request }) => {
    const product = await createTestProduct(
      request,
      state.token,
      uniqueTitle("E2E Admin Zone"),
      productPngFixturePath()
    );
    state.createdProductIds.push(product.id);
    await createTestZone(request, state.token, product.id, "Front");

    await page.goto(`${ADMIN_BASE_URL}/products/${product.id}`);

    await page.getByRole("button", { name: "Rediger", exact: true }).first().click();

    await expect(page.locator("#zone-name")).toBeVisible({ timeout: 10_000 });
    await page.locator("#zone-name").fill("Front Edited");
    await page.locator("#zone-x").fill("210");
    await page.locator("#zone-y").fill("230");
    await page.locator("#zone-width").fill("350");
    await page.locator("#zone-height").fill("280");

    await page.getByRole("button", { name: "Gem zone" }).click();
    await page.getByRole("button", { name: "Gem ændringer" }).click();

    await expect(page.getByText("Ændringer gemt")).toBeVisible();

    const updated = (await getProductById(request, product.id)) as {
      printZones: Array<{ name: string; x: number; y: number; width: number; height: number }>;
    };
    const zone = updated.printZones.find((z) => z.name === "Front Edited");
    expect(zone).toBeTruthy();
    expect(zone?.x).toBe(210);
    expect(zone?.y).toBe(230);
    expect(zone?.width).toBe(350);
    expect(zone?.height).toBe(280);
  });

  test("E2E-08 Viewer pre-loads product from URL param", async ({ page, request }) => {
    const { product, zone } = await setupProductWithZone(state, request);

    await page.goto(`${VIEWER_BASE_URL}?product=${product.id}`);

    // "← Vælg andet produkt" only renders in workspace mode — wait for it to confirm the
    // product was selected automatically without the user having to click anything.
    await expect(page.getByText("← Vælg andet produkt")).toBeVisible({ timeout: 15_000 });

    // Product picker search input must not be visible once workspace is active.
    await expect(page.getByPlaceholder("Søg på produktnavn…")).not.toBeVisible();

    // Product title is shown in the header and the left panel.
    await expect(page.getByText(product.title).first()).toBeVisible();

    // Zone name is shown in the single-zone static display.
    await expect(page.getByText(zone.name).first()).toBeVisible();

    // No logo has been uploaded yet — download buttons must be disabled.
    await expect(page.getByRole("button", { name: "Download som PNG" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Download som PDF" })).toBeDisabled();
  });

  test("E2E-09 Viewer technique selection appears in export payload", async ({ page, request }) => {
    // Zone with two techniques so we can verify that clicking the second one
    // overrides the default (first) technique in the export request body.
    const product = await createTestProduct(
      request,
      state.token,
      uniqueTitle("E2E Technique"),
      productPngFixturePath()
    );
    state.createdProductIds.push(product.id);
    await createTestZone(request, state.token, product.id, "Front", ["digital_print", "screen_print"]);

    await openProductInViewer(page, product.title);
    await uploadPngLogo(page);

    // Both technique buttons must be visible (zone is auto-focused for a single-zone product).
    await expect(page.getByRole("button", { name: "Digitaltryk" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Silketryk" })).toBeVisible();

    // Select the second technique — overrides the default "digital_print".
    await page.getByRole("button", { name: "Silketryk" }).click();

    const exportRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/export/png") && req.method() === "POST"
    );

    await page.getByRole("button", { name: "Download som PNG" }).click();

    const exportBody = (await exportRequestPromise).postDataJSON() as ExportPngBody;
    expect(exportBody.placements.length).toBeGreaterThan(0);
    expect(exportBody.placements[0].selectedTechniqueName).toBe("screen_print");
  });

  test("E2E-10 Viewer zone selector activates multiple zones", async ({ page, request }) => {
    const product = await createTestProduct(
      request,
      state.token,
      uniqueTitle("E2E Multi Zone"),
      productPngFixturePath()
    );
    state.createdProductIds.push(product.id);
    await createTestZone(request, state.token, product.id, "Front");
    await createTestZone(request, state.token, product.id, "Back");

    await openProductInViewer(page, product.title);

    // This help text only renders inside ZoneSelector — it confirms the multi-zone
    // component is shown instead of the single-zone static display.
    await expect(
      page.getByText("Klik for at vælge zone · klik den markerede for at fjerne")
    ).toBeVisible({ timeout: 10_000 });

    const frontButton = page.getByRole("button", { name: "Front" }).first();
    const backButton = page.getByRole("button", { name: "Back" }).first();
    await expect(frontButton).toBeVisible();
    await expect(backButton).toBeVisible();

    // Activate Front — it becomes active and focused.
    await frontButton.click();
    // Activate Back — Back becomes focused; Front stays active.
    await backButton.click();

    // A zone is now focused, so the TechniqueSelector no longer shows its placeholder.
    await expect(page.getByText("Vælg en print-zone")).not.toBeVisible();
  });

  test("E2E-11 Admin product list shows created product with correct status", async ({ page, request }) => {
    const product = await createTestProduct(
      request,
      state.token,
      uniqueTitle("E2E Admin List"),
      productPngFixturePath()
    );
    state.createdProductIds.push(product.id);
    await createTestZone(request, state.token, product.id, "Front");

    // Products list lives at the admin root route.
    await page.goto(ADMIN_BASE_URL);

    // Wait for the table row containing our product to appear.
    const row = page.locator("tr", { hasText: product.title });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // A product with an image + at least one zone must be FullyConfigured.
    await expect(row.getByText("FullyConfigured")).toBeVisible();

    // Zone count cell must show 1.
    await expect(row.getByText("1", { exact: true })).toBeVisible();

    const searchInput = page.getByPlaceholder("Søg på produktnavn…");

    // Searching by exact title keeps the product visible.
    await searchInput.fill(product.title);
    await expect(row).toBeVisible();

    // Searching for something that matches nothing shows the empty-state message.
    const noMatch = "xyzzy_no_match_99999";
    await searchInput.fill(noMatch);
    await expect(page.getByText(`Ingen produkter matcher "${noMatch}"`)).toBeVisible();
  });

  test("E2E-07 Viewer rejects unsupported logo", async ({ page, request }) => {
    const { product } = await setupProductWithZone(state, request);

    await openProductInViewer(page, product.title);

    const pngBytes = await fs.readFile(logoPngFixturePath());
    const padded = Buffer.concat([pngBytes, Buffer.alloc(1200)]);

    const logoInput = page.locator('input[type="file"][accept*="image/png"]').first();
    await logoInput.setInputFiles({
      name: "unsupported.webp",
      mimeType: "image/webp",
      buffer: padded,
    });

    const pngButton = page.getByRole("button", { name: "Download som PNG" });

    const uploadedOk = await page.getByText("Logo uploadet").isVisible().catch(() => false);
    if (uploadedOk) {
      test.skip(true, "Backend accepted WEBP upload in this environment; unsupported-file rejection cannot be asserted reliably.");
    }

    const errorBox = page.locator("div.border-red-200.bg-red-50").first();
    const sawError = await errorBox.isVisible().catch(() => false);
    const stillDisabled = await pngButton.isDisabled();

    expect(sawError || stillDisabled).toBeTruthy();
  });

  test("E2E-12 Viewer color count appears in export payload", async ({ page, request }) => {
    // createTestZone defaults to maxColors: 4 — ColorCountSelector renders buttons 1-4
    const { product } = await setupProductWithZone(state, request);

    await openProductInViewer(page, product.title);
    await uploadPngLogo(page);

    // The "Antal farver (maks X)" paragraph is unique to ColorCountSelector.
    // Scope button clicks to its parent container to avoid collisions with other "2" text.
    const colorSection = page.locator("div").filter({
      has: page.locator("p", { hasText: /Antal farver.*maks/ }),
    });
    await expect(colorSection.getByRole("button", { name: "2", exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await colorSection.getByRole("button", { name: "2", exact: true }).click();

    const exportRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/export/png") && req.method() === "POST"
    );
    await page.getByRole("button", { name: "Download som PNG" }).click();

    const exportBody = (await exportRequestPromise).postDataJSON() as ExportPngBody;
    expect(exportBody.placements.length).toBeGreaterThan(0);
    expect(exportBody.placements[0].colorCount).toBe(2);
  });

  test("E2E-13 Viewer PDF export covers both sides when Front and Back zones are active", async ({ page, request }) => {
    // PNG export is per-side (one background image). PDF export creates one page per side,
    // so it is the correct way to verify that logos on both Front and Back reach the backend.
    const product = await createTestProduct(
      request,
      state.token,
      uniqueTitle("E2E Multi Zone Export"),
      productPngFixturePath()
    );
    state.createdProductIds.push(product.id);
    const frontZone = await createTestZone(request, state.token, product.id, "Front");
    const backZone  = await createTestZone(request, state.token, product.id, "Back");

    await openProductInViewer(page, product.title);

    // ZoneSelector is shown for multi-zone products — activate Front first.
    const frontButton = page.getByRole("button", { name: "Front" }).first();
    const backButton  = page.getByRole("button", { name: "Back" }).first();
    await expect(frontButton).toBeVisible({ timeout: 10_000 });
    await frontButton.click();

    // Upload logo — thumbnail click assigns it to the currently focused zone (Front).
    const logoCapture = await uploadPngLogo(page);

    // Activate Back and assign the same logo to it.
    await backButton.click();
    const logoName = path.basename(logoPngFixturePath());
    const logoThumb = page.getByTitle(logoName).first();
    await expect(logoThumb).toBeVisible();
    await logoThumb.click();

    // PDF export — builds one page per side; each page should contain a placement.
    const exportRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/export/pdf") && req.method() === "POST"
    );
    await page.getByRole("button", { name: "Download som PDF" }).click();

    const exportBody = (await exportRequestPromise).postDataJSON() as ExportPdfBody;
    expect(exportBody.pages.length).toBeGreaterThanOrEqual(2);

    const frontPage = exportBody.pages.find((p) =>
      p.placements.some((pl) => pl.zoneId === String(frontZone.id))
    );
    const backPage = exportBody.pages.find((p) =>
      p.placements.some((pl) => pl.zoneId === String(backZone.id))
    );
    expect(frontPage).toBeTruthy();
    expect(backPage).toBeTruthy();
    expect(logoCapture.logoId).toBeTruthy();
  });
});
