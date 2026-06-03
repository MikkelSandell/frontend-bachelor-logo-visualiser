# CLAUDE.md – Logo Visualizer Frontend

This file gives Claude (and other AI assistants) the context needed to work effectively in this repository.

---

## Project overview

Bachelor project: **Logo Visualizer & Product Setup Tool**

A React + TypeScript monorepo that is the **frontend** component of a standalone service for visualising customer logos on promotional merchandise products (t-shirts, mugs, pens, etc.).

The backend is a separate .NET / ASP.NET Core project (`LogoVisualizer.Api`) that runs at `http://localhost:5000` during development. The backend uses a SQL Server database (Docker) with automatic JSON fallback — start the database with `docker compose up -d` from the backend folder before running the frontend.

---

## Workspace structure

```
frontend/
├── apps/
│   ├── admin/          # Internal admin tool – product & print zone setup
│   │   └── src/
│   │       ├── api/           # productApi.ts
│   │       ├── components/
│   │       │   ├── Layout/    # Top bar + nav layout
│   │       │   └── ui/        # re-exports from @logo-visualizer/shared
│   │       ├── lib/
│   │       │   └── utils.ts   # re-exports cn() from @logo-visualizer/shared
│   │       └── pages/
│   └── viewer/         # Embeddable logo viewer for end users / salespeople
│       └── src/
│           ├── api/           # viewerApi.ts
│           ├── components/
│           │   ├── LogoUploader/       # upload logos + assign/deselect per zone; client-side background removal
│           │   ├── TextLibrary/        # add / edit / remove text entries + assign/deselect per zone (merged picker)
│           │   ├── ProductCanvas/      # Konva canvas — logos + text per zone, shared Transformer, colour-count simulation
│           │   ├── ZoneSelector/
│           │   ├── TechniqueSelector/
│           │   ├── ColorCountSelector/ # number picker (1…maxColors) for colour-count print preview
│           │   └── ui/                 # re-exports from @logo-visualizer/shared
│           ├── lib/
│           │   └── utils.ts        # re-exports cn() from @logo-visualizer/shared
│           ├── types.ts            # viewer-only types: LogoEntry, TextEntry
│           └── App.tsx             # Product picker → logo/text library → zone assignment → canvas
└── packages/
    └── shared/         # Domain types + shared UI components + cn() utility
        └── src/
            ├── index.ts             # single export barrel
            ├── lib/
            │   ├── utils.ts         # cn() implementation
            │   └── techniqueFilters.ts  # Konva filter configs per technique slug (canonical source)
            └── components/
                └── ui/              # Button, Card, Badge, Input, Label
```

### Key files

