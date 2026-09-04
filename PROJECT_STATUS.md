# PROJECT_STATUS

**Project name:** 3D ULPIN

**Goal:** SIH prototype for 3D ULPIN and vertical property mapping — a demonstrable system that extends the flat, parcel-level ULPIN idea into three dimensions so that individual floors/units in a vertical building can each be identified, located and inspected.

**Current phase:** Phase 4 – apartment subdivision

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

## Completed — Phase 3 (procedural floors) — *source complete, unverified locally*

- [x] **Unit convention fixed project-wide: 1 Three.js unit = 1 metre.** Every dimension in the scene is now a real-world measurement.
- [x] `src/scene/buildingConfig.ts` (**new**) — typed `BuildingConfig` (`width: 18`, `depth: 14`, `numberOfFloors: 5`, `floorHeight: 3`), plus `buildFloorLayouts()` and `getTotalHeight()`. No React, no Three.js — data and arithmetic only.
- [x] `src/scene/Building.tsx` — the Phase 2 single 3 × 9 × 3 box **removed entirely**; the file now generates the building by looping over the config. Nothing is hand-placed.
- [x] **One separate mesh per floor** (not a subdivided single box), so a floor can be given an identity in Phase 4.
- [x] Floors stacked with `floorBaseY = floorIndex * floorHeight` and `floorCenterY = floorBaseY + floorHeight / 2` → **0–3, 3–6, 6–9, 9–12, 12–15 m**. Arithmetic executed and checked against these expected elevations.
- [x] Adjacent floors distinguished restrainedly: two near-identical shades alternating (`#5b7286` / `#4d6376`) plus a **0.06 m** sliver shaved off each slab's *geometry height only* — applied symmetrically, so every mesh centre stays at its true `centerY` and the metre-based model is unchanged.
- [x] `src/ui/BuildingSummary.tsx` (**new**) — overlay panel reading **5 floors · 3.0 m floor height · 15.0 m total height · 18 × 14 m footprint**, every value derived from the same config, none typed in by hand. `pointer-events: none`, so it cannot swallow orbit/zoom drags.
- [x] `src/App.tsx` — renders the summary as an HTML overlay inside `.viewer`; footer status now reads **Procedural Floors Active**.
- [x] `src/index.css` — styles for the overlay panel; layout otherwise unchanged.
- [x] `src/scene/SceneViewer.tsx` — OrbitControls, camera, lighting and shadows all kept working, re-framed for the larger subject **from the config rather than by hand**: orbit target `[0, totalHeight / 2, 0]`, camera at `[26, 18, 30]`, distances 12–120 m, and the directional light's shadow frustum widened to ±30 m (the ±5 m default would have clipped an 18 m footprint) with a 2048² shadow map.
- [x] `src/scene/Ground.tsx` — plane and grid enlarged to 120 × 120 with 120 divisions, so **one grid square is exactly 1 × 1 m** and the metre convention is visible on screen.
- [x] Still no apartments, no clickable units, no property metadata, no GIS, no ULPIN generation, no topology validation, no AI, no backend, no deployment changes — all deliberately out of scope for this phase.

## Files changed in Phase 3

| File | Change |
|---|---|
| `src/scene/buildingConfig.ts` | **new** — config type, default config, floor layout maths, total height |
| `src/ui/BuildingSummary.tsx` | **new** — building summary overlay, all values derived from the config |
| `src/scene/Building.tsx` | rewritten — single box removed; generates one mesh per floor |
| `src/scene/SceneViewer.tsx` | camera / orbit target / shadow frustum re-framed from the config |
| `src/scene/Ground.tsx` | enlarged to 120 × 120 with 1 m grid squares |
| `src/App.tsx` | renders `<BuildingSummary />` over the viewer; footer status text |
| `src/index.css` | styles for the summary panel |
| `ARCHITECTURE.md` | new section 3 "The building model"; repo shape and section numbering updated |
| `PROJECT_STATUS.md` | this update |

