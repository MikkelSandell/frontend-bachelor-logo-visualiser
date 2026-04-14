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
└── packages/shared/ # Domain types only – Product, PrintZone, PrintTechnique
```

## Rules Copilot must follow

- **Language**: UI strings in Danish. All code, identifiers, and comments in English.
- **Types**: All domain types come from `@logo-visualizer/shared`. Never redefine `Product`, `PrintZone`, or `PrintTechnique` locally.
- **Exports**: Named exports only – no default exports.
- **Components**: One component per folder: `src/components/<Name>/<Name>.tsx`.
- **API layer**: HTTP calls live in `src/api/*.ts` only. Components must not call `axios` directly.
- **Canvas**: Use `react-konva` and `konva` for all canvas / drag / transform needs.
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