| Path | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | Single export barrel — domain types (`Product`, `PrintZone`, `PrintTechnique`, …), `cn()` utility, `getTechniqueFilterConfig` + `TechniqueFilterConfig`, and all shared UI components (`Button`, `Card`, `Badge`, `Input`, `Label`). |
| `packages/shared/src/lib/utils.ts` | `cn()` implementation (clsx + tailwind-merge). Canonical source — both apps re-export from here. |
| `packages/shared/src/components/ui/` | Canonical UI component implementations. Both apps' `src/components/ui/` files are thin re-exports from `@logo-visualizer/shared`. Both apps' `tailwind.config.ts` include `../../packages/shared/src/**/*.{ts,tsx}` so Tailwind scans these files. |
| `apps/admin/src/api/productApi.ts` | All Admin → backend API calls. Includes `ensureToken()` which fetches a dev JWT on first write. All zone changes are batched and sent via `updateProduct()` (PUT with full product + zones list). `normalizeProduct()` normalises API responses, including mapping `allowedTechniques` from backend `{id, name}` objects to plain `PrintTechnique` strings. Also exports `uploadBumArtikel()` — public (no auth) upload of a bum-artikel image. `ZoneUpsertPayload` includes `imageUrl` so the per-zone side image is preserved on save. |
| `apps/admin/src/lib/techniqueFilters.ts` | Thin re-export from `@logo-visualizer/shared`. Canonical source is `packages/shared/src/lib/techniqueFilters.ts`. |
| `apps/viewer/src/api/viewerApi.ts` | All Viewer → backend API calls — `getMidoceanProducts()`, `getMidoceanProduct()`, `uploadLogo()`, `requestExportPng()`. Export sends `{ backgroundImageUrl, placements[], textPlacements[] }` — all visible zones in one request. |
| `apps/viewer/src/types.ts` | Viewer-only types: `LogoEntry { id, url, name }` and `TextEntry { id, text }`. Domain types (`Product`, `PrintZone`, …) still come from `@logo-visualizer/shared`. |
| `apps/admin/src/pages/ProductEditorPage.tsx` | Full product editor. Inline Konva canvas with **Forside/Bagside toggle** — the canvas image and visible zones switch between front and back side; clicking "Rediger" in the zone list auto-switches to the correct side. Front zones have `imageUrl === product.imageUrl`; back zones have a different `imageUrl` (auto-detected from existing zones, or entered manually via the URL field when no back zones exist yet). New zones drawn on the canvas get the current side's `imageUrl`. Click-drag on background draws a new zone (auto-enters edit mode); clicking an existing zone selects/highlights it; "Rediger zone" button enters per-zone edit mode. **Right arm zones are mirrored** to the correct visual side using `displayXForZone` — drag/transform handlers un-mirror back to raw coordinates before storing, matching the viewer's display behaviour. Inline zone form fields: name, position px (X/Y), size px, mm constraints, max colours, techniques, and **bum-artikel** (upload, remove-background, drag/resize on canvas, technique selector, colour count). Bum-artikel is stored on the zone (`bumArtikelUrl`, `bumArtikelFileId`, `bumArtikelX/Y/Width/Height`, `bumArtikelTechnique`, `bumArtikelColorCount`) and displayed locked in the viewer. "Gem ændringer" saves via `updateProduct()`. |
| `apps/viewer/src/components/ProductCanvas/` | Konva canvas — renders logos AND free text per zone. `focusedElement { zoneId, type: 'logo'\|'text' }` drives one shared Transformer. **Right arm zones** use `displayXForZone` to mirror zone and logo positions to the correct visual side; export coordinates use the mirrored display position (so PNG matches the canvas). **Export**: PNG export passes `allSideZones` so bum-artikler from inactive zones are included; placements include `colorCount`/`maxColors` for quantisation and `selectedTechniqueName` only when explicitly chosen (no fallback to `allowedTechniques[0]`). Bum-artikler apply the zone's `bumArtikelTechnique`/`bumArtikelColorCount` and mirror their X for right arm zones. `useMultipleImages` strips the localhost origin from image URLs so loaded images are same-origin and `node.cache()` (used by technique filters) does not taint the canvas. Colour-count simulation via `processImageForColors` (fetches via Vite proxy, offscreen canvas pixel manipulation). Side grouping (front/back) by `zone.name`. **Canvas technique preview** falls back to `zone.allowedTechniques[0]` when the user has not yet explicitly chosen a technique, so the visual effect is correct from the moment a logo is uploaded; the export payload only includes `selectedTechniqueName` when the user explicitly clicks a technique button. |
| `apps/viewer/src/lib/techniqueFilters.ts` | Thin re-export from `@logo-visualizer/shared`. Canonical source is `packages/shared/src/lib/techniqueFilters.ts`. |
| `apps/viewer/src/components/ZoneSelector/` | Multi-select zone picker. First click activates a zone; second click (while focused) removes it; clicking an active-but-unfocused zone focuses it without removing it. Deactivating a zone never auto-jumps focus to the next zone — focus is cleared instead. Same activate/focus/deactivate logic is also wired to the clickable zone outlines on the canvas. |
| `apps/viewer/src/web-component.ts` | Shadow DOM web component entry point (req V11 / NF1) |

---

## Tech stack

- **React 18** with functional components and hooks only (no class components)
- **TypeScript** – strict mode enabled in all packages
- **Vite 5** as the build tool / dev server
- **Tailwind CSS v3** + PostCSS + Autoprefixer for styling
- **class-variance-authority (CVA)** for type-safe component variants
- **clsx + tailwind-merge** via `cn()` helper for conditional class merging
- **lucide-react** for icons
- **react-konva + konva** for all canvas interaction
- **react-router-dom v6** for Admin routing
- **axios** for HTTP
- **npm workspaces** for the monorepo

---

## Design system

Both apps use the **b2b design system**, matching the look and feel of `b2b-promotion-ui`.

### Tailwind tokens (defined in each app's `tailwind.config.ts`)

| Token | Value |
|-------|-------|
| `primary` | `#ff6633` |
| `primary-foreground` | `#ffffff` |
| `foreground` | `#262626` |
| `muted-foreground` | `#6b7280` |
| `border` | `#e8e8e8` |
| `border-radius` | `0.5rem` |
| Font | **Inter** (Google Fonts, loaded in `index.css`) |

