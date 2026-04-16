# Logo Visualizer – Frontend

Frontend monorepo for the **Logo Visualizer & Product Setup Tool** bachelor project.

Built with **React 18 + TypeScript + Vite**, structured as an npm workspace with two deployable apps and a shared types package.

---

## Repository layout

```
frontend/
├── apps/
│   ├── admin/          # LogoVisualizer.Admin  – internal product setup tool
│   │   ├── src/
│   │   │   ├── api/           # productApi.ts — Midocean + DB-backed calls
│   │   │   ├── components/
│   │   │   │   ├── Layout/    # Top bar + nav (b2b-style)
│   │   │   │   ├── ZoneEditor/
│   │   │   │   ├── ZoneForm/
│   │   │   │   └── ui/        # button, card, input, badge, label
│   │   │   ├── lib/
│   │   │   │   └── utils.ts   # cn() — clsx + tailwind-merge
│   │   │   └── pages/
│   │   │       ├── ProductsPage.tsx
│   │   │       └── ProductEditorPage.tsx
│   │   ├── tailwind.config.ts
│   │   └── postcss.config.cjs
│   └── viewer/         # LogoVisualizer.Viewer – embeddable logo visualiser
│       ├── src/
│       │   ├── api/           # viewerApi.ts — Midocean calls
│       │   ├── components/
│       │   │   ├── LogoUploader/
│       │   │   ├── ProductCanvas/
│       │   │   ├── ZoneSelector/
│       │   │   ├── TechniqueSelector/
│       │   │   └── ui/        # button, card, badge
│       │   ├── lib/
│       │   │   └── utils.ts   # cn()
│       │   └── App.tsx        # Product picker → logo + canvas flow
│       ├── tailwind.config.ts
│       └── postcss.config.cjs
└── packages/
    └── shared/         # Shared TypeScript types (Product, PrintZone, …)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 LTS |
| npm | ≥ 10 (ships with Node 20) |

The .NET backend (`LogoVisualizer.Api`) must be running on `http://localhost:5000` for API calls to work during development. **No database is required** — the backend serves all product data from a Midocean JSON file.

---

## Getting started

```bash
# 1. Install all workspace dependencies from the frontend/ root
npm install

# 2a. Start the Admin app (http://localhost:5173)
npm run dev:admin

# 2b. Start the Viewer app (http://localhost:5174)
npm run dev:viewer
```

Both dev servers proxy `/api/*` requests to the backend at `http://localhost:5000`.

---

## Available scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev:admin` | Vite dev server for Admin app |
| `npm run dev:viewer` | Vite dev server for Viewer app |
| `npm run build` | Production build of both apps |
| `npm run build:admin` | Production build – Admin only |
| `npm run build:viewer` | Production build – Viewer (iframe mode) |
| `npm run type-check` | TypeScript check across all packages |

### Viewer-specific: Web Component build

```bash
cd apps/viewer
npm run build:wc
```

Produces `dist-wc/logo-viewer.iife.js` – a self-contained bundle that registers
`<logo-viewer>` as a custom element with shadow DOM isolation (requirement NF1 / V11).

---

## Design system

Both apps use the **b2b design system** — matching the look and feel of the production `b2b-promotion-ui` frontend.

### Key tokens (defined in `tailwind.config.ts`)

| Token | Value |
|-------|-------|
| `primary` | `#ff6633` (brand orange) |
| `foreground` | `#262626` |
| `muted-foreground` | `#6b7280` |
| `border` | `#e8e8e8` |
| `border-radius` | `0.5rem` |
| Font | **Inter** (Google Fonts) |

### UI component library (`src/components/ui/`)

Built from scratch using Tailwind CSS v3 + `class-variance-authority`. Mirrors the shadcn/ui API.

| Component | Variants |
|-----------|----------|
| `Button` | default, secondary, outline, ghost, destructive, link |
| `Card` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `Input` | — |
| `Badge` | default, secondary, outline, destructive |
| `Label` | — |

The `cn()` helper in `src/lib/utils.ts` merges Tailwind classes safely (clsx + tailwind-merge).

---

## Data source

Both apps talk to the **Midocean product endpoints** on the backend — no database required:

| Call | Endpoint |
|------|----------|
| List all products | `GET /api/midocean-products/as-products` |
| Single product by ID | `GET /api/midocean-products/{masterCode}/as-product` |

Products are adapted from raw Midocean supplier data. Each has a CDN image URL, pixel dimensions (assumed 1000×1000), and one or more print zones with coordinates, physical size limits, and allowed techniques.

---

## Embedding the Viewer

### Option A – iframe

```html
<iframe
  src="https://your-host/viewer/?product=PRODUCT_ID&logo=LOGO_URL"
  width="800"
  height="600"
  style="border:none"
></iframe>
```

### Option B – Web Component

```html
<script src="https://your-host/viewer/logo-viewer.iife.js"></script>
<logo-viewer product-id="PRODUCT_ID" logo="LOGO_URL"></logo-viewer>
```

---

## Environment / configuration

Both apps resolve the API base URL from Vite's dev-proxy configuration.
For production builds, set **`VITE_API_BASE_URL`** in a `.env` file:

```env
VITE_API_BASE_URL=https://api.your-host.com
```

> `.env` files are git-ignored. Never commit secrets.

---

## Project spec reference

See `kravspecifikation.pdf` for full requirements. Requirement IDs used in code comments:

- **A1–A8** – Admin Tool functional requirements
- **V1–V11** – Logo Viewer functional requirements
- **B1–B5** – Backend / API requirements
- **NF1–NF6** – Non-functional requirements

---

## Tech decisions

| Concern | Choice | Reason |
|---------|--------|--------|
| Canvas / interaction | [Konva](https://konvajs.org/) + react-konva | Mature, supports drag/transform, easy PNG export |
| Routing (Admin) | react-router-dom v6 | Standard, lightweight |
| HTTP client | axios | Consistent error handling, easy interceptors for future auth |
| Styling | Tailwind CSS v3 + custom tokens | Matches b2b production frontend; utility-first, easy to maintain |
| Component variants | class-variance-authority (CVA) | Type-safe variant API without runtime overhead |
| Monorepo | npm workspaces | Zero extra tooling, resolves `@logo-visualizer/shared` locally |