Untouched: `main.tsx`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`. **No new dependencies were added in Phase 3.**

**Not committed.** Phase 3 is working-tree state only, as instructed.

## Local verification required — Phase 3 (still open)

`node_modules/` and `package-lock.json` are now present in the repo, so `npm install`
appears to have been run since the Phase 2 note was written — but **this session has
no shell on this machine and could not run or observe any command there**, so nothing
below is confirmed.

- [ ] `npm run dev` — **must be run by the developer**
- [ ] `npm run build` (`tsc --noEmit && vite build`) — **must be run by the developer**

**What was verified for Phase 3, in the cloud sandbox:**

- All Phase 3 `.ts`/`.tsx` sources were parsed with `tsc` in `strict` mode with module
  resolution disabled (the dependencies are not installed there) — no syntax, JSX or
  type-structure errors.
- `buildingConfig.ts` was compiled and **executed**, and its output checked against the
  specification: floors at 0–3, 3–6, 6–9, 9–12 and 12–15 m, centres at 1.5, 4.5, 7.5,
  10.5 and 13.5 m, total height 15 m, footprint 18 × 14 m — all exact.

**What that does not prove:** that the R3F/drei props type-check against the real
`@types/three`, that the bundle builds, or that the scene renders. Those need
`npm run build` and `npm run dev` on this machine.

**What a correct Phase 3 result looks like in the browser:** five clearly separated
slabs stacked into one block, 18 m wide and 14 m deep, reaching 15 m — noticeably
wider than it is tall, unlike the Phase 2 tower. Adjacent slabs differ slightly in
shade with a thin dark line between them. A small panel at the top-left of the
viewport reads *5 floors · 3.0 m · 15.0 m · 18 × 14 m*. Left-drag orbits, scroll
zooms, right-drag pans, and the whole building casts one shadow across the grid —
each grid square being one metre, the building should span 18 squares by 14.

*Superseded by Phase 4:* the slabs described above no longer exist — each floor is now
four boxes. The block's outer dimensions, the panel's first four rows and the camera
behaviour are unchanged, so everything else in this section still applies.

## Completed — Phase 4 (apartment subdivision) — *source complete, unverified locally*

- [x] `src/scene/unitLayout.ts` (**new**) — typed `ApartmentUnit` model with `id`, `floorLevel`, `indexOnFloor`, `unitNumber`, `column`, `row`, `xMin`/`xMax`, `yMin`/`yMax`, `zMin`/`zMax`, `width`, `depth`, `height`, `areaSqM`, `volumeCubicM`. No React, no Three.js — property description only, like `buildingConfig.ts`.
- [x] `BuildingConfig` **extended, not duplicated**: two new fields `unitColumns: 2` and `unitRows: 2`. The 2 × 2 grid is configuration, not a constant buried in a renderer. `getUnitsPerFloor()` and `getTotalUnits()` derive 4 and 20 from it.
- [x] **Every above-ground floor subdivided into 4 units** on a 2 × 2 grid: `unitWidth = width / unitColumns` = 9 m, `unitDepth = depth / unitRows` = 7 m → **63 m² and 189 m³ per unit**, 20 units in the building.
- [x] **Units generated procedurally** by `buildApartmentUnits(config, floors)` — a nested loop over the floor layouts. No hard-coded apartment list, no hand-placed meshes. Changing `unitColumns` to 3 gives 15 units of 6 × 7 m with no code edit.
- [x] **Naming** `floor` + zero-padded index: 101–104, 201–204, 301–304, 401–404, 501–504. Padding keeps them sortable and unambiguous past nine units per floor.
- [x] **One separate mesh per unit** (20 meshes), each with `name={unit.id}`, so a unit is an addressable object ready for Phase 5 picking rather than a stripe on a box.
- [x] **Vertical bounds inherited from the floor, never recomputed**: a unit's `yMin`/`yMax` are its `FloorLayout`'s `baseY`/`topY`. Floor 3 units are exactly `yMin = 6`, `yMax = 9`. A unit cannot disagree with its floor.
- [x] **Mesh centres derived from bounds** via `getUnitCenter()` — `(min + max) / 2` per axis, a function rather than a stored field, so there is one description of where a unit is. Floor 3: centres at y = 7.5 m, x = ±4.5 m, z = ±3.5 m.
- [x] **Phase 3 full-floor slab meshes removed entirely** from `Building.tsx`. The units now fill the building volume; keeping the slabs would put an opaque box inside every apartment. No separate slab geometry was added — the inter-unit structure is the visual gap below, which cannot overlap anything.
- [x] Units kept distinguishable **restrainedly**: the same two near-identical shades as Phase 3 (`#5b7286` / `#4d6376`) alternated as a 3D checkerboard on `(column + row + floorIndex) % 2`, so no unit touches another of the same shade in any direction — plus the **0.06 m** sliver shaved off each box's *geometry size only*, now in all three axes, applied symmetrically so every mesh centre stays exact. No random bright colours; colour is being saved for selection state.
- [x] `src/ui/BuildingSummary.tsx` — new **Property units** section reading **20 vertical units · 4 per floor (2 × 2) · 9 × 7 m · 63 m² · 189 m³**. The counts come from `config`; the per-unit figures are read off the *same generated `ApartmentUnit[]` the scene renders*, not retyped.
- [x] `src/index.css` — divider rule for the panel's second heading; panel `min-width` 190 → 218 px for the longer rows. Layout otherwise unchanged.
- [x] `src/App.tsx` — footer status now reads **Vertical Property Units Active**.
- [x] **OrbitControls, camera, lighting and shadows untouched** — `SceneViewer.tsx` and `Ground.tsx` were not modified at all. The building's outer envelope is unchanged, so the framing still fits.
- [x] Still no click selection, no property inspector, no ULPIN generation, no GIS, no topology validation, no AI, no backend, no basement, no deployment changes — all deliberately out of scope for this phase.

