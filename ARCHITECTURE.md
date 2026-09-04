# ARCHITECTURE

Planned technical design for **3D ULPIN** — a prototype for 3D ULPIN and vertical property mapping.

This document describes the intended shape of the system. It is written before the code exists, so that each later phase has something to be checked against. It will be updated whenever a decision actually changes.

---

## 1. High-level architecture

The prototype is a **single-page browser application with no server**. Everything runs in the user's browser; the data ships with the app as static files.

```
                    ┌──────────────────────────────────────────┐
                    │        Browser (single-page app)         │
                    │                                          │
   demo data  ────► │  ┌────────────┐      ┌────────────────┐  │
  (static JSON,     │  │  Map view  │◄────►│   3D view      │  │
   bundled)         │  │  Leaflet   │      │  Three.js /    │  │
                    │  │  2D plots  │      │  R3F, extruded │  │
                    │  └─────┬──────┘      │  floors/units  │  │
                    │        │             └───────┬────────┘  │
                    │        └──────┬──────────────┘           │
                    │               ▼                          │
                    │      shared selection state              │
                    │   (selected parcel / floor / unit)       │
                    │               │                          │
                    │               ▼                          │
                    │      ULPIN detail panel                  │
                    │  (3D ULPIN string + attributes)          │
                    └──────────────────────────────────────────┘
```

**The core idea being demonstrated:** a normal ULPIN identifies a parcel of land on a flat map. A *3D* ULPIN extends that identifier with a vertical component — block / floor / unit — so a specific apartment in a tower has its own unique, resolvable ID. The app shows the same property in two linked views (a 2D map and a 3D model) and lets the user click through to the identifier and its attributes.

### Layers

| Layer | Responsibility |
|---|---|
| **Data layer** | Loads the bundled demo dataset; exposes typed lookup helpers (parcel → building → floors → units). Pure functions, no UI. |
| **State layer** | Holds the current selection (which parcel, floor, unit) and view mode. Both the map and the 3D scene read from and write to it, which is what keeps them in sync. |
| **View layer** | Three cooperating pieces: the Leaflet map, the Three.js/R3F 3D scene, and the ULPIN detail panel. |
| **ULPIN layer** | Encodes and decodes the 3D ULPIN string from its parts, and validates it. Kept separate because it is the actual subject of the project. |

---

## 2. Technology choices

### Frontend: React + Vite + TypeScript

- **React** — the UI is a small number of components whose content depends on one piece of shared state (the current selection). React's model fits this directly.
- **Vite** — fast dev server with instant reload, and a plain static build output, which is exactly what a no-backend app needs for deployment.
- **TypeScript** — the data has a nested shape (parcel → building → floor → unit) and a strict ULPIN format. Types catch mistakes at edit time instead of during a demo.

### 3D visualization: Three.js / React Three Fiber

- **Three.js** is the standard WebGL library for 3D in the browser.
- **React Three Fiber (R3F)** lets the 3D scene be written as React components, so the 3D view and the rest of the UI share the same state and the same mental model instead of being two separate systems.
- Buildings are rendered as extruded footprints split into floor slabs; each slab is clickable and maps to a floor-level (or unit-level) ULPIN.

### GIS / 2D map: Leaflet

- Lightweight, no API key, works with free tile providers, and handles the standard GIS primitives the prototype needs: base map tiles, GeoJSON polygons for parcel boundaries, markers and popups.
- Leaflet gives the horizontal (real-world location) half of the story; Three.js gives the vertical half. Together they are the "3D" in 3D ULPIN.

### Data: local structured demo data

- The prototype ships with **hand-authored structured demo data** (JSON/GeoJSON in the repo) covering a small number of parcels and one or two multi-storey buildings.
- Reasons: no database or auth to set up, the demo is identical on every machine, it is fast, and it works offline during judging.
- The data is deliberately shaped like something a real registry could return, so a real API can be swapped in later without changing the components.

### Backend: none initially

- Nothing in the prototype requires a server: no login, no writes, no data too large to bundle.
- Adding a backend now would cost hosting, deployment complexity and debugging time for zero visible gain in the demo.
- If it is ever needed, the data layer is the single seam to replace — the components ask the data layer for information, not a specific file.

### Deployment target: GitHub + Vercel

- The repo lives on **GitHub**; **Vercel** builds and hosts it from that repo.
- A Vite static build is what Vercel deploys best, and every push produces a public URL — so there is always a shareable, working link rather than a project that only runs on one laptop.

---

## 3. Repository shape

### As scaffolded (Phase 1 — this exists now)

```
3d-ulpin/
├─ PROJECT_STATUS.md      # where the project stands right now
├─ ARCHITECTURE.md        # this file
├─ .gitignore             # excludes node_modules/, dist/, env files
├─ index.html             # the single HTML page Vite serves; holds <div id="root">
├─ package.json           # dependencies + the dev/build/preview scripts
├─ tsconfig.json          # one TypeScript config, covering src/ and vite.config.ts
├─ vite.config.ts         # Vite config; enables the React plugin
└─ src/
   ├─ main.tsx            # entry point: mounts <App> into #root
   ├─ App.tsx             # the whole UI for this phase (title / subtitle / status)
   ├─ index.css           # dark theme; global styles
   └─ vite-env.d.ts       # tells TypeScript about Vite-specific imports (e.g. CSS)
```

Deliberately **not** included, to keep the foundation small: no ESLint config, no
`App.css`, and none of the Vite starter assets or demo counter component.

### Planned additions (later phases)

```
src/
├─ types/                 # Parcel, Building, Floor, Unit, Ulpin3D
├─ data/                  # demo dataset + typed loaders
├─ ulpin/                 # encode / decode / validate the 3D ULPIN
├─ map/                   # Leaflet components
├─ scene/                 # Three.js / R3F components
└─ ui/                    # detail panel, controls, layout
```

### Toolchain as pinned in `package.json`

| Package | Range | Role |
|---|---|---|
| `react`, `react-dom` | `^19.1.0` | UI library and its browser renderer |
| `vite` | `^7.0.0` | dev server and production bundler |
| `@vitejs/plugin-react` | `^5.0.0` | teaches Vite to compile JSX and enable fast refresh |
| `typescript` | `^5.9.0` | type checking (`tsc --noEmit`, run as part of `npm run build`) |
| `@types/react`, `@types/react-dom` | `^19.1.0` | type definitions for React |

`npm run build` runs `tsc --noEmit && vite build`, so a type error fails the build
rather than shipping silently — Vite alone strips types without checking them.

---

## 4. Why we are building incrementally

The build is split into small phases, and **each phase must leave the project runnable, documented and committed** before the next one starts.

1. **This is a 48-hour prototype.** The real risk is not writing too little code — it is having a large amount of code that does not run an hour before the deadline. Small steps mean the broken thing is always the last small thing.
2. **Every phase is a recoverable checkpoint.** A commit that runs is a point to return to. Without checkpoints, a bad change means unpicking it by hand under time pressure.
3. **There is always something to demo.** From Phase 1 onward the project has a working URL. If time runs out, the prototype is smaller than planned but still complete and presentable — never half-built.
4. **Understanding, not just output.** Each phase is small enough to read, explain and defend to a judge. The point of the project is to understand the architecture, and that only happens if each piece is absorbed as it lands.
5. **Documentation stays true.** `PROJECT_STATUS.md` is updated at each checkpoint, so the project's state is a fact that has been verified, not a memory.
