---
applyTo: "**"
---

# Logo Visualizer – Frontend

Bachelor project: embeddable logo visualiser and admin product-setup tool for promotional merchandise.

## Workspace layout

```
frontend/
├── apps/admin/      # LogoVisualizer.Admin  (Vite + React + TS, port 5173)
├── apps/viewer/     # LogoVisualizer.Viewer (Vite + React + TS, port 5174)
│   └── src/
│       ├── types.ts              # LogoEntry { id, url, name }, TextEntry { id, text }
│       ├── components/
│       │   ├── LogoUploader/     # multi-logo library (upload / remove)
│       │   ├── LogoPicker/       # assign logo to focused zone (shown when logos > 1)
│       │   ├── TextLibrary/      # add / edit (double-click) / remove text entries
│       │   ├── TextPicker/       # assign text to focused zone (shown when texts > 1)
│       │   ├── ProductCanvas/    # Konva canvas — logos + text, shared Transformer
│       │   ├── ZoneSelector/
│       │   └── TechniqueSelector/
│       └── api/viewerApi.ts      # getMidoceanProducts, uploadLogo, requestExportPng
└── packages/shared/ # Domain types only – Product, PrintZone, PrintTechnique
```

## Data source

No database is required. All product data comes from the backend's Midocean JSON endpoints:
- `GET /api/midocean-products/as-products` — list of all products
- `GET /api/midocean-products/{id}/as-product` — single product

Use `getMidoceanProducts()` and `getMidoceanProduct(id)` from each app's `api/` module.

## Design system

Both apps use the **b2b design system**. Key Tailwind tokens:
- `primary`: `#ff6633` (brand orange)
- `foreground`: `#262626`
- `border`: `#e8e8e8`
- `border-radius`: `0.5rem`
- Font: **Inter**

UI components live in `src/components/ui/` (Button, Card, Input, Badge, Label). Use CVA variants. Use `cn()` from `src/lib/utils.ts` for class merging — never string templates.

## Rules Copilot must follow

- **Language**: UI strings in Danish. All code, identifiers, and comments in English.
- **Types**: All domain types come from `@logo-visualizer/shared`. Never redefine `Product`, `PrintZone`, or `PrintTechnique` locally. `PrintZone` includes an `imageUrl` field — the blank product photo for that specific print position (same colour across all zones).
- **Exports**: Named exports only – no default exports.
- **Components**: One component per folder: `src/components/<Name>/<Name>.tsx`.
- **API layer**: HTTP calls live in `src/api/*.ts` only. Components must not call `axios` directly.
- **Styling**: Use Tailwind utility classes. Use `cn()` for conditional merging. Do not use inline styles or CSS modules.
- **Canvas**: Use `react-konva` and `konva` for all canvas / drag / transform needs.
  - `ZoneEditor` (admin): uses each `PrintZone.imageUrl` as the canvas background for the matching view tab. ARM zones are shown on the front tab; ARM RIGHT x-coordinate is mirrored (`imageWidth - x - width`) so it renders on the correct sleeve side. Clicking a zone selects/highlights it; the zone only becomes draggable/resizable after the user explicitly presses "Rediger zone" — only that specific zone enters edit mode. Zone names are rendered as Konva `Text` labels. All zone changes (create/update/delete) are local-only and batched to the backend only when the user presses "Gem ændringer" on `ProductEditorPage`.
  - `ProductCanvas` (viewer): renders **logos and free text** per zone. A single shared `Transformer` attaches to whichever element (`focusedElement: { zoneId, type: 'logo'|'text' }`) is clicked last. Logos use 4 corner anchors + `keepRatio=true`; text uses all 8 anchors + free scale (updates `fontSize` in product-px). Zone boundary enforced in `dragBoundFunc` and `boundBoxFunc` for both element types. `TextState { x, y, fontSize, color }` stored per zone; font controls (size slider + colour picker) rendered below the canvas when a text element is focused. Export sends all visible logo placements (`ZonePlacement[]`) and text placements (`TextPlacement[]`) to `POST /api/export/png` in one request.
- **State**: React hooks only. No class components. No external state library unless explicitly requested.
- **Routing**: `react-router-dom` v6 in Admin. Viewer has no router.
- **Strict TS**: `strict: true` is set in every tsconfig. Do not use `any` or non-null assertion (`!`) without a comment explaining why.
- **Security**: Never log, expose, or store authentication tokens or user data in localStorage without encryption.
- **No over-engineering**: Only implement what is directly asked. Do not add extra abstractions, helpers, or features beyond the request.

## Requirement IDs (reference in comments where relevant)

Admin: A1–A8 | Viewer: V1–V11 | Backend contracts: B1–B5 | Non-functional: NF1–NF6

## Dev commands

```bash
npm install           # from frontend/ root
npm run dev:admin     # http://localhost:5173
npm run dev:viewer    # http://localhost:5174
npm run build         # build both apps
npm run type-check    # TS check all packages
```

Backend API runs at `http://localhost:5000`; both dev servers proxy `/api/*` there.

## Out of scope – never generate code for these

- 3D rendering
- Automatic SVG vectorisation of bitmap logos
- PMS / Pantone colour matching
- Authentication inside the Viewer (handled externally by the Master application)
