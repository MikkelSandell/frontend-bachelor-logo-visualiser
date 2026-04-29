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
│           │   ├── LogoUploader/   # multi-logo library (upload / remove)
│           │   ├── LogoPicker/     # assign a logo to the focused zone (shown when logos > 1)
│           │   ├── TextLibrary/    # add / edit / remove text entries
│           │   ├── TextPicker/     # assign a text to the focused zone (shown when texts > 1)
│           │   ├── ProductCanvas/  # Konva canvas — logos + text per zone, shared Transformer
│           │   ├── ZoneSelector/
│           │   ├── TechniqueSelector/
│           │   └── ui/             # re-exports from @logo-visualizer/shared
│           ├── lib/
│           │   └── utils.ts        # re-exports cn() from @logo-visualizer/shared
│           ├── types.ts            # viewer-only types: LogoEntry, TextEntry
│           └── App.tsx             # Product picker → logo/text library → zone assignment → canvas
└── packages/
    └── shared/         # Domain types + shared UI components + cn() utility
        └── src/
            ├── index.ts             # single export barrel
            ├── lib/
            │   └── utils.ts         # cn() implementation
            └── components/
                └── ui/              # Button, Card, Badge, Input, Label
```

### Key files

| Path | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | Single export barrel — domain types (`Product`, `PrintZone`, `PrintTechnique`, …), `cn()` utility, and all shared UI components (`Button`, `Card`, `Badge`, `Input`, `Label`). |
| `packages/shared/src/lib/utils.ts` | `cn()` implementation (clsx + tailwind-merge). Canonical source — both apps re-export from here. |
| `packages/shared/src/components/ui/` | Canonical UI component implementations. Both apps' `src/components/ui/` files are thin re-exports from `@logo-visualizer/shared`. Both apps' `tailwind.config.ts` include `../../packages/shared/src/**/*.{ts,tsx}` so Tailwind scans these files. |
| `apps/admin/src/api/productApi.ts` | All Admin → backend API calls. Includes `ensureToken()` which fetches a dev JWT on first write. All zone changes are batched and sent via `updateProduct()` (PUT with full product + zones list); individual `createZone`/`updateZone`/`deleteZone` also exist for direct use. `normalizeProduct()` normalises API responses, including mapping `allowedTechniques` from backend `{id, name}` objects to plain `PrintTechnique` strings. |
| `apps/viewer/src/api/viewerApi.ts` | All Viewer → backend API calls — `getMidoceanProducts()`, `getMidoceanProduct()`, `uploadLogo()`, `requestExportPng()`. Export sends `{ backgroundImageUrl, placements[], textPlacements[] }` — all visible zones in one request. |
| `apps/viewer/src/types.ts` | Viewer-only types: `LogoEntry { id, url, name }` and `TextEntry { id, text }`. Domain types (`Product`, `PrintZone`, …) still come from `@logo-visualizer/shared`. |
| `apps/admin/src/pages/ProductEditorPage.tsx` | Full product editor. Inline Konva canvas: click-drag on background draws a new zone (auto-enters edit mode); clicking an existing zone selects/highlights it; "Rediger zone" button enters per-zone edit mode (only that zone draggable/resizable via Transformer). Inline zone form shows only while editing — fields: name, position px (X/Y), size px (Bredde/Højde), mm constraints, max colours, techniques. Product metadata (title, image) is collapsed behind "Rediger metadata" toggle. "Gem ændringer" saves everything via `updateProduct()`. "Slet produkt" deletes with confirmation and navigates back. |
| `apps/viewer/src/components/ProductCanvas/` | Konva canvas — renders logos AND free text per zone. `focusedElement { zoneId, type: 'logo'\|'text' }` drives one shared Transformer: logos use corner anchors + keepRatio; text uses all 8 anchors + free scale (updates `fontSize`). Font size (8–96 product-px) and colour controls appear below the canvas when a text element is focused. Export collects all visible logo and text placements and sends them to `POST /api/export/png` in a single request. Zone outlines always visible; side grouping (front/back) by `zone.name`; arm/right-arm detection by name. |
| `apps/viewer/src/components/ZoneSelector/` | Multi-select zone picker. First click activates a zone; second click (while focused) removes it; clicking an active-but-unfocused zone focuses it without removing it. |
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
| V1 | `LogoUploader` component — multi-logo library; `LogoEntry { id, url, name }` in `types.ts`; `LogoPicker` assigns logo to focused zone when multiple logos exist |
| V2–V6 | `ProductCanvas` component — zone outlines always visible; side grouping by name; logos + text constrained to zone; shared Transformer handles both element types |
| V3 | `ZoneSelector` component |
| V7 | `TechniqueSelector` component |
| V8 | `ProductCanvas.handleExportPng()` — sends all visible placements (logos + text) to backend in one call |
| —  | `TextLibrary` + `TextPicker` — free-text entry; `TextEntry { id, text }` in `types.ts`; text placed on canvas as Konva `Text`, draggable within zone, font size/colour configurable |
| V10 | `main.tsx` – URL param `?logo=…&product=…` |
| V11 / NF1 | `web-component.ts` – shadow DOM custom element |

---

## Out of scope (do not implement)

- 3D rendering
- Automatic logo vectorisation
- PMS colour matching
- PDF export (nice-to-have, not MVP)
- Authentication inside the Viewer app (handled by Master application for Admin)
