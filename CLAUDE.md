# CLAUDE.md – Logo Visualizer Frontend

This file gives Claude (and other AI assistants) the context needed to work effectively in this repository.

---

## Project overview

Bachelor project: **Logo Visualizer & Product Setup Tool**

A React + TypeScript monorepo that is the **frontend** component of a standalone service for visualising customer logos on promotional merchandise products (t-shirts, mugs, pens, etc.).

The backend is a separate .NET / ASP.NET Core project (`LogoVisualizer.Api`) that runs at `http://localhost:5000` during development. **No database is required** — the backend serves all product data from a Midocean JSON file.

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
│   │       │   ├── ZoneEditor/
│   │       │   ├── ZoneForm/
│   │       │   └── ui/        # button, card, input, badge, label
│   │       ├── lib/
│   │       │   └── utils.ts   # cn() helper
│   │       └── pages/
│   └── viewer/         # Embeddable logo viewer for end users / salespeople
│       └── src/
│           ├── api/           # viewerApi.ts
│           ├── components/
│           │   ├── LogoUploader/
│           │   ├── ProductCanvas/
│           │   ├── ZoneSelector/
│           │   ├── TechniqueSelector/
│           │   └── ui/        # button, card, badge
│           ├── lib/
│           │   └── utils.ts   # cn() helper
│           └── App.tsx        # Product picker → logo + canvas flow
└── packages/
    └── shared/         # Shared TypeScript types only (no runtime code)
```

### Key files

| Path | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | Single source of truth for all domain types (`Product`, `PrintZone`, `PrintTechnique`, …) |
| `apps/admin/src/api/productApi.ts` | All Admin → backend API calls — `getMidoceanProducts()`, `getMidoceanProduct()` as primary; DB functions exist but require DB |
| `apps/viewer/src/api/viewerApi.ts` | All Viewer → backend API calls — `getMidoceanProducts()`, `getMidoceanProduct()` |
| `apps/admin/src/lib/utils.ts` | `cn()` — merges Tailwind classes via clsx + tailwind-merge |
| `apps/viewer/src/lib/utils.ts` | Same `cn()` helper |
| `apps/admin/src/components/ZoneEditor/` | Konva canvas for drawing rectangular print zones (req A2). Uses each zone's `imageUrl` as the canvas background per view — FRONT tab shows the FRONT position image, BACK tab shows the BACK position image. ARM zones display on the front tab; ARM RIGHT x is mirrored so it appears on the correct sleeve side. |
| `apps/viewer/src/components/ProductCanvas/` | Konva canvas for logo drag/scale/constrain (req V2–V6). Supports multiple active zones simultaneously — each zone keeps its own `LogoState` (`Record<string, LogoState>`). The viewed side (`viewedZoneId`) and the print zone being edited (`focusedZoneId`) are decoupled. Only logos whose zone image matches the viewed side are rendered; the focused logo gets a Konva `Transformer` (4 corners, aspect-ratio locked, rotation disabled, hard-clamped to zone boundary via `boundBoxFunc`). |
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

| Component | Variants |
|-----------|----------|
| `Button` | default, secondary, outline, ghost, destructive, link |
| `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `Input` | — |
| `Badge` | default, secondary, outline, destructive |
| `Label` | — |

---

## Active data source

Both apps call the **Midocean adapted endpoints** on the backend:

| Function | Endpoint |
|----------|----------|
| `getMidoceanProducts()` | `GET /api/midocean-products/as-products` |
| `getMidoceanProduct(id)` | `GET /api/midocean-products/{id}/as-product` |

Returns `Product[]` / `Product` matching the shared type directly. No database is needed.

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
| A2–A4 | `ZoneEditor` component – draw/edit/delete zones |
| A5 | `ProductsPage` – import JSON (DB-backed, not active) |
| A6 | `ProductsPage` – export JSON (DB-backed, not active) |
| A7 | `ProductsPage` – product list |
| A8 | `productApi.ts` – all mutations go through backend |
| V1 | `LogoUploader` component |
| V2–V6 | `ProductCanvas` component — `product` prop passed directly from `App` |
| V3 | `ZoneSelector` component |
| V7 | `TechniqueSelector` component |
| V8 | `ProductCanvas.handleExportPng()` |
| V10 | `main.tsx` – URL param `?logo=…&product=…` |
| V11 / NF1 | `web-component.ts` – shadow DOM custom element |

---

## Out of scope (do not implement)

- 3D rendering
- Automatic logo vectorisation
- PMS colour matching
- PDF export (nice-to-have, not MVP)
- Authentication inside the Viewer app (handled by Master application for Admin)