### UI components (`src/components/ui/`)

Shadcn/ui-style components built with CVA — **not** imported from a registry, built in-repo:

| Component | Variants | Apps |
|-----------|----------|------|
| `Button` | default, secondary, outline, ghost, destructive, link | both |
| `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter | both |
| `Input` | — | both |
| `Badge` | default, secondary, outline, destructive | both |
| `Label` | — | admin only |

---

## Active data source

Both apps call the **Midocean adapted endpoints** on the backend:

| Function | Endpoint |
|----------|----------|
| `getMidoceanProducts()` | `GET /api/midocean-products/as-products` |
| `getMidoceanProduct(id)` | `GET /api/midocean-products/{id}/as-product` |

Returns `Product[]` / `Product` matching the shared type directly. The backend serves this from the SQL Server database (DB-first) with automatic fallback to the JSON file. Zone `id` values are numeric DB integers serialised as strings (e.g. `"5"`) — not Midocean master codes.

---

## Conventions

- UI strings are in **Danish** (end-user facing). Code, comments, and variable names are in **English**.
- All domain types come from `@logo-visualizer/shared`. Never duplicate type definitions across apps.
- Requirement IDs are referenced in component comments (e.g. `// A2 – draw print zone`, `// V4 – drag logo`).
- Components live in `src/components/<ComponentName>/<ComponentName>.tsx` (one component per folder).
- API functions are in `src/api/*.ts` – keep them as thin wrappers; no UI logic.
- No default exports – use named exports everywhere.
- Use `cn()` from `src/lib/utils.ts` for all conditional class merging — never template strings.

---

## Running locally

```bash
npm install              # from frontend/ root
npm run dev:admin        # http://localhost:5173
npm run dev:viewer       # http://localhost:5174
```

Both apps proxy `/api/*` to `http://localhost:5000`.

---

## Requirement mapping (quick reference)

| ID | Where |
|----|-------|
| A1 | `ProductEditorPage` – product image upload |
| A2–A4 | Inline canvas in `ProductEditorPage` — draw new zones by click-drag, click to select/highlight, "Rediger zone" enters per-zone drag/resize mode; all changes are local until "Gem ændringer" |
| A5 | `ProductsPage` – import JSON |
| A6 | `ProductsPage` – export JSON |
| A7 | `ProductsPage` – product list with search filter |
| A8 | `productApi.ts` – `updateProduct()` sends the full product + zone list in one PUT from `ProductEditorPage.handleSaveAll()`; backend diffs the zone list (creates/updates/deletes); auth token via `ensureToken()` |
| V1 | `LogoUploader` component — upload + per-zone assign/deselect in one UI; `LogoEntry { id, url, name }` in `types.ts`. "Fjern baggrund" flood-fills the background client-side, then **re-uploads** the processed blob to the backend so the export uses the background-removed version (not the original file). |
| V2–V6 | `ProductCanvas` component — zone outlines clickable to activate/focus/deactivate; clicking outside a zone or on the product background clears element focus; side grouping by name; logos + text constrained to zone; shared Transformer handles both element types |
| V3 | `ZoneSelector` component + clickable zone outlines on canvas |
| V7 | `TechniqueSelector` component + `ColorCountSelector` component — shown when the active zone has `maxColors > 0`; previews the logo with 1 colour (black), 2 colours (grayscale), or posterised intermediate steps up to `maxColors` (full colour). No count is pre-selected — filter only activates on explicit click; selecting `maxColors` restores the original logo. |
| V8 | "Download som PNG" and "Download som PDF" buttons call `canvasRef.current.exportPng/Pdf()` via `ProductCanvasHandle` ref; `ProductCanvas` builds the payload with logo placements (position + size + technique + colorCount), bum-artikel placements from all side zones, and text placements, then POSTs to `/api/export/png` or `/api/export/pdf` |
| —  | `TextLibrary` — free-text entry + per-zone assign/deselect (merged from former `TextPicker`); `TextEntry { id, text }` in `types.ts`; text placed on canvas as Konva `Text`, draggable within zone, font size/colour configurable |
| V10 | `main.tsx` – URL param `?logo=…&product=…` |
| V11 / NF1 | `web-component.ts` – shadow DOM custom element |

---

## Out of scope (do not implement)

- 3D rendering
- Automatic logo vectorisation
- PMS colour matching
- Authentication inside the Viewer app (handled by Master application for Admin)
