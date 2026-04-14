# CLAUDE.md – Logo Visualizer Frontend

This file gives Claude (and other AI assistants) the context needed to work effectively in this repository.

---

## Project overview

Bachelor project: **Logo Visualizer & Product Setup Tool**

A React + TypeScript monorepo that is the **frontend** component of a standalone service for visualising customer logos on promotional merchandise products (t-shirts, mugs, pens, etc.).

The backend is a separate .NET / ASP.NET Core project (`LogoVisualizer.Api`) that runs at `http://localhost:5000` during development.

---

## Workspace structure

```
frontend/
├── apps/
│   ├── admin/          # Internal admin tool – product & print zone setup
│   └── viewer/         # Embeddable logo viewer for end users / salespeople
└── packages/
    └── shared/         # Shared TypeScript types only (no runtime code)
```

### Key files

| Path | Purpose |
|------|---------|
| `packages/shared/src/index.ts` | Single source of truth for all domain types (`Product`, `PrintZone`, `PrintTechnique`, …) |
| `apps/admin/src/api/productApi.ts` | All Admin → backend API calls (axios) |
| `apps/viewer/src/api/viewerApi.ts` | All Viewer → backend API calls (axios) |
| `apps/admin/src/components/ZoneEditor/` | Konva canvas for drawing rectangular print zones (req A2) |
| `apps/viewer/src/components/ProductCanvas/` | Konva canvas for logo drag/scale/constrain (req V2–V6) |
| `apps/viewer/src/web-component.ts` | Shadow DOM web component entry point (req V11 / NF1) |

---

## Tech stack

- **React 18** with functional components and hooks only (no class components)
- **TypeScript** – strict mode enabled in all packages
- **Vite 5** as the build tool / dev server
- **react-konva + konva** for all canvas interaction
- **react-router-dom v6** for Admin routing
- **axios** for HTTP
- **npm workspaces** for the monorepo

---

## Conventions

- UI strings are in **Danish** (end-user facing). Code, comments, and variable names are in **English**.
- All domain types come from `@logo-visualizer/shared`. Never duplicate type definitions across apps.
- Requirement IDs are referenced in component comments (e.g. `// A2 – draw print zone`, `// V4 – drag logo`).
- Components live in `src/components/<ComponentName>/<ComponentName>.tsx` (one component per folder).
- API functions are in `src/api/*.ts` – keep them as thin wrappers; no UI logic.
- No default exports – use named exports everywhere.

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
| A5 | `ProductsPage` – import JSON |
| A6 | `ProductsPage` – export JSON |
| A7 | `ProductsPage` – product list with status |
| A8 | `productApi.ts` – all mutations go through backend |
| V1 | `LogoUploader` component |
| V2–V6 | `ProductCanvas` component |
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