## Files changed in Phase 4

| File | Change |
|---|---|
| `src/scene/unitLayout.ts` | **new** — `ApartmentUnit`, `buildApartmentUnits()`, `getUnitCenter()` |
| `src/scene/buildingConfig.ts` | `unitColumns` / `unitRows` added to `BuildingConfig` and the default config; `getUnitsPerFloor()` and `getTotalUnits()` added |
| `src/scene/Building.tsx` | rewritten — full-floor slabs removed; renders one mesh per unit, centre derived from bounds |
| `src/ui/BuildingSummary.tsx` | new **Property units** section, values from the generated units |
| `src/index.css` | secondary-heading divider; panel `min-width` widened |
| `src/App.tsx` | footer status text |
| `ARCHITECTURE.md` | new section 4 "The property-unit model"; sections renumbered, §2/§3 and the repo tree updated |
| `PROJECT_STATUS.md` | this update |

Untouched: `SceneViewer.tsx`, `Ground.tsx`, `main.tsx`, `vite-env.d.ts`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`. **No new dependencies were added in Phase 4.**

**Not committed.** Phase 4 is working-tree state only, as instructed.

## Local verification required — Phase 4

This session has **no shell on this machine**, so nothing below is confirmed:

- [ ] `npm run dev` — **must be run by the developer**
- [ ] `npm run build` (`tsc --noEmit && vite build`) — **must be run by the developer**

**What was verified for Phase 4, in the cloud sandbox:**

- All sources parsed with `tsc` in `strict` mode with module resolution disabled (the dependencies cannot be installed there — the registry is blocked by the sandbox's proxy policy) — no syntax, JSX or type-structure errors of our own.
- `buildingConfig.ts` and `unitLayout.ts` were compiled and **executed**, and the generated data checked against the specification. All assertions passed:
  - 20 units total, 4 per floor; `getTotalUnits()` = 20
  - unit numbers exactly `101–104, 201–204, 301–304, 401–404, 501–504`, all 20 ids unique
  - every unit 9 × 7 × 3 m → **63 m²**, **189 m³**
  - floor 3 units: `yMin = 6`, `yMax = 9` for all four
  - floor 3 bounds and derived centres: `301` x[−9,0] z[−7,0] → (−4.5, 7.5, −3.5); `302` x[0,9] z[−7,0] → (4.5, 7.5, −3.5); `303` x[−9,0] z[0,7] → (−4.5, 7.5, 3.5); `304` x[0,9] z[0,7] → (4.5, 7.5, 3.5)
  - the four units **tile the floor exactly**: areas sum to 252 m² = 18 × 14 m, x extent −9…+9, z extent −7…+7, and a pairwise interval test found **zero overlaps**
  - total building volume 3 780 m³ = 18 × 14 × 15 m

**What that does not prove:** that the R3F/drei props type-check against the real `@types/three`, that the bundle builds, or that the scene renders.

**What a correct Phase 4 result looks like in the browser:** the same 18 × 14 × 15 m block as Phase 3, but now visibly built from **20 boxes** — four per floor, in a 2 × 2 arrangement, each 9 m wide and 7 m deep, with thin dark seams running both vertically (between floors) and along the two centre lines of the footprint. Adjacent boxes differ slightly in shade in every direction, and no box is brightly coloured. The top-left panel reads *5 floors · 3.0 m · 15.0 m · 18 × 14 m*, then *20 vertical units · 4 per floor (2 × 2) · 9 × 7 m · 63 m² · 189 m³*. Left-drag still orbits, scroll zooms, right-drag pans. Nothing responds to a click — that is Phase 5.

## Commands to run locally

From `C:\Users\Admin\Projects\3d-ulpin`:

```bash
npm install          # install dependencies (creates node_modules/ and package-lock.json)
npm run dev          # start the dev server, then open http://localhost:5173
npm run build        # type-check with tsc, then produce the production bundle in dist/
npm run preview      # serve the built dist/ locally, to check the production output
npm run typecheck    # type-check only, no bundle
```

## Next phase

**Phase 5 – click selection + property inspector.** Expected scope:

1. Make a unit mesh clickable — R3F's `onClick` raycast resolves the hit to a mesh, and because each mesh *is* one `ApartmentUnit`, the handler gets `unit.id` directly.
2. Hold the selected unit's id in React state, shared by the scene and the panel — the "state layer" of the architecture, appearing for the first time.
3. A property inspector panel showing the selected unit's `unitNumber`, `floorLevel`, bounds, `areaSqM` and `volumeCubicM` — all values already generated in Phase 4, so the panel reads them rather than computing anything.
4. Selection made visible in 3D: a distinct material on the selected unit. This is what the restrained Phase 4 palette was reserving colour for.
5. Still no ULPIN generation, no GIS, no backend — the identifier format is the phase after.
6. Confirm it renders in dev **and** survives `npm run build`.

## Known issues

- **Build still unverified.** The blocking item since Phase 1, and still open at the end of Phase 3. Nothing can be called done until `npm run build` passes on this machine and the scene is seen rendering in `npm run dev`.
- **Dependency versions are ranges chosen without registry access.** `three ^0.180.0`, `@react-three/fiber ^9.0.0`, `@react-three/drei ^10.0.0` and `@types/three ^0.180.0` were selected for known mutual compatibility (fiber 9 and drei 10 are the React 19 generation) but were **not** resolved against the live registry. If `npm install` reports an unsatisfiable range or a peer conflict, the fix is to adjust the range — the scene code itself does not depend on a specific minor version.
- **`three` and `@types/three` must stay on the same minor.** Three.js ships breaking changes between `0.x` releases, so if one is bumped the other must be bumped to match.
- **No `package-lock.json` yet.** Created by the first `npm install`; should be committed so Vercel builds reproducibly.
- No Git remote configured, so nothing can be pushed and deployment is not wired up.
- Nothing has been committed to Git at all yet — the whole of Phases 0–4 is still uncommitted working-tree state. Worth committing as soon as the build passes.
- **The 0.06 m visual gap is cosmetic and must stay that way.** It is subtracted from each unit box's geometry size symmetrically, in all three axes, so it never moves a mesh centre. If a later phase needs real slab thickness, wall thickness or floor-to-ceiling clearance, that belongs in `BuildingConfig` as its own field, not in the visual constant.
- **The unit grid is uniform by assumption.** Every floor is cut the same way and every unit is identical, which is why the summary panel can describe all 20 from `units[0]`. Real buildings have differently sized flats and floors that differ from each other; when that arrives, `buildApartmentUnits` needs a per-floor partition rather than one grid, and the panel needs a range rather than a single figure.
- **Unit numbering assumes fewer than 100 units per floor.** `unitNumber` is `floorLevel` + a 2-digit index, so floor 1 unit 100 would collide with floor 11 unit 0. Fine for the prototype; worth noting before the ULPIN format is fixed.
- The demo dataset (buildings, floors, units, coordinates) does not exist yet.
- The 3D ULPIN identifier format is still undecided — which fields, in what order, and how the vertical component is encoded. Should be settled before the data model is written.

## Last verified state

- **Verified on:** 2026-09-04
- **What was verified:**
  - Phase 4 sources written into the working tree: `src/scene/unitLayout.ts` added;
    `buildingConfig.ts`, `Building.tsx`, `BuildingSummary.tsx`, `index.css` and `App.tsx`
    updated. `SceneViewer.tsx` and `Ground.tsx` deliberately untouched.
  - The Phase 3 full-floor slab implementation is gone — `Building.tsx` contains no
    per-floor mesh and no `SLAB_VISUAL_GAP`; it maps over `ApartmentUnit[]` only.
  - All sources parse cleanly under `tsc --strict` (module resolution disabled; the
    sandbox's proxy blocks the npm registry, so the real dependency types could not be
    installed there).
  - `buildingConfig.ts` + `unitLayout.ts` were compiled and **executed**: 20 units,
    4 per floor, numbering 101–504, 9 × 7 × 3 m, 63 m², 189 m³, floor 3 at y 6–9 m with
    centres at 7.5 m, exact tiling of the 18 × 14 m footprint with zero overlaps, and a
    total volume of 3 780 m³. Every assertion passed.
  - **No dependency install and no bundle build were run or observed by this session** —
    it has no shell on this machine.
- **Conclusion:** Phase 4 **source complete**, build and render **not yet verified**.
  Phases 3 and 4 both stay open until `npm run build` succeeds and the 20 unit boxes are
  seen in the browser. Nothing has been committed.
