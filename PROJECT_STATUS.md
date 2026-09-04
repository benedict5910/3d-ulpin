# PROJECT_STATUS

**Project name:** 3D ULPIN

**Goal:** SIH prototype for 3D ULPIN and vertical property mapping — a demonstrable system that extends the flat, parcel-level ULPIN idea into three dimensions so that individual floors/units in a vertical building can each be identified, located and inspected.

**Current phase:** Phase 2 – first interactive 3D scene

**Local repo path:** `C:\Users\Admin\Projects\3d-ulpin`

---

## Environment

| Tool | Version | Notes |
|---|---|---|
| Node.js | v24.18.0 | Comfortably above Vite's minimum. |
| npm | 11.16.0 | Ships with this Node; the package manager for this project. |
| Git branch | `main` | Local default for this repo and, globally, for future repos. |

*Reported by the developer on 2026-09-04. If the build ever behaves oddly, re-check these first — a Node mismatch is the usual cause.*

---

## Completed — Phase 0 (project setup)

- [x] Repository exists at `C:\Users\Admin\Projects\3d-ulpin`, Git initialized, no remote yet
- [x] Branch renamed `master` → `main`; `init.defaultBranch = main` set globally
- [x] `PROJECT_STATUS.md` and `ARCHITECTURE.md` written
- [x] Toolchain versions recorded

## Completed — Phase 1 (frontend foundation)

- [x] Vite + React + TypeScript app scaffolded directly in the existing repository
- [x] `PROJECT_STATUS.md` and `ARCHITECTURE.md` preserved through the scaffold
- [x] `.gitignore` added (`node_modules/`, `dist/`, env files, editor/OS noise, `.vercel/`)
- [x] Vite starter content removed — no counter demo, no `App.css`, no starter SVGs, no ESLint config
- [x] Minimal dark UI with title **3D ULPIN**, subtitle **Vertical Property & Spatial Cadastre Platform**, status **Prototype Environment Ready**
- [x] Single `tsconfig.json` in `strict` mode; `npm run build` = `tsc --noEmit && vite build`

## Completed — Phase 2 (first interactive 3D scene)

- [x] Three 3D dependencies added to `package.json` and nothing else: `three`, `@react-three/fiber`, `@react-three/drei` (plus `@types/three` for type checking)
- [x] `src/scene/` created — all 3D code lives there, isolated from the page shell
- [x] `src/scene/SceneViewer.tsx` — the `<Canvas>`: perspective camera (`fov: 45`, positioned at `[10, 8, 12]`), scene background and distance fog, shadows enabled
- [x] Lighting — `ambientLight` (flat fill, intensity 0.4) + `directionalLight` (sun-like, intensity 2, casts shadows)
- [x] `src/scene/Building.tsx` — one placeholder box, **3 × 9 × 3** units, so clearly taller than it is wide; lifted by half its height so its base sits on the ground
- [x] `src/scene/Ground.tsx` — a 60 × 60 ground plane at `y = 0` plus a faint reference grid
- [x] `OrbitControls` (from drei) wired up: rotate (left-drag), zoom (scroll), pan (right-drag), orbiting a target at `[0, 4, 0]`; camera clamped above the ground and between 5–60 units of distance
- [x] `src/App.tsx` restructured to a three-row layout — header (title + subtitle), viewer (fills all remaining height), footer (status + control hint)
- [x] Title and subtitle remain visible above the viewer, as required
- [x] `src/index.css` reworked for the full-height layout; styling still dark and minimal, with the 3D viewer as the visual focus
- [x] No unit selection, no metadata, no floors, no GIS, no ULPIN logic — deliberately out of scope for this phase

## Outstanding — must be verified manually on this machine

- [ ] `npm install` — **not yet run**
- [ ] `npm run build` — **not yet run, therefore not yet verified**

The assistant's cloud sandbox is blocked from `registry.npmjs.org` by egress policy
(HTTP 403 on every package request, re-checked at the start of Phase 2), and this
session has no shell on this machine. **All source files are written and in place;
only the dependency install and the build remain, and both must be run by the
developer.** Report the output and any failure will be fixed before Phase 3.

## Commands to run locally

From `C:\Users\Admin\Projects\3d-ulpin`:

```bash
npm install          # install dependencies (creates node_modules/ and package-lock.json)
npm run dev          # start the dev server, then open http://localhost:5173
npm run build        # type-check with tsc, then produce the production bundle in dist/
npm run preview      # serve the built dist/ locally, to check the production output
npm run typecheck    # type-check only, no bundle
```

**What a correct Phase 2 result looks like in the browser:** a dark page with the
title and subtitle at the top, a large 3D viewport below showing a tall grey box
standing on a dark grid, and a status line at the bottom. Left-drag orbits the
camera, the scroll wheel zooms, right-drag pans. The box should cast a shadow onto
the ground.

## Verified build result

- **`npm install`:** not yet run — **unverified**
- **`npm run build`:** not yet run — **unverified**
- **What *was* verified:** all `.ts`/`.tsx` sources were parsed with `tsc` in isolation
  (module resolution disabled, since dependencies are absent) and contain no syntax or
  type-structure errors. This proves the files are well-formed; it does **not** prove the
  dependency versions resolve, that the peer-dependency graph is satisfiable, or that the
  bundle builds.

## Next phase

**Phase 3 – procedural floors.** Expected scope:

1. Replace the single box in `Building.tsx` with a stack of floor slabs generated from a floor count.
2. Keep the camera, lighting and controls in `SceneViewer.tsx` untouched — that is the point of the split.
3. Still no selection, no metadata, no ULPIN generation; just visible, correctly stacked floors.
4. Confirm it renders in dev **and** survives `npm run build`.

## Known issues

- **Build still unverified.** The blocking item since Phase 1. Nothing can be called done until `npm install` and `npm run build` pass on this machine.
- **Dependency versions are ranges chosen without registry access.** `three ^0.180.0`, `@react-three/fiber ^9.0.0`, `@react-three/drei ^10.0.0` and `@types/three ^0.180.0` were selected for known mutual compatibility (fiber 9 and drei 10 are the React 19 generation) but were **not** resolved against the live registry. If `npm install` reports an unsatisfiable range or a peer conflict, the fix is to adjust the range — the scene code itself does not depend on a specific minor version.
- **`three` and `@types/three` must stay on the same minor.** Three.js ships breaking changes between `0.x` releases, so if one is bumped the other must be bumped to match.
- **No `package-lock.json` yet.** Created by the first `npm install`; should be committed so Vercel builds reproducibly.
- No Git remote configured, so nothing can be pushed and deployment is not wired up.
- Nothing has been committed to Git at all yet — the whole of Phases 0–2 is still uncommitted working-tree state. Worth committing as soon as the build passes.
- The demo dataset (buildings, floors, units, coordinates) does not exist yet.
- The 3D ULPIN identifier format is still undecided — which fields, in what order, and how the vertical component is encoded. Should be settled before the data model is written.

## Last verified state

- **Verified on:** 2026-09-04
- **What was verified:**
  - Working tree contains `.gitignore`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `src/` (4 files + `src/scene/` with 3 files), and the two markdown docs.
  - `PROJECT_STATUS.md` and `ARCHITECTURE.md` intact through both phases.
  - `.git/HEAD` reads `ref: refs/heads/main`; `.git/refs/heads` empty → **zero commits**; no `[remote]` in `.git/config`.
  - All sources parse cleanly under `tsc`; **no dependency install and no bundle build have been run.**
- **Conclusion:** Phase 2 source complete, build **not yet verified**. Phase 2 stays open until `npm install` and `npm run build` succeed here.
