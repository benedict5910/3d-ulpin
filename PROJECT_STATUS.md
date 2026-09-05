# PROJECT_STATUS

**Project name:** 3D ULPIN

**Goal:** SIH prototype for 3D ULPIN and vertical property mapping — a demonstrable system that extends the flat, parcel-level ULPIN idea into three dimensions so that individual floors/units in a vertical building can each be identified, located and inspected.

**Current phase:** Phase 10 – ownership visualisation and topology validation, running as Subphases A–E. **Subphases A–E are all source complete.** Phases 6, 7, 8 and 9 are also source-complete and uncommitted; a commit made now carries all of them unless they are staged separately. **Phase 5 remains the last verified and committed state, and Phase 7's `npm install` is still outstanding and blocks the build.**

**See `LAST SAFE SOURCE CHECKPOINT` at the foot of this file** — it is the one place that says, in two lines, where the work stands and what comes next.

**Local repo path:** `C:\Users\Admin\Projects\3d-ulpin`

**Public deployment:** <https://3d-ulpin-three.vercel.app>

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

## Completed — Phase 3 (procedural floors) — *complete; verified as part of Phase 4*

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

Phase 3 was left uncommitted at the time; it went into version control as part of the Phase 4 checkpoint below.

## Local verification — Phase 3 (closed by the Phase 4 verification)

Phase 3's build and render were never checked at the time. They no longer need to be
separately: Phase 4 kept `buildingConfig.ts`, `SceneViewer.tsx` and `Ground.tsx`, and the
`npm run build` / `npm run dev` run recorded below exercises all of that code. Phase 3 is
therefore closed, with the caveat that its *own* visual result — five full-floor slabs —
no longer exists to be looked at, having been deliberately replaced.

- [x] `npm run dev` — passed on the host (recorded under Phase 4)
- [x] `npm run build` (`tsc --noEmit && vite build`) — passed on the host (recorded under Phase 4)

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

## Completed — Phase 4 (apartment subdivision) — *verified and complete*

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

## Deployment — configured and live

| | |
|---|---|
| **Public URL** | <https://3d-ulpin-three.vercel.app> |
| **Pipeline** | GitHub → Vercel, connected. Vercel builds and hosts from the repo. |
| **Status** | **Working, and confirmed by observation** — not just configured. |

The pipeline was proved by an accident worth recording: the developer opened the public
URL and it served the **Phase 3** build, because the Phase 4 commit had not been pushed
yet. That is stronger evidence than a green dashboard — it shows Vercel really is building
from GitHub and serving what the repo's default branch contains, and that a push is what
moves the deployment forward.

There is therefore always a shareable working link, which is the point of deploying from
Phase 1 rather than at the deadline. Worth a glance at the live URL after each push to
confirm the new build went out.

## Git checkpoint — Phase 4

- **Committed and pushed** by the developer on 2026-09-04.
- Commit message: `Phase 4: subdivide floors into 3D property units`
- This is the project's first recoverable checkpoint: Phases 0–4 are now in version control rather than working-tree state, and a Git remote exists to push to. Everything before this commit was recoverable only by not breaking it.

## Verified — Phase 4

**On the Windows host, by the developer (2026-09-04):**

- [x] `npm run build` (`tsc --noEmit && vite build`) — **PASS**
- [x] `npm run dev` — **PASS**
- [x] 20 independent 3D unit meshes rendered correctly
- [x] 4 units per floor
- [x] OrbitControls still working (orbit / zoom / pan)
- [x] Unit summary panel values correct
- [x] No visible overlap or rendering conflict

The build passing is significant beyond this phase: it is the first time `tsc --noEmit`
has run against the **real** `@types/three` and the R3F/drei type definitions on this
machine. That closes the longest-standing blocker in this file — open since Phase 1 —
and confirms the dependency ranges in `package.json` resolve and are mutually compatible.

**Also verified in the cloud sandbox, before hand-off:**

- All sources parsed with `tsc` in `strict` mode with module resolution disabled (the dependencies cannot be installed there — the registry is blocked by the sandbox's proxy policy) — no syntax, JSX or type-structure errors of our own.
- `buildingConfig.ts` and `unitLayout.ts` were compiled and **executed**, and the generated data checked against the specification. All assertions passed:
  - 20 units total, 4 per floor; `getTotalUnits()` = 20
  - unit numbers exactly `101–104, 201–204, 301–304, 401–404, 501–504`, all 20 ids unique
  - every unit 9 × 7 × 3 m → **63 m²**, **189 m³**
  - floor 3 units: `yMin = 6`, `yMax = 9` for all four
  - floor 3 bounds and derived centres: `301` x[−9,0] z[−7,0] → (−4.5, 7.5, −3.5); `302` x[0,9] z[−7,0] → (4.5, 7.5, −3.5); `303` x[−9,0] z[0,7] → (−4.5, 7.5, 3.5); `304` x[0,9] z[0,7] → (4.5, 7.5, 3.5)
  - the four units **tile the floor exactly**: areas sum to 252 m² = 18 × 14 m, x extent −9…+9, z extent −7…+7, and a pairwise interval test found **zero overlaps**
  - total building volume 3 780 m³ = 18 × 14 × 15 m

**What Phase 4 looks like in the browser** — as specified beforehand, and confirmed on the host: the same 18 × 14 × 15 m block as Phase 3, but now visibly built from **20 boxes** — four per floor, in a 2 × 2 arrangement, each 9 m wide and 7 m deep, with thin dark seams running both vertically (between floors) and along the two centre lines of the footprint. Adjacent boxes differ slightly in shade in every direction, and no box is brightly coloured. The top-left panel reads *5 floors · 3.0 m · 15.0 m · 18 × 14 m*, then *20 vertical units · 4 per floor (2 × 2) · 9 × 7 m · 63 m² · 189 m³*. Left-drag still orbits, scroll zooms, right-drag pans. Nothing responds to a click — that is Phase 5.

## Completed — Phase 5 (click selection + property inspector) — *verified on the host and committed*

- [x] **Selection state lifted to `App.tsx`** — `useState<string | null>(null)`. `App` is the nearest component containing both readers: the 3D scene (which draws the selected unit differently) and the inspector panel (which describes it). They are siblings — the scene lives inside `<Canvas>`, the panel is HTML over it — so nothing lower can serve both.
- [x] **The selection is stored as an id, not as the unit object.** `selectedUnitId: string | null`, resolved back to the record by `findUnitById(units, selectedUnitId)`. Reasons recorded in `ARCHITECTURE.md` §5.1: a string compares cheaply inside the twenty-mesh render loop; a stale id resolves to `null` and returns the panel to its empty state, whereas a stale *object* would keep pointing at a unit the scene no longer draws; and it stays one copy of the data instead of two. The id is the question, the `units` array is the answer.
- [x] **The units array is generated once, in `App`,** and passed to `SceneViewer`, `BuildingSummary` and (via `findUnitById`) `PropertyInspector`. Previously `Building` and `BuildingSummary` each called `buildApartmentUnits` separately — the numbers always agreed, but they were separate objects, and selection makes object identity meaningful. **No duplicate geometry state anywhere:** the panel gets the same object the mesh was positioned from.
- [x] **Every unit mesh is clickable.** `onClick` on each of the 20 meshes → `onUnitClick(unit.id, event)` → `SceneViewer.handleUnitClick` → `onSelectUnit(unit.id)` → `setSelectedUnitId`. Clicking a different unit replaces the selection; the previously selected unit reverts, because "selected" is derived per-mesh from one shared value rather than stored on each mesh.
- [x] **`event.stopPropagation()` on click and on hover.** The ray does not stop at the first box — it passes through the building and reports every unit along its path. Without this, clicking the front face would also click the units behind it and the last handler to run would win.
- [x] **Selection highlight: amber `#d99b3f` + emissive `#6b4310` (0.55) + a wireframe cage** built with `EdgesGeometry` on the unit's **true** bounds (not the shrunk visual box), so it sits ~3 cm proud of the mesh and reads as a crisp edge rather than z-fighting. `EdgesGeometry` rather than a `wireframe` material, which would also draw each face's triangulation diagonal. One deliberate hue against the two near-identical slate blues held in reserve since Phase 3 — no rainbow.
- [x] **Hover feedback:** faint cool emissive (`#22384d`, 0.5) on the resting colour, plus `cursor: pointer` driven from the raycast result (a WebGL canvas is one DOM element, so the browser cannot know parts of it are clickable). Hover state is `useState` **local to `Building`** — nothing outside the 3D scene reads it, so it is not lifted.
- [x] **Selection is visually stronger than hover, in two channels.** Hover brightens; selection changes hue *and* adds an outline. A selected unit ignores hover styling entirely, so hovering one unit while another is selected can never make the hovered one read as selected.
- [x] **`src/ui/PropertyInspector.tsx` (new)** — top-right HTML overlay. Empty state: *"Select a property unit in the 3D model to inspect its spatial record."* Populated state: Unit, Floor, Property type, Area, Volume, Elevation, 3D bounds (X/Y/Z as `min → max`), Centroid (X/Y/Z). Imports no Three.js.
- [x] **Every inspector value comes from the selected unit's generated data.** No example values are hard-coded. Bounds are read off the record; area and volume are the `areaSqM` / `volumeCubicM` computed in Phase 4; the centroid is `getUnitCenter(unit)` — the *same function* `Building` uses to place the mesh, so the point named is by construction the point the box is centred on. The panel's only arithmetic is `toFixed` formatting.
- [x] **`propertyType` added to `ApartmentUnit`** as a `PropertyType` union (`'Residential' | 'Commercial' | 'Parking' | 'Common'`), set to `'Residential'` by the generator via a module constant. Property metadata sits on the same record as the geometry, so the panel *reads* a unit's use rather than deciding it; when later phases vary use by floor, one generator changes and no UI file does. This is the only field added — no geometry state duplicated.
- [x] **`findUnitById(units, unitId)` added to `unitLayout.ts`** — the id → record lookup, returning `null` for `null` and for an unknown id. Kept next to the model rather than in `App`, since it is a fact about the unit collection.
- [x] **OrbitControls and clicking coexist via a 5 px drag threshold.** `onPointerDown` on the `<Canvas>` records the press position in a `useRef` (a ref, not state — it is read during event handling and must never re-render); the click handler measures the distance travelled and ignores anything past `DRAG_TOLERANCE_PX = 5`. Without it, every camera rotation that began on a unit would also select it. OrbitControls itself is **unmodified** — it listens on the canvas element while picking comes from R3F's raycaster, so they never compete for a listener, only for the same gesture.
- [x] **Clicking empty space clears the selection** via R3F's `onPointerMissed`, guarded by the same drag test so that finishing an orbit over the sky does not deselect. `Ground` has no pointer handlers, so it is not in R3F's interactive set and does not block this.
- [x] **The building summary panel is unchanged and still visible** (top-left). It now receives `config` and `units` as props instead of regenerating the units itself; its rendered content is identical.
- [x] **Both overlays are `pointer-events: none`**, so a drag passing under either panel still reaches the canvas.
- [x] `src/index.css` — `.property-inspector` (top-right, 246 px, same panel language as the summary) and `.inspector-empty`. No layout change to anything existing.
- [x] `src/App.tsx` — footer hint now leads with *Click a unit to inspect*.
- [x] **No new dependencies.** The outline is plain Three.js (`BoxGeometry` + `EdgesGeometry`), not a drei helper.
- [x] Still no ULPIN generation, no GIS, no topology validation, no ownership-conflict simulation, no AI, no backend, no basement, no exploded view — all deliberately out of scope for this phase. Camera, lighting, ground and building dimensions untouched.

## Files changed in Phase 5

| File | Change |
|---|---|
| `src/ui/PropertyInspector.tsx` | **new** — the selected unit's cadastral record; empty-state message when nothing is selected |
| `src/App.tsx` | rewritten — owns `units` (generated once, `useMemo`) and `selectedUnitId`; resolves `selectedUnit` and wires scene ↔ panel; footer hint |
| `src/scene/SceneViewer.tsx` | takes `units` / `selectedUnitId` / `onSelectUnit`; adds the click-vs-drag threshold, `onPointerDown` capture, `onPointerMissed` deselect, and passes selection into `Building` |
| `src/scene/Building.tsx` | takes `units` as a prop instead of generating them; per-mesh `onClick` / `onPointerOver` / `onPointerOut`; hover state; selected + hover materials; `SelectionOutline` sub-component |
| `src/scene/unitLayout.ts` | `PropertyType` union and `propertyType` field added to `ApartmentUnit`; `findUnitById()` added |
| `src/ui/BuildingSummary.tsx` | takes `config` + `units` as props instead of regenerating the units; rendered output unchanged |
| `src/index.css` | `.property-inspector`, `.inspector-empty` |
| `ARCHITECTURE.md` | new section 5 "Selection and the property inspector"; old §5/§6 renumbered to §6/§7; repo tree and the `scene/` split rationale updated |
| `PROJECT_STATUS.md` | this update |

Untouched: `src/scene/buildingConfig.ts`, `Ground.tsx`, `main.tsx`, `vite-env.d.ts`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`. **No new dependencies were added in Phase 5.**

## Local verification — Phase 5 (completed on the host, 2026-09-04)

**Not yet run. Phase 5 is not complete until these pass on the Windows host.**

```bash
cd C:\Users\Admin\Projects\3d-ulpin
npm run build     # tsc --noEmit && vite build  — must pass
npm run dev       # then open http://localhost:5173
```

Check in the browser:

- [ ] The scene still renders 20 unit boxes, 4 per floor, as in Phase 4.
- [ ] The **top-left building summary is still visible and unchanged**.
- [ ] The **top-right inspector** reads *"Select a property unit in the 3D model to inspect its spatial record."* on load.
- [ ] Hovering a unit turns the cursor into a pointer and lifts that unit slightly. Moving off restores it.
- [ ] Clicking a unit turns it **amber with a wireframe cage** and fills the inspector.
- [ ] Clicking a **different** unit moves the selection — the previous unit returns to slate, and exactly one unit is highlighted at a time.
- [ ] Clicking the front face of the building selects the **front** unit, not one behind it.
- [ ] **Left-drag still orbits, scroll still zooms, right-drag still pans** — and a drag that *starts on a unit* rotates the camera **without** selecting that unit.
- [ ] Clicking the sky or the ground clears the selection back to the empty message.
- [ ] Dragging with the pointer over either panel still orbits the camera.
- [ ] Select **unit 302** (floor 3, right-hand front unit) and confirm the panel reads exactly:
  *Unit 302 · Floor 3 · Property type Residential · Area 63 m² · Volume 189 m³ · Elevation 6.0 m – 9.0 m · X 0.0 → 9.0 m · Y 6.0 → 9.0 m · Z −7.0 → 0.0 m · Centroid 4.5, 7.5, −3.5 m.*
- [ ] No console errors.

## Verified in the cloud sandbox — Phase 5 (source only)

Done before hand-off; **it does not replace the host run above.**

- All sources parsed with `tsc` in `strict` mode with module resolution disabled — the dependencies still cannot be installed in the sandbox (npm registry blocked by the proxy policy), so this catches syntax, JSX and structural errors of our own but **cannot** check the R3F/drei/Three type signatures. That is exactly what `npm run build` on the host is for.
- `buildingConfig.ts` + `unitLayout.ts` compiled and **executed** with the Phase 5 changes applied. All assertions passed:
  - 20 units, 5 floors, all ids unique; Phase 4 figures unchanged (63 m², 189 m³ for every unit)
  - every unit's `propertyType` is `'Residential'`
  - `findUnitById(units, null)` → `null`; `findUnitById(units, 'unit-999')` → `null`
  - `findUnitById(units, 'unit-302')` returns an object that **`units.includes()`** — i.e. the lookup hands back the same record the scene renders, not a copy. This is the single-source-of-truth claim, tested.
  - unit 302 renders as: Unit **302**, Floor **3**, Property type **Residential**, Area **63 m²**, Volume **189 m³**, Elevation **6.0 m – 9.0 m**, X **0.0 → 9.0 m**, Y **6.0 → 9.0 m**, Z **−7.0 → 0.0 m**, Centroid **4.5, 7.5, −3.5 m** — matching the phase specification exactly.

## Git checkpoint — Phase 5

**Committed and pushed** as `Phase 5: add unit selection and property inspector`, after the developer verified it on the Windows host on 2026-09-04 — the project's second recoverable checkpoint.

## Commands to run locally

From `C:\Users\Admin\Projects\3d-ulpin`:

```bash
npm install          # install dependencies (creates node_modules/ and package-lock.json)
npm run dev          # start the dev server, then open http://localhost:5173
npm run build        # type-check with tsc, then produce the production bundle in dist/
npm run preview      # serve the built dist/ locally, to check the production output
npm run typecheck    # type-check only, no bundle
```

## Completed — Phase 6 (prototype 3D ULPIN generator) — *source complete, NOT yet verified on the host, NOT committed*

Every vertical property unit now carries a deterministic, unique, human-readable
identifier, generated at the data layer alongside its geometry and displayed as
the headline field of the property inspector.

```
KA - BLR - 0482 - 001928 - F03 - U02
│    │     │      │        │     └─ unit index on that floor (1-based, zero-padded)
│    │     │      │        └─────── floor level (1-based, zero-padded)
│    │     │      └──────────────── parent land-parcel number
│    │     └─────────────────────── spatial / zone code
│    └───────────────────────────── city / district demo code
└────────────────────────────────── state code
```

> **This is a prototype encoding scheme for the SIH demonstration. It is NOT the
> official Government of India ULPIN format.** Every place the identifier is
> shown carries the label *"Prototype encoding – demonstration only"*.

What was built:

- **`ParcelIdentity`** — a typed, four-field structure (`stateCode`, `cityCode`,
  `zoneCode`, `parcelNumber`), with `DEMO_PARCEL_IDENTITY` fixed at
  `KA` / `BLR` / `0482` / `001928`. All fields are strings, because `0482` and
  `001928` carry meaningful leading zeros that a number would eat.
- **`generatePrototype3DULPIN(parcel, floorLevel, unitIndex)`** — pure and
  deterministic. Validates that floor and index are 1-based positive integers,
  zero-pads each to two digits, and joins the segments.
- **Two new fields on `ApartmentUnit`**: `prototypeUlpin` and `parentParcelId`,
  both generated inside `buildApartmentUnits` in the same loop iteration that
  computes the unit's bounds — so the name and the volume it names come from one
  pass over one set of inputs.
- **`assertUniqueIdentifiers`** runs over all twenty identifiers before
  `buildApartmentUnits` returns, and **throws** on any duplicate. A duplicate
  would be invisible in the UI (each panel would look correct on its own), so
  the failure is fatal at generation time rather than a warning.
- **A pure self-check** (`checkPrototypeUlpin`) covering the three specified
  known-answer cases and uniqueness. `App` runs it under `import.meta.env.DEV`,
  so it fires on every dev reload and is stripped from the production bundle.
- **The inspector** shows the identifier first, in a tinted accent card with a
  monospace value, then `Parent parcel`, then all the Phase 5 fields unchanged.

**Apartment number is not the unit index.** `unitNumber` (`"302"`) is a door
label; `indexOnFloor` (`2`) is the ordinal position on the floor and is what
feeds the `U` segment. The identifier is never derived by parsing the door
label — real buildings use `3A`, skip 13 and restart per wing, all of which
would silently produce a well-formed identifier for the wrong property. Phase 6
did **not** add a parallel `unitIndexWithinFloor` field: `indexOnFloor` already
carries that value reliably, and two fields meaning one thing is the drift this
model avoids everywhere else.

## Files changed in Phase 6

| File | Change |
|---|---|
| `src/ulpin/parcelIdentity.ts` | **new** — `ParcelIdentity`, `DEMO_PARCEL_IDENTITY`, `formatParentParcelId()`, `PROTOTYPE_ENCODING_NOTE` |
| `src/ulpin/generateUlpin.ts` | **new** — `generatePrototype3DULPIN()`, zero padding, `findDuplicateIdentifiers()`, `assertUniqueIdentifiers()` |
| `src/ulpin/ulpinSelfCheck.ts` | **new** — `checkPrototypeUlpin()` (pure) and `runPrototypeUlpinSelfCheck()` (dev-only runner) |
| `src/scene/unitLayout.ts` | `ApartmentUnit` gains `prototypeUlpin` + `parentParcelId`; `buildApartmentUnits` gains a `parcel` parameter (defaulting to the demo parcel) and asserts uniqueness before returning |
| `src/ui/PropertyInspector.tsx` | leading identifier block + disclaimer, plus a `Parent parcel` row; every Phase 5 field retained |
| `src/index.css` | `.ulpin-block` / `.ulpin-label` / `.ulpin-value` / `.ulpin-note` / `dd.mono`; inspector widened 246px → 274px so the 26-character identifier sits on one line |
| `src/App.tsx` | runs the self-check on the generated units under `import.meta.env.DEV` |
| `ARCHITECTURE.md` | new §6 (format, parcel identity, generator, generation flow, apartment number vs unit index, uniqueness, zero padding, self-check, display); old §6/§7 renumbered to §7/§8; repo tree updated |
| `PROJECT_STATUS.md` | this section |

No new dependencies. No file was deleted. `SceneViewer.tsx`, `Building.tsx`,
`Ground.tsx`, `BuildingSummary.tsx` and `buildingConfig.ts` were **not touched**
— selection, hover, highlight, orbit and the drag threshold are exactly as
Phase 5 left them.

## Local verification REQUIRED — Phase 6

Nothing below has run on the Windows host. Run from `C:\Users\Admin\Projects\3d-ulpin`:

1. `npm run build` — must pass. `tsc --noEmit` runs first, so this is the real
   type gate for the two new `ApartmentUnit` fields and the new `parcel`
   parameter.
2. `npm run dev`, open <http://localhost:5173>.
3. **Console on load:** exactly one line —
   `[3D ULPIN] self-check passed (4 checks) — prototype encoding, demonstration only`.
   No errors. If the self-check throws, the app will not render — that is the
   intended behaviour, and the error message names the failing case.
4. Click **unit 302** (third floor, second unit — front-right on the middle
   floor). The inspector must show:
   - **Prototype 3D ULPIN** `KA-BLR-0482-001928-F03-U02` — largest, monospace,
     in the accent card at the top of the panel
   - *Prototype encoding – demonstration only* directly beneath it
   - **Parent parcel** `KA-BLR-0482-001928`
   - Unit `302`, Floor `3`, Residential, 63 m², 189 m³, 6.0–9.0 m, and the
     Phase 5 bounds and centroid, all unchanged
5. Click the **ground-floor front-left** unit → `…-F01-U01`. Click the
   **top-floor back-right** unit → `…-F05-U04`.
6. Confirm the identifier is **not clipped or wrapped** at the panel's width.
7. **Regression — Phase 5 must still work:** selecting a second unit replaces
   the first; clicking empty space clears the panel; a drag that starts on a
   unit orbits without selecting; hover still reads differently from selection.
8. `npm run preview` after the build — the panel looks identical, and the
   console self-check line is **absent** (it is dev-only).

## Verified in the cloud sandbox — Phase 6 (pure logic only)

The identifier modules import no React and no Three.js, so they were executed
directly in Node against the real `buildApartmentUnits`:

- 20 units generated, **20 distinct identifiers**, no duplicates.
- Known answers: floor 1 / index 1 → `KA-BLR-0482-001928-F01-U01`; floor 3 /
  index 2 → `KA-BLR-0482-001928-F03-U02`; floor 5 / index 4 →
  `KA-BLR-0482-001928-F05-U04`. All three **PASS**.
- Unit `302` carries `parentParcelId` `KA-BLR-0482-001928` and `prototypeUlpin`
  `KA-BLR-0482-001928-F03-U02`.
- Padding beyond the demo: floor 12 / index 3 → `…-F12-U03`.
- Rejected as expected: floor `0`, `-1`, `2.5` and `NaN` each throw
  `floorLevel must be a positive integer (1-based)`.

This covers the project's own logic. It does **not** cover JSX, the CSS, or the
React/R3F type signatures — `npm run build` on the host remains the real gate.

## Git checkpoint — Phase 6

**None. Phase 6 is deliberately not committed** — the developer commits after
verifying on the host, as with every previous phase.

## Completed — Phase 7 (GIS parcel map) — *source complete, NOT verified on the host, NOT committed*

The identifier from Phase 6 names a vertical property, but nothing showed *where
on the ground* its parent parcel is. Phase 7 adds the horizontal half: a 2D
Leaflet map beside the 3D viewer, drawing the cadastral parcel
`KA-BLR-0482-001928` and the footprint of the building standing on it.

- [x] **Dependencies added** — `leaflet ^1.9.4`, `react-leaflet ^5.0.0`,
      `@types/leaflet ^1.9.12` (dev). `react-leaflet` v5 is the first line that
      requires React 19, so it matches this project's React version exactly.
      **`npm install` has not been run** — see verification below.
- [x] **`src/data/demoParcel.ts`** — a typed demo parcel. `DemoParcel` carries
      `parcelId`, `identity`, `state`, `city`, `latitude` / `longitude`,
      `centre`, `boundary`, `buildingFootprint`, `areaSqM`,
      `buildingFootprintAreaSqM`, `isDemoData: true` and `dataNote`.
- [x] **Geometry authored in metres, converted to lat/lng by one function.**
      Corners are written as `{ eastM, northM }` offsets from one origin and
      converted with a local flat-earth transform that includes the
      `cos(latitude)` term. Area is computed by the shoelace formula **over the
      metre outlines**, so square metres come out exact rather than as
      re-projected degrees.
- [x] **The footprint is derived, not typed.** `buildFootprintOutlineM()` reads
      `DEFAULT_BUILDING_CONFIG.width` / `.depth` — the same 18 × 14 the 3D floors
      and units are generated from. The rectangle on the map *is* the 3D
      building's outline, not a copy of its numbers.
- [x] **One parcel identity, read twice.** `data/demoParcel.ts` imports
      `DEMO_PARCEL_IDENTITY` and `formatParentParcelId()` from
      `ulpin/parcelIdentity.ts`. The string `KA-BLR-0482-001928` appears nowhere
      in the data module. The map's `Parent parcel` row and the inspector's are
      the same four codes by construction.
- [x] **`src/map/GISMap.tsx`** — `<MapContainer>` centred on the demo location at
      zoom 19, an OpenStreetMap `<TileLayer>`, the parcel `<Polygon>`, the
      footprint `<Polygon>`, a `<CircleMarker>` reference point, and hover
      `<Tooltip>`s on all three. Takes the parcel as a prop; owns no data.
- [x] **`src/map/parcelStyles.ts`** — one source for both layer styles, the tile
      URL, the attribution and the zoom limits, so the legend cannot describe a
      style the map has stopped using.
- [x] **`src/map/MapLegend.tsx`** — *Cadastral Parcel* (dashed slate-blue) and
      *Building Footprint* (solid accent green). Swatch colour, weight and
      dashing are read from `parcelStyles.ts`, never restated in CSS.
- [x] **`src/map/ParcelInfoPanel.tsx`** — Parent parcel, Location, Parcel area,
      Building footprint, Coordinates, Data. Every figure read off the same
      `DemoParcel` the polygons are drawn from.
- [x] **Three-column dashboard** — `.viewer` is now a CSS grid:
      map (336px) │ 3D viewer (`minmax(0, 1fr)`) │ inspector (306px). The
      inspector stopped being a floating overlay and became a real column; the
      building summary still floats, over `.scene-panel` instead of `.viewer`.
- [x] **Leaflet CSS wired correctly** — `leaflet/dist/leaflet.css` imported in
      `main.tsx` *before* `index.css`, so the project's dark-theme overrides win
      specificity ties without `!important`.
- [x] **Map sizing handled from two directions** — `.gis-map` gets a
      `minmax(0, 1fr)` grid row **and** a `min-height: 260px` floor, and a
      `ResizeObserver` inside `<MapContainer>` calls `map.invalidateSize()` on
      every container resize.
- [x] **`<CircleMarker>`, not `<Marker>`** — Leaflet's default marker icon is a
      PNG on a relative URL that breaks under a bundler unless the icon paths are
      patched by hand. A vector circle needs no asset and no patch.
- [x] **Basemap kept clearly separate from cadastral data** — the OSM tiles are
      the only networked thing on the map; parcel and footprint are local and
      deterministic. A CSS filter scoped to `.leaflet-tile-pane` desaturates the
      basemap without touching the vector overlays. Attribution appears in the
      map control *and* the app footer.

**Key figures produced by the demo data:** parcel **1 547 m²**, footprint
**252 m²** (= 18 × 14 exactly), origin **12.9352° N, 77.6245° E**, ground
coverage ≈ **16%**.

**Key decision — geometry lives in `data/`, identity stays in `ulpin/`.** The
identity says *which* parcel and changes on a re-numbering; the geometry says
*where* and changes on a re-survey. Two lifetimes, two modules. The alternative
— one file holding both — would mean a boundary correction touches the module
the identifier generator depends on.

## Files changed in Phase 7

| File | Change |
|---|---|
| `src/data/demoParcel.ts` | **new** — `GeoPoint`, `LocalPointM`, `DemoParcel`, `localPointToGeoPoint()`, `polygonAreaSqM()`, `buildFootprintOutlineM()`, `buildDemoParcel()`, `DEMO_PARCEL` |
| `src/map/parcelStyles.ts` | **new** — `PARCEL_BOUNDARY_STYLE`, `BUILDING_FOOTPRINT_STYLE`, `PARCEL_CENTRE_STYLE`, OSM tile URL + attribution, zoom constants |
| `src/map/GISMap.tsx` | **new** — the Leaflet map, its three layers, and the `MapAutoSize` resize observer |
| `src/map/MapLegend.tsx` | **new** — two-entry legend, swatches driven by `parcelStyles.ts` |
| `src/map/ParcelInfoPanel.tsx` | **new** — the parcel record shown beneath the map |
| `src/App.tsx` | three-column `<main>`; renders `<GISMap>` + `<ParcelInfoPanel>` with `DEMO_PARCEL`; OSM credit added to the footer hint |
| `src/main.tsx` | imports `leaflet/dist/leaflet.css` before `./index.css` |
| `src/index.css` | `.viewer` became a 3-column grid; new `.map-panel` / `.scene-panel` / `.inspector-panel`; `.property-inspector` is static, not absolute, and no longer `pointer-events: none`; new `.gis-map`, Leaflet dark-theme overrides, `.map-legend*`, `.parcel-info*`; a stacking media query below 1100px |
| `package.json` | `leaflet`, `react-leaflet` added to dependencies; `@types/leaflet` to devDependencies |
| `ARCHITECTURE.md` | new §7 (what GIS means here, the parcel polygon, the footprint, metres vs degrees, how Leaflet fits into React, one shared parcel identity, basemap vs cadastral geometry, the three-column layout, non-goals); old §7/§8 renumbered to §8/§9; repo tree, planned-additions and toolchain table updated |
| `PROJECT_STATUS.md` | this section |

No file was deleted. `SceneViewer.tsx`, `Building.tsx`, `Ground.tsx`,
`unitLayout.ts`, `buildingConfig.ts`, `BuildingSummary.tsx`,
`PropertyInspector.tsx` and the whole `ulpin/` module were **not touched** — the
3D half of the application is byte-for-byte what Phase 6 left. Everything that
changed about the 3D viewer's appearance is CSS layout.

## Local verification REQUIRED — Phase 7

Nothing below has run on the Windows host, and this phase is the first since
Phase 1 to add dependencies. Run from `C:\Users\Admin\Projects\3d-ulpin`:

1. **`npm install`** — mandatory and first. `leaflet`, `react-leaflet` and
   `@types/leaflet` are declared in `package.json` but are not in
   `node_modules`. Nothing else in this list will work until this succeeds.
   Confirm `react-leaflet` resolves to **5.x**; if npm reports a peer-dependency
   conflict against React 19, that is the signal it picked an older major.
2. **`npm run build`** — must pass. `tsc --noEmit` runs first and is the real
   gate: the map components have never been type-checked against the actual
   `react-leaflet` and `@types/leaflet` definitions (see the sandbox note below).
3. **`npm run dev`**, open <http://localhost:5173>.
4. **The map renders.** Tiles load, the map fills the left column, and it is
   **not** a zero-height strip or a vertical stack of unpositioned squares —
   the latter means the Leaflet stylesheet did not load.
5. **Both polygons are visible and distinguishable:** a dashed slate-blue
   quadrilateral (the parcel) with a solid green rectangle inside it (the
   footprint), plus a small white reference dot at the centre.
6. **The legend** reads *Cadastral Parcel* and *Building Footprint*, and its two
   swatches match the two lines on the map.
7. **The parcel panel** shows `KA-BLR-0482-001928`, *Bengaluru, Karnataka*,
   **1,547 m²**, **252 m²**, `12.9352° N, 77.6245° E`, *Demo / prototype
   dataset*.
8. **The identity matches across the app.** Click any unit; the inspector's
   **Parent parcel** row must read the same `KA-BLR-0482-001928` as the map
   panel's.
9. **The 3D viewer is fully intact** — this is the regression that matters most:
   orbit by dragging, zoom by scrolling, right-drag to pan; clicking a unit
   selects it and fills the inspector; a drag that starts on a unit orbits
   without selecting; hover still reads differently from selection; clicking
   empty space clears the panel; the dev-console self-check line still appears
   exactly once.
10. **The inspector scrolls** if the record is taller than its column, and text
    in it can be selected — both were impossible while it was
    `pointer-events: none`.
11. **Map interaction:** buttons and double-click zoom; drag pans; the
    scroll wheel deliberately does **not** zoom the map. Hovering either polygon
    shows a tooltip.
12. **Resize the window.** The map must re-fill its column with no grey wedges
    and no tiles left behind — that is the `ResizeObserver` doing its job.
    Below ~1100px the three columns stack and the page scrolls.
13. **StrictMode double-mount.** React 19 StrictMode mounts every component
    twice in development. If the console shows *"Map container is already
    initialized"*, react-leaflet's cleanup is not firing and the map must be
    given a `key` or the version checked — the map itself should still render.
14. **Offline check (optional but instructive):** stop the network and reload.
    The basemap goes blank; the parcel, footprint, legend and panel are
    unchanged. That is the basemap-versus-cadastral-data distinction, visible.
15. **`npm run preview`** after the build — identical map, and the dev-only
    self-check console line absent.

## Verified in the cloud sandbox — Phase 7 (data layer only)

`src/data/demoParcel.ts` imports no React and no Leaflet, so it was compiled
under `tsc --strict --noUnusedLocals --noUnusedParameters` and **executed** in
Node against the real `buildingConfig.ts` and `parcelIdentity.ts`:

- `parcelId` → `KA-BLR-0482-001928`, formatted from the shared identity — the
  literal string does not appear in the data module.
- Parcel area **1 547 m²**; footprint area **252 m²**, matching
  `width × depth` = 18 × 14 exactly.
- Boundary and footprint each convert to four `[lat, lng]` pairs around
  `12.9352, 77.6245`; the footprint's corners lie inside the boundary's extent.
- Round-trip check with a haversine distance: a point authored 18 m east
  measures **17.98 m**, and 14 m north measures **13.98 m** — a 0.1% error from
  using one mean Earth radius, far below anything this prototype claims.
- `polygonAreaSqM()` returns 0 for a degenerate two-point ring rather than
  throwing.
- `src/map/parcelStyles.ts` also type-checks clean under the project's flags.

**What this does NOT cover.** The npm registry is unreachable from the sandbox,
so `react`, `react-leaflet` and `@types/leaflet` could not be installed and the
three `.tsx` map components have **never been type-checked or rendered**. Their
JSX, their prop types against react-leaflet v5, and all of the CSS are
unverified. `npm run build` on the host is the only real gate for this phase.

## Git checkpoint — Phase 7

**None. Phase 7 is deliberately not committed**, in keeping with every previous
phase: the developer commits after verifying on the host. Note that Phase 6 is
also still uncommitted, so a commit made now would carry both phases unless they
are staged separately.

## Completed — Phase 8 (footprint-driven 2D→3D generation) — *source complete, NOT verified on the host, NOT committed*

**The 2D building footprint is now the authoritative geometric source for the 3D
building.** Before this phase the 3D model was generated from
`BuildingConfig.width` / `.depth` and the map drew a rectangle computed from
those same two scalars — the model was primary and the cadastral footprint was a
picture of it. Phase 8 reverses that. A polygon is authored once, in the data
layer, and everything horizontal is measured from it.

```
DEMO_BUILDING_FOOTPRINT_M   (4 corners, metres, data/demoParcel.ts)
        │
        ├─► footprintFromEastNorth()  east→X, north→Z
        │        │
        │        ├─► getFootprintMetrics()   width 18 · depth 14 · area 252 · centroid (0,0)
        │        ├─► createFootprintPadGeometry()    the plan, on the ground
        │        ├─► createBuildingShellGeometry()   the plan, extruded to 15 m
        │        └─► buildApartmentUnits()           the volume, cut into 20 units
        │
        └─► localPointToGeoPoint() ─► the Leaflet polygon
```

What was done:

- **`BuildingConfig.width` and `.depth` were removed.** The config now carries
  only the vertical description (`numberOfFloors`, `floorHeight`) and the
  subdivision grid (`unitColumns`, `unitRows`). Nothing under `src/scene/`
  contains the number 18 or 14 any more.
- **New `src/geometry/footprint.ts`** — `MetricPoint2D`, `BuildingFootprint`,
  `FootprintBounds`, `FootprintMetrics`, and pure functions for bounds, width,
  depth, area (shoelace), centroid (area-weighted), and
  `isAxisAlignedRectangle()`. It also fixes the axis convention in one place:
  **East = +X, North = +Z, Up = +Y**, via `footprintFromEastNorth()`.
- **`buildApartmentUnits(config, footprint)`** — the footprint is a required
  second parameter with no default, so the compiler found every call site. The
  grid is laid over the footprint's bounding box rather than over config scalars.
- **New `src/scene/footprintGeometry.ts`** — the only file that knows both
  `BuildingFootprint` and `THREE`. `createFootprintShape()` (with the deliberate
  `y = −point.z`), `createFootprintPadGeometry()` (`ShapeGeometry`),
  `createBuildingShellGeometry()` (`ExtrudeGeometry`, `bevelEnabled: false`,
  `steps: 1`), `createFootprintOutlineGeometry()`, and the shared
  `FOOTPRINT_FLAT_ROTATION`.
- **Two new scene components** — `FootprintPad` draws the cadastral plan on the
  ground (same green as the map's footprint layer), `BuildingShell` draws the
  extruded envelope, translucent, before generation.
- **A "Generate 3D Cadastre" workflow.** Two states: *source* (parcel, footprint,
  restrained pre-generation viewer showing the plan and its translucent
  envelope) and *generated* (the twenty selectable property units). A 620 ms
  eased ramp between them, `prefers-reduced-motion` respected, plus a
  *Reset to source* so the transformation can be shown twice.
- **A five-step pipeline indicator** — Parcel Loaded → Footprint Loaded → 3D
  Structure Generated → Vertical Units Created → Prototype ULPIN Assigned. Two
  complete on load, all five after generation. Derived by a pure function from
  the model, so a view cannot claim a step it has not done. **No validation step
  — that is Phase 9.**
- **New `src/geometry/footprintSelfCheck.ts`** — the Phase 6 self-check pattern
  applied to the geometry, with literal expectations.
- **Duplication removed.** One shoelace implementation (`polygonAreaSqM` is now a
  thin adapter onto it). One footprint measurement, taken in `App` and passed
  down to the summary, the parcel panel, the pipeline and the camera. The
  shadow-camera extent (`±30 m`) and the camera position (`[26, 18, 30]`) are no
  longer hard-coded — both derive from the footprint's own extent.

**Geometry is unchanged on purpose.** 18 × 14 m, 252 m², 5 floors, 15 m,
20 units of 9 × 7 × 3 m = 63 m² / 189 m³, numbered 101–504, identifiers
`KA-BLR-0482-001928-F01-U01` … `-F05-U04`. Phase 8 is a change of architecture,
not of the demo. A refactor whose numbers moved would be indistinguishable from
one that broke something.

**No dependencies added.** `THREE.Shape` / `ExtrudeGeometry` / `ShapeGeometry`
ship with `three`; the transition is plain `requestAnimationFrame`.
`package.json` and `package-lock.json` are untouched by this phase — the
outstanding `npm install` is still Phase 7's.

## Files changed in Phase 8

**New:**

| File | What it is |
|---|---|
| `src/geometry/footprint.ts` | the footprint types, the axis convention, and every measurement taken from a polygon |
| `src/geometry/footprintSelfCheck.ts` | pure literal-answer checks for the Phase 8 geometry; dev-only runner |
| `src/scene/footprintGeometry.ts` | polygon → `THREE.Shape` → `ShapeGeometry` / `ExtrudeGeometry`, plus the rotation they must be drawn with |
| `src/scene/FootprintPad.tsx` | the 2D cadastral plan drawn flat in the 3D scene |
| `src/scene/BuildingShell.tsx` | the extruded envelope, shown before generation |
| `src/ui/GenerateCadastreControl.tsx` | the Generate / Reset control over the viewer |
| `src/ui/PipelineStatus.tsx` | the five-step pipeline card |
| `src/ui/useFadeProgress.ts` | the 0→1 generation ramp (rAF, no library) |
| `src/workflow/pipelineSteps.ts` | the pipeline as derived data |

**Modified:**

| File | Change |
|---|---|
| `src/scene/buildingConfig.ts` | `width` / `depth` **removed**; docs explain why the vertical fields stayed |
| `src/scene/unitLayout.ts` | `buildApartmentUnits(config, footprint, …)`; grid laid over the footprint bounds; `zMin`/`zMax` doc corrected to south/north |
| `src/data/demoParcel.ts` | `DEMO_BUILDING_FOOTPRINT_M` authored here and now authoritative; `buildFootprintOutlineM(config)` **removed**; `DemoParcel` gains `buildingFootprintMetric` + `buildingFootprintOutlineM`; `polygonAreaSqM` delegates to `geometry/footprint.ts`; no longer imports `buildingConfig` |
| `src/scene/SceneViewer.tsx` | takes the footprint, its metrics, total height, `isGenerated`, `generationProgress`; camera and shadow box derived; draws pad → shell → units |
| `src/scene/Building.tsx` | optional `opacity` prop, transparent **only** while the fade runs |
| `src/ui/BuildingSummary.tsx` | footprint read from `FootprintMetrics`; a pre-generation state; states the rectangular-grid assumption |
| `src/map/ParcelInfoPanel.tsx` | takes `footprintMetrics`; shows the footprint's plan dimensions |
| `src/App.tsx` | owns `isGenerated`; measures the footprint once; runs both self-checks in dev; renders the pipeline and the generate control |
| `src/index.css` | the generate bar, the pipeline card, `.summary-pending` / `.summary-note`, `.visually-hidden`; `.inspector-panel` became a two-card grid |
| `ARCHITECTURE.md` | new §8 (nine sub-sections); §3.2 and §4.2 marked superseded-in-part; repo tree updated; sections renumbered to 9 and 10 |
| `PROJECT_STATUS.md` | this record |

**Untouched:** `src/ulpin/` (all three files), `src/scene/Ground.tsx`,
`src/ui/PropertyInspector.tsx`, `src/map/GISMap.tsx`, `src/map/MapLegend.tsx`,
`src/map/parcelStyles.ts`, `src/main.tsx`, `package.json`,
`package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`.

## Local verification REQUIRED — Phase 8

Nothing in this phase has run in a browser. **`npm run build` on the host is the
only real gate** — the sandbox cannot install `react`, `three`, `@react-three/*`
or `react-leaflet` (the npm registry is unreachable from it), so every `.tsx`
file, all JSX prop typing, and all CSS are unverified.

**Phase 7's `npm install` is still outstanding and still blocks everything.**
Run it first.

```
cd C:\Users\Admin\Projects\3d-ulpin
npm install          # Phase 7's leaflet / react-leaflet / @types/leaflet
npm run build        # tsc --noEmit && vite build  ← the gate
npm run dev
```

Then work down this list, in order.

**Build and console**

1. `npm run build` passes. If `tsc` complains about `config.width` or
   `config.depth` anywhere, a call site was missed — those fields no longer exist.
2. `npm run dev` starts and the page renders with no red console errors.
3. The console shows **two** dev self-checks passing:
   `[3D ULPIN] self-check passed (4 checks)` and
   `[3D ULPIN] footprint geometry self-check passed (18 checks)`.
4. No `not an axis-aligned rectangle` warning (the demo footprint is one).

**Source state — before pressing anything**

5. The 3D viewer shows the ground grid, a **green footprint rectangle lying on
   the ground**, and a **translucent extruded box** standing on it. No solid
   unit boxes.
6. The building summary reads **Footprint (source): 18.0 × 14.0 m, 252 m², 4
   vertices**, then Building: 5 floors, 3.0 m, 15.0 m, then *Property units —
   Not generated. 20 units will be cut from this footprint.*
7. The pipeline card reads **2/5**: Parcel Loaded ✓, Footprint Loaded ✓, and
   three pending steps.
8. The footer status reads *Source Geometry Loaded — Awaiting Generation*.
9. Clicking in the 3D view selects nothing; the inspector stays empty.
10. Orbit / zoom / pan all work in this state.

**The transformation**

11. Press **Generate 3D Cadastre**. The envelope fades out and twenty unit boxes
    fade in, over about half a second. No flicker, no z-fighting during or after.
12. The button is replaced by *3D cadastre generated — 5 floors, 20 vertical
    property units from the footprint polygon*, with a *Reset to source* button.
13. The pipeline card reads **5/5**.
14. The footer reads *Vertical Property Units Active*.

**Generated state — every Phase 4–7 feature must survive**

15. **20 unit meshes**, 4 per floor, 5 floors, filling the footprint exactly.
16. Clicking a unit selects it: amber fill plus the wireframe cage.
17. Hover still shows the cool glow and the pointer cursor, and never looks like
    selection.
18. Clicking empty space clears the selection; an orbit drag does **not** select
    or clear.
19. The property inspector shows the prototype 3D ULPIN block first, the
    disclaimer, parent parcel `KA-BLR-0482-001928`, unit, floor, property type,
    **63 m²**, **189 m³**, elevation, 3D bounds, centroid.
20. Unit **302** shows `KA-BLR-0482-001928-F03-U02` and bounds
    **X 0.0 → 9.0, Y 6.0 → 9.0, Z −7.0 → 0.0**; unit **301** shows
    **X −9.0 → 0.0, Y 6.0 → 9.0, Z −7.0 → 0.0**. (These are the coordinates the
    sandbox run confirmed, and they are the Phase 4–7 coordinates unchanged.)
21. The building summary now shows the property-unit block: 20 units, 4 per
    floor (2 × 2), 9.0 × 7.0 m, 63 m², 189 m³, and the note about the
    rectangular grid.
22. The green footprint rectangle is **still visible on the ground**, dimmer, and
    the building's walls land exactly on it from every orbit angle. *This is the
    thing to show a judge.*

**The map, and map ↔ model agreement**

23. The Leaflet map still renders: dashed parcel boundary, solid green footprint,
    white centre dot, tooltips, legend, dark basemap.
24. The parcel panel reads parcel area **1 547 m²**, building footprint
    **252 m²**, and the new **Footprint plan: 18.0 × 14.0 m**.
25. The footprint polygon on the map and the footprint rectangle in the 3D scene
    describe the same shape at the same scale — the same 252 m² is quoted in the
    map panel, the building summary and the pipeline card.

**Reset**

26. Press **Reset to source**: the units disappear, the envelope returns, the
    pipeline drops to 2/5, and any selection is cleared.
27. Press **Generate** again — it works a second time.

**Layout**

28. Three columns at desktop width; the right column shows the pipeline card
    above the property inspector with a gap between them, and scrolls on its own
    if the record is tall.
29. The generate bar sits centred at the foot of the 3D viewer and does not
    block orbiting elsewhere in the canvas.
30. Below 1100 px the columns stack and the page scrolls, as in Phase 7.
31. Keyboard: Tab reaches the Generate button and it has a visible focus ring;
    Enter or Space activates it.

**Deployment (only after all of the above)**

32. If committing, note that **Phases 6, 7 and 8 are all uncommitted** — a commit
    made now carries all three unless they are staged separately.
33. `package-lock.json` will have changed from Phase 7's `npm install`, and Vercel
    needs it committed to build reproducibly.

## Verified in the cloud sandbox — Phase 8 (pure logic only)

Every non-React, non-Three.js module was compiled under
`tsc --strict --noUnusedLocals --noUnusedParameters --verbatimModuleSyntax`
(**clean, zero errors**) and then **executed** in Node against the real
`demoParcel.ts`, `buildingConfig.ts`, `unitLayout.ts`, `parcelIdentity.ts` and
`generateUlpin.ts`.

`checkFootprintGeometry()` — **18 checks, all passing**:

| Check | Expected | Actual |
|---|---|---|
| footprint width | 18 m | 18 |
| footprint depth | 14 m | 14 |
| footprint area | 252 m² | 252 |
| centroid X / Z | 0 / 0 | 0 / 0 |
| vertices | 4 | 4 |
| axis-aligned rectangle | true | true |
| total height | 15 m | 15 |
| floor height / floors | 3 m / 5 | 3 / 5 |
| generated units | 20 | 20 |
| every unit 63 m² | 20 of 20 | 20 of 20 |
| every unit 189 m³ | 20 of 20 | 20 of 20 |
| ground floor tiles the footprint | 252 m² | 252 |
| no unit beyond the footprint bounds | none | none |
| map area == model area | 252 m² | 252 |

Also executed and confirmed:

- **Phase 6 regression** — the 20 identifiers generated through the new
  `buildApartmentUnits(config, footprint)` signature still match the literal
  known answers and are still unique.
- **Unit coordinates are byte-identical to Phases 4–7.** Floor 3: 301 at
  x −9→0 / z −7→0, 302 at x 0→9 / z −7→0, 303 at x −9→0 / z 0→7, 304 at
  x 0→9 / z 0→7 — all y 6→9, all 63 m² / 189 m³.
- **Map/model object identity** — `DEMO_PARCEL.buildingFootprintMetric` is one
  array, converted once; the projected lat/lng ring is unchanged from Phase 7
  (`12.935137, 77.624417` … `12.935263, 77.624583`), and the parcel is still
  1 547 m².
- **Round trip** — `eastNorthFromFootprint(footprintFromEastNorth(ring))` is
  identical to the authored ring.
- **Winding independence** — reversing the ring leaves area at 252 m² and the
  centroid at (0, 0).
- **Irregular footprint, as documented** — a six-vertex L-shape reports a true
  polygon area of 189 m² against a bounding-box area of 252 m², a centroid at
  (−1.5, −1.17), `isAxisAlignedRectangle → false`, and still generates 20 units
  *over the bounding box* — which is exactly the limitation §8.8 describes,
  demonstrated rather than asserted.
- **Pipeline** — 2/5 complete before generation, 5/5 after, with the detail
  lines rendering as intended.

**Not covered, and the reason:** the npm registry is unreachable from the
sandbox (403 at the network layer), so `react`, `three`, `@react-three/fiber`,
`@react-three/drei` and `react-leaflet` cannot be installed. A JSX pass with
those modules absent produced **no syntax errors and no logic-level type
errors** — every remaining diagnostic was `TS2307` (module not found),
`TS7026`/`TS2875` (unknown JSX intrinsic, i.e. the R3F element types), `TS2882`
(CSS side-effect import) or a cascade from those. That is evidence the files
parse and the pure code type-checks; it is **not** evidence that the R3F props,
the `ExtrudeGeometry` rotation, the material transparency or any CSS is right.
`npm run build` and a browser on the host are the only real gate.

## Git checkpoint — Phase 8

**None. Phase 8 is deliberately not committed**, in keeping with every previous
phase: the developer commits after verifying on the host. Phases 6 and 7 are
also still uncommitted, so a commit made now would carry all three unless they
are staged separately.

## Completed — Phase 9 (presentation: animated 2D→3D generation, exploded view, camera presets) — *source complete, NOT verified on the host, NOT committed*

**The phase changed nothing about the model. It changed when and where the model
is drawn.** The twenty property units, their bounds, their areas and their
identifiers are byte-for-byte what Phase 8 produced. No dependency was added.

- [x] **The pre-generation state is now purely 2D.** The translucent extruded box
      Phase 8 showed before generation is **gone**. What remains on the ground is
      a parcel-aligned base plane, the filled footprint polygon, its surveyed
      outline and four corner ticks — flat geometry only, nothing above `y = 0`.
      The centre viewer and the GIS map now show the same thing in two
      projections, which is exactly the claim: *this is the 2D record we hold*.
- [x] **A staged 2.2 s generation animation**: the footprint pulses → the
      envelope rises out of it (0 → 15 m) → floor plates appear bottom-up →
      property units grow into place floor by floor as the envelope hands over.
      The windows overlap so it reads as one continuous build.
- [x] **Every timing value is a pure function of one progress number.** No
      timers, no chained `setTimeout`, no per-component animation state. The
      scene at progress 0.63 is the same scene however it was reached.
- [x] **Floor plates** (`FloorSlabs.tsx`) — one 12 cm slab per floor, on the
      floor's own `baseY`, so it never intersects a unit.
- [x] **Selection is gated on the animation having *settled*, not merely started.**
      Clicks and hover are suppressed for every frame of the transition.
- [x] **Everything from Phases 4–8 still works once settled** — 20 units, click
      to select, amber highlight + edge cage, Property Inspector, prototype
      ULPIN, building summary, GIS map, pipeline card.
- [x] **Exploded view**, gated on the generation having settled. Floors separate
      upward with an eased 620 ms transition in both directions. Selection and
      the inspector keep working while exploded.
- [x] **The exploded offset is display-only.** `yMin` / `yMax` are never
      modified; the inspector still reports unit 301 as 6–9 m. Asserted in the
      self-check.
- [x] **Four camera presets** — Parcel, Building, Top, Selected Unit — each
      derived from the building's own extent, each flown to over 850 ms with
      `EASE_IN_OUT_CUBIC`. OrbitControls is handed back cleanly on arrival.
      "Selected Unit" is disabled (not hidden) until something is selected.
- [x] **Restrained 3D labels** — floor labels `F1…F5` **only** in exploded view;
      the unit number **only** for the selected unit. Nothing else is labelled.
- [x] **Reset returns to source in one action** — generation flag, selection,
      exploded mode and camera all cleared together. The progress ramp snaps to
      zero rather than rewinding.
- [x] **Workflow feedback**: a stage-by-stage status strip with a determinate bar
      during the transition; a third `active` state on the pipeline steps; a
      disabled "Generating…" primary button so a second press cannot look ignored.
- [x] **Visual polish** — three lights doing three jobs (hemisphere fill, one
      shadow-casting key with bias correction, an unshadowed rim), shared edge
      geometry on every unit, capped DPR, tuned materials.
- [x] **A new self-check** (`animation/generationSelfCheck.ts`, 30 checks) that
      *samples* the timeline in 200 steps and asserts monotonicity, bottom-up
      ordering and exactness at both endpoints.
- [x] **No new dependencies.** `package.json` is unchanged.

Deliberately **not** in this phase, per the brief: no topology validation, no
conflict simulation, no AI, no backend, no basement, no architectural rewrite.

## Files changed in Phase 9

**New — `src/animation/` (pure: no React, no Three.js, no DOM):**

| File | What it is |
|---|---|
| `easing.ts` | `clamp01`, `subProgress`, `LINEAR` / `EASE_OUT_CUBIC` / `EASE_IN_OUT_CUBIC` / `pulse` / `mix`. Exported as module constants so they are stable references and cannot restart an animation on every render. |
| `generationTimeline.ts` | **The sequence.** `GENERATION_DURATION_MS`, the four stage windows, `getGenerationVisuals(progress, floorCount)` and the stage wording. |
| `generationSelfCheck.ts` | 30 checks over a 200-step walk of the timeline, plus the exploded transform and the camera presets. Dev-only runner, throws on failure. |

**New — `src/scene/`:**

| File | What it is |
|---|---|
| `explodedView.ts` | `getExplodedOffsetM(floorIndex, amount)` and the apparent-height helper. Pure. The one place the display offset is defined, so the units, the plates, the cage and the labels cannot disagree. |
| `cameraPresets.ts` | Four named views as pure tuple arithmetic. No `three` import. `getPresetView` is total. |
| `CameraRig.tsx` | The only file that turns a view into motion. Refs only, no state. Owns `controls.target`. |
| `FloorSlabs.tsx` | One 12 cm plate per floor; one geometry shared across all of them. |
| `SceneLabels.tsx` | drei `<Html>` labels, under the restraint rule above. |

**New — `src/ui/`:**

| File | What it is |
|---|---|
| `GenerationStatus.tsx` | Stage name + determinate bar, visible only while the transition runs. |
| `ViewControls.tsx` | The four presets as a segmented control, plus the exploded toggle. |

**Modified:**

| File | Change |
|---|---|
| `src/App.tsx` | Owns `isExploded`, the camera request (token in a ref), and derives `GenerationVisuals` once. Builds `floors` once and passes it to `buildApartmentUnits` **and** the scene. Reset clears all four things. Runs the new self-check in dev. |
| `src/scene/SceneViewer.tsx` | Distributes `GenerationVisuals`; three-light rig with shadow bias; `dpr={[1,2]}`; mounts `FloorSlabs`, `SceneLabels`, `CameraRig`. **`target` removed from `<OrbitControls>`** — the rig owns it now. |
| `src/scene/FootprintPad.tsx` | Base plane + corner ticks + the pulse. This component is now the entire pre-generation scene. |
| `src/scene/BuildingShell.tsx` | `heightFraction` — the extrusion, animated, via a local-Z scale on the rotated group. Presence starts at **0**, so it is absent before generation. |
| `src/scene/Building.tsx` | Per-floor reveal (units grow from their own `yMin`), exploded offset, shared `EdgesGeometry` per distinct unit size, `interactive` gate. |
| `src/scene/footprintGeometry.ts` | `createFloorSlabGeometry()` added. Nothing else touched. |
| `src/workflow/pipelineSteps.ts` | Third state `active`, driven by the animation stage. `countCompletedSteps` still counts only `complete`. |
| `src/ui/PipelineStatus.tsx` | Renders the `active` state; adds the status line above the list. |
| `src/ui/GenerateCadastreControl.tsx` | Third, disabled "Generating…" state. |
| `src/ui/useFadeProgress.ts` | Generalised: `durationMs`, `reverseDurationMs` (0 = snap) and `easing`. Distance-scaled so an interrupted ramp does not take the full time. Now the only animation driver in the app. |
| `src/index.css` | View controls, generation status strip, `pipeline-step-active`, 3D label styles, disabled button state, a `prefers-reduced-motion` guard on the one CSS animation, and stacked-layout adjustments below 1100 px. |
| `ARCHITECTURE.md` | New §9 (11 subsections); §§9–10 renumbered to 10–11; repo tree and intro updated. |
| `PROJECT_STATUS.md` | This. |

**Unchanged, deliberately:** `package.json`, `unitLayout.ts`, `buildingConfig.ts`,
`geometry/footprint.ts`, `ulpin/*`, `data/demoParcel.ts`, `map/*`,
`PropertyInspector.tsx`, `BuildingSummary.tsx`, `Ground.tsx`, `main.tsx`.

## Local verification REQUIRED — Phase 9

**Phase 7's `npm install` is still the first thing to do.** Nothing in Phases 7,
8 or 9 builds until `leaflet`, `react-leaflet` and `@types/leaflet` are
installed.

```powershell
cd C:\Users\Admin\Projects\3d-ulpin
npm install
npm ls react-leaflet      # confirm it resolved to 5.x
npm run build             # tsc --noEmit && vite build — the real gate
npm run dev
```

Then, in the browser:

**A. Source state (before pressing anything)**

- [ ] The 3D viewer shows **only flat geometry**: a base plane, the green
      footprint polygon, its outline and four corner ticks. **No box, no
      wireframe cage, no walls, no floors, no units.**
- [ ] The footprint in the viewer is visibly the same shape as the one on the
      Leaflet map.
- [ ] Pipeline card reads **2/5**, status line "Source geometry loaded".
- [ ] Dev console shows three self-checks passing, including
      `generation timeline self-check passed (30 checks)`.

**B. The generation animation**

- [ ] Press **Generate 3D Cadastre**. It takes about 2.2 seconds and reads as:
      footprint flash → building rises → floor plates appear bottom-up → units
      fill in bottom-up.
- [ ] **No flicker, no re-mount pop, nothing appears then disappears.**
- [ ] The status strip appears at the top with a moving bar and the stage names
      "Extruding 3D structure" → "Creating floor plates" → "Creating vertical
      property units".
- [ ] The button reads "Generating…" and is disabled during the transition.
      Pressing it again does nothing visible and does not restart anything.
- [ ] **Clicking a unit mid-animation selects nothing.** The inspector stays
      empty until the building has settled.
- [ ] Pipeline goes 2/5 → 5/5 with the middle steps showing the pulsing `active`
      marker on the way.

**C. Post-generation — everything from earlier phases**

- [ ] 20 units, 4 per floor. Click one: amber fill, bright edge cage, the unit
      number floating above it.
- [ ] Property Inspector fills in with the prototype ULPIN, area, volume,
      elevation. Values identical to Phase 8.
- [ ] Building summary shows 20 units, 63 m², 189 m³.
- [ ] Click empty space to deselect. Orbit, zoom and pan all still work.

**D. Camera presets**

- [ ] **Building** is the opening view; the camera does not jump on load.
- [ ] **Parcel** pulls back and down; **Top** goes straight overhead and the plan
      view visibly matches the map footprint.
- [ ] **Selected Unit** is disabled until a unit is selected, then frames it.
- [ ] Each move is a smooth ~0.85 s flight, not a cut.
- [ ] **After a flight, dragging still orbits normally** — this is the one that
      would show a bug in the rig's hand-off.
- [ ] Pressing the same preset twice re-frames the second time.

**E. Exploded view**

- [ ] Disabled before generation; enabled after.
- [ ] Toggle on: floors separate upward smoothly, ground floor stays put.
- [ ] `F1`…`F5` labels appear beside the separated floors and nowhere else.
- [ ] **Unit selection still works while exploded**, and the cage sits on the
      unit's drawn position, not its stacked one.
- [ ] **The Property Inspector's elevation is unchanged by exploding** — unit 301
      still reads 6–9 m. *This is the check that proves it is a view, not a
      geometry edit.*
- [ ] Toggle off: floors restack smoothly.

**F. Reset**

- [ ] Press **Reset to source**. The building disappears instantly, the scene
      returns to flat 2D, the selection clears, exploded view turns off, and the
      camera returns to the opening view.
- [ ] Press Generate again — the full animation runs a second time, identically.
      Repeat three or four times; nothing should degrade.

**G. Accessibility and layout**

- [ ] With OS "reduce motion" on: pressing Generate goes straight to the finished
      building, presets jump rather than fly, and nothing else changes.
- [ ] Narrow the window below 1100 px: the columns stack, and the view controls
      and status strip move without overlapping the summary panel.

**H. Performance**

- [ ] The animation is smooth on the demo machine. If it is not, the first thing
      to look at is the shadow map (2048²) and the per-unit edge lines.

## Verified in the cloud sandbox — Phase 9 (source only)

**What passed:**

- **The entire source tree type-checks** under
  `--strict --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch`
  — *every `.tsx` file included*, which is more than Phase 8 achieved. This was
  possible because minimal hand-written stubs for `react`, `three`,
  `@react-three/fiber` and `@react-three/drei` were written for the sandbox
  (they are **not** part of the repo).
- **The new self-check ran in Node: 30 / 30 passed.** Endpoints exact at both
  ends; no reversal in any reveal across 200 samples; no bottom-up inversion;
  envelope presence within `[0, 1]` and actually visible mid-transition; clamping
  at −0.5 and 1.7; determinism; ground floor never moves when exploded; unit 301
  still 6–9 m; all presets finite; top view above the building; unit view falls
  back to the building view.
- **Phase 8's footprint self-check still passes, 17 / 17**, unchanged.
- **The `building` camera preset reproduces Phase 8's hand-tuned framing to the
  centimetre**: `[26.10, 18.00, 29.70]`, target `[0, 7.50, 0]`.
- The timeline was printed at eleven sample points and read as designed (the
  table is in ARCHITECTURE §9.3).

**What could NOT be checked here:**

- The npm registry is unreachable from the sandbox (HTTP 403), so `react`,
  `three`, `@react-three/*` and `react-leaflet` cannot be installed.
- Therefore: **no drei or R3F prop name is verified.** `<Html>`'s
  `distanceFactor` / `zIndexRange`, `shadow-normalBias`, `hemisphereLight` args,
  `raycast={() => null}` and the `scale` on a rotated group are all *believed*
  correct and are exactly the kind of thing `npm run build` would catch.
- Nothing has rendered. The animation has never been watched; the exploded view,
  the camera flights and the labels have never been seen.
- No CSS has been rendered.

**`npm run build` on the host remains the only real gate.**

## Git checkpoint — Phase 9

**None. Phase 9 is deliberately not committed**, in keeping with every previous
phase: the developer commits after verifying on the host. Phases 6, 7, 8 and 9
are all still uncommitted, so a commit made now would carry four phases unless
they are staged separately.


## Completed — Subphase A (full ownership exploded view) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** carry the exploded view one level further, so the picture runs
`parcel → floor layers → individual apartment ownership volumes` instead of
stopping at the floor.

- [x] **The vertical floor explosion is unchanged.** Same constant, same easing,
      same behaviour. Subphase A added a second axis; it did not rework the first.
- [x] **A second level of separation.** Each floor's units now slide outward from
      the middle of that floor, so the four properties on a level read as four
      owned volumes rather than one slab with lines on it.
- [x] **Three ordered levels replace the boolean toggle**: `Stacked → Floors →
      Units`, as a segmented control beside the camera presets. One `ExplodeMode`
      value, not two booleans — "units apart, floors together" is a state the
      interface should not be able to reach.
- [x] **The horizontal direction is derived, never tabulated.**
      `direction = normalise(unitPlanCentre − floorPlanCentre)`, times
      `EXPLODED_UNIT_DISTANCE_M`, times the amount. Nothing anywhere mentions
      101/102/103/104. A 3 × 4 grid would work unchanged; the middle unit of a
      3 × 3 grid correctly does not move.
- [x] **Normalised, not scaled**, so every unit moves the same distance and the
      floor opens evenly rather than flying apart in proportion to its size.
- [x] **Two independent eased ramps**, both directions, so entering and leaving
      the mode are equally watchable. The unit ramp is 760 ms against the floors'
      620 ms, so going straight from stacked to fully exploded reads as "layers,
      then properties" rather than one scatter.
- [x] **Visualisation only.** No bound, area, volume, centroid or identifier is
      touched. Asserted, not asserted-in-prose: the self-check snapshots the
      units, runs every offset function over them at full explosion, and compares.
- [x] **The selection cage, the unit label and the "Selected Unit" camera preset
      all call the same `getUnitDisplayOffsetM`** as the mesh itself, so the four
      cannot disagree about where a property is drawn.
- [x] **Clicking an exploded unit still selects the right record** — the meshes
      move, so the raycast moves with them; nothing about selection changed.
- [x] **The honesty line**, shown whenever an explosion is active:
      *"Visualization offset only — cadastral geometry unchanged"*. Held as a
      constant next to the transform so the two cannot drift apart.
- [x] **The generation animation still works** — the explosion controls are
      disabled until it has settled, exactly as before.
- [x] **15 new pure self-checks** (`scene/explodedSelfCheck.ts`).

### Files changed in Subphase A

| File | Change |
|---|---|
| `src/scene/explodedView.ts` | **Rewritten and extended.** `ExplodeMode`, `ExplodeAmounts`, `NO_EXPLOSION`, `PlanPoint`, `HorizontalExtent`, `getPlanCentre`, `buildFloorPlanCentres`, `getUnitPlanOffsetM`, **`getUnitDisplayOffsetM`** (the one shared offset), `getFloorDisplayOffsetM`, `getExplodedApparentSpreadM`, `EXPLODED_VIEW_NOTE`. Still pure — no React, no Three.js. |
| `src/scene/explodedSelfCheck.ts` | **New.** 15 checks: derived direction and distance per unit, opposite units cancel, the degenerate centred unit, the combined offset, and the architectural check that the transform never writes to the model. |
| `src/scene/Building.tsx` | Units are placed with the full three-axis offset; the selection cage takes an `offset` triple instead of a `yOffset` number. |
| `src/scene/FloorSlabs.tsx` | Takes `ExplodeAmounts`; reads only the vertical component — a plate *is* the floor, so it stays whole while its units disperse. |
| `src/scene/SceneLabels.tsx` | The selected unit's label rides the same offset as its mesh; floor labels keyed off `amounts.floors`. |
| `src/scene/SceneViewer.tsx` | Distributes `explodeAmounts` and `floorPlanCentres`. |
| `src/scene/cameraPresets.ts` | Context takes `explodeAmounts` + `floorPlanCentres`; the `unit` preset frames the unit *where it is drawn*; `parcel`/`top`/`building` account for the wider apparent plan. |
| `src/ui/ViewControls.tsx` | The toggle became a three-step segmented control, plus the honesty note. |
| `src/App.tsx` | `explodeMode` state, two ramps, `explodeAmounts`, `floorPlanCentres` built once; reset returns the mode to `'none'`; runs the new self-check in dev. |
| `src/animation/generationSelfCheck.ts` | The three exploded checks moved out to the new module; camera context updated. |
| `src/index.css` | `.view-explode-group`, `.view-note`; the dead `.view-toggle` rules removed. |

### Self-checks performed — Subphase A (cloud sandbox, source only)

- Whole tree typechecks under `--strict --noUnusedLocals --noUnusedParameters`
  against hand-written stubs (the sandbox cannot install react/three/@react-three).
- All pure self-checks compiled and **executed in Node: 58/58 assertions pass** —
  `checkExplodedView` 15/15, `checkGenerationTimeline` 26/26,
  `checkFootprintGeometry` 17/17.

### Still requires Windows verification — Subphase A

- [ ] `npm install` (still outstanding from Phase 7) then `npm run build`.
- [ ] **Stacked → Floors**: unchanged from Phase 9 — floors lift, ground floor stays.
- [ ] **Floors → Units**: on each floor the four units slide diagonally outward,
      evenly, leaving a visible cross-shaped channel. The floor plates stay whole.
- [ ] **Stacked → Units directly**: both separations run at once and the floors
      settle fractionally first.
- [ ] Selecting an exploded unit: amber fill, cage **on the moved box**, label
      above the **moved** box, "Selected Unit" preset frames the **moved** box.
- [ ] Property Inspector figures are identical exploded and stacked — unit 301
      still 6–9 m, 63 m², 189 m³.
- [ ] The note *"Visualization offset only — cadastral geometry unchanged"*
      appears under the view controls in both exploded levels and nowhere else.
- [ ] Reset returns the level to Stacked.
- [ ] Console shows `exploded-view self-check passed (15 checks)`.

## Completed — Subphase B (floor isolation mode) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** let the presenter bring one vertical layer forward so judges can
inspect the properties occupying a single stratum.

- [x] **A floor-isolation control**: `All · F1 · F2 · F3 · F4 · F5`, a third
      segmented row beside the camera presets and the explosion levels. The
      levels are **derived from the model**, so a twelve-storey building gets
      twelve buttons with no edit.
- [x] **Ghosting, not hiding — and the reason is recorded.** Other floors drop to
      a tenth of their fill but keep **better than half their edges**, so they
      read as wireframes. Hiding was rejected because a single floating slab tells
      the viewer nothing about *where in the stack* the layer is, and a property's
      position in the stack is part of its identity. Ghosting also survives a
      top-down camera, where a plain fade does not.
- [x] **The isolated floor stays fully drawn and fully interactive**; its units
      remain clickable and the Property Inspector is unaffected.
- [x] **The stated priority rule** (requirement 7): *isolation decides how
      strongly a floor is drawn and whether it can be clicked; the explosion
      decides where it is drawn. Neither reads the other.* They compose by
      multiplication, so **all six combinations are defined** and none is a
      special case — including the most useful picture the prototype can make:
      one floor solid, its four properties dispersed, the rest of the building in
      outline around them. The one non-orthogonal rule — *while a floor is
      isolated, only that floor's units are clickable* — is asserted in the
      self-check rather than left to be discovered.
- [x] **Ghosts stop casting shadows and stop writing depth**, so they neither
      throw solid shadows from barely-visible geometry nor occlude the layer they
      are meant to be framing.
- [x] **A contextual indicator**, under the building summary:
      `ISOLATED LAYER / Floor 3 / 4 property volumes / Elevation 6.0 – 9.0 m /
      252 m² combined`. **Every figure is derived** — the count is the units
      actually on that floor and the elevations are read back off those units'
      own bounds. A floor with no units returns `null` rather than a zeroed
      record, so the panel is absent rather than confidently wrong.
- [x] **Floor labels where useful**: every floor when exploded (unchanged), and
      *only the isolated one* when isolated in the stacked view — in the accent
      colour, matching the indicator that names it.
- [x] **A fifth camera preset, `Floor`,** framing the isolated layer at a low
      angle so the property volumes keep their third dimension. It follows the
      exploded offset, so it frames the layer where it is drawn.
- [x] **Automatic framing**: choosing a floor also flies the camera to it, and
      choosing `All` returns to the building view — one rehearsable click.
- [x] **A selection on another floor is cleared when isolating**, so the inspector
      never describes a property that has just been pushed into the background.
- [x] **Reset clears isolation** along with everything else.
- [x] **14 new pure self-checks** (`scene/floorIsolationSelfCheck.ts`).

### Files changed in Subphase B

| File | Change |
|---|---|
| `src/scene/floorIsolation.ts` | **New, pure.** `getFloorEmphasis(level, isolated, amount)` → fill/edge scales, interactivity, shadow-casting; `getIsolationSummary(level, units)` → the indicator's derived facts; `ISOLATION_DURATION_MS`. |
| `src/scene/floorIsolationSelfCheck.ts` | **New.** 14 checks, including the priority rule, the animation's identity element at `amount = 0`, that the indicator's figures are derived, and that isolation never writes to the model. |
| `src/ui/FloorIsolationPanel.tsx` | **New.** The indicator card. Formats only — it computes nothing. |
| `src/scene/Building.tsx` | Per-unit floor emphasis: fill × emphasis, edges × emphasis, `castShadow` and `depthWrite` off for ghosts, and `isTargetable = interactive && emphasis.interactive`. |
| `src/scene/FloorSlabs.tsx` | Plates ghost with their floor. |
| `src/scene/SceneLabels.tsx` | Labels the isolated floor in the stacked view; accent styling for it. |
| `src/scene/SceneViewer.tsx` | Distributes `isolatedFloor` / `isolationAmount`. |
| `src/scene/cameraPresets.ts` | `'floor'` preset added; context takes the resolved `FloorLayout`; preset list reordered to `Parcel · Building · Top · Floor · Unit`. |
| `src/ui/ViewControls.tsx` | The floor row; both conditional presets now share one `unmetRequirement` message. |
| `src/App.tsx` | `isolatedFloor` state, the isolation ramp, `floorLevels`, `isolatedFloorLayout`, `isolationSummary`, `handleIsolateFloor` (mode + selection + camera in one action); reset clears isolation. |
| `src/animation/generationSelfCheck.ts` | Camera context updated; `'floor'` added to the finite-coordinate sweep. |
| `src/index.css` | `.view-floor-group`, `.isolation-panel`, `.scene-label-isolated`, stacked-layout adjustments. |

### Self-checks performed — Subphase B (cloud sandbox, source only)

- Whole tree typechecks under `--strict --noUnusedLocals --noUnusedParameters`.
- All pure self-checks executed in Node: **72/72 assertions pass** —
  `checkFloorIsolation` 14/14, `checkExplodedView` 15/15,
  `checkGenerationTimeline` 26/26, `checkFootprintGeometry` 17/17.

### Still requires Windows verification — Subphase B

- [ ] Isolating F3 ghosts the other four floors as wireframes and flies the
      camera to floor 3.
- [ ] Units on floor 3 stay clickable; **units on ghosted floors do not respond
      to hover or click** (the priority rule).
- [ ] The indicator reads `Floor 3 / 4 property volumes / 6.0 – 9.0 m / 252 m²`.
- [ ] `F3` label appears beside the isolated floor and nowhere else.
- [ ] Isolation combined with `Floors` and with `Units` — all six combinations
      look deliberate and none flickers.
- [ ] Selecting a unit on F2, then isolating F3, clears the inspector.
- [ ] `All` returns every floor to full strength and the camera to the building view.
- [ ] Console shows `floor-isolation self-check passed (14 checks)`.

## Completed — Subphase C (topology validation engine) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** a genuine spatial validation engine — actual geometry and data
validation, not decorative green PASS labels.

**The test of a validator is whether anything can turn it red.** The self-check
therefore has two halves: the healthy demo model must come out clean on every
rule, and six *deliberately broken* models must each be caught. All 25
assertions pass, including the six breakages.

### The rules, all implemented as real geometry

| # | Rule | How it is actually decided |
|---|---|---|
| 1 | **Building within parent parcel** | Every footprint vertex inside the parcel ring *or on its boundary*, **and** no footprint edge properly crossing a parcel edge. Vertices alone would miss a footprint bulging through a notch in a concave plot — and the demo parcel is deliberately not a rectangle. Ring simplicity is checked too. |
| 2 | **Unit within building** | Each unit's four plan corners tested against the footprint polygon; each unit's Y extent tested against `0 → totalHeight`. Reported as two separate results because they fail for different reasons. |
| 3 | **Floor hierarchy** | Ordering, no negative base elevations, no zero/inverted heights, no floor starting below the top of the one beneath — and **every unit's own `yMin`/`yMax` must equal its assigned floor's**. |
| 4 | **Unique identifiers** | Every `prototypeUlpin` grouped; duplicates named. Reports rather than throwing, which is what a validator must do. |
| 5 | **3D ownership overlap** | Real AABB intersection over all 190 pairs, exactly as specified: per-axis `min(max) − max(min)`, conflict only when **all three** exceed epsilon, intersection volume `x × y × z`. |
| 6 | **Unit count / expected structure** | Compared against `getTotalUnits(config)` and `getUnitsPerFloor(config)` — parameters, not literals, so the check validates the model rather than the demo. A mismatch is a **warning**, not a conflict: a wrong count is a bug, not a spatial impossibility. |

**The boundary case is the one that would break everything quietly.** Adjacent
units share a wall (`overlapX = 0` exactly); stacked floors share a slab
(`overlapY = 0`). Touching is **not** overlapping — `>` not `>=` — and getting
that one character wrong turns a valid twenty-unit building into thirty-one
reported disputes. It is asserted directly, twice, plus the full 190-pair sweep.

The other boundary problem — ray casting is unreliable for a point exactly *on*
an edge, and every unit corner sits on the footprint edge by construction — is
solved by testing boundary proximity first and only then ray-casting.

### The result model

Structured, never strings. `ValidationResult { id, category, status, message,
chip, affectedUnitIds, details }`, rolled into a `TopologyReport { status,
results, passCount, warningCount, failCount, chips, conflictedUnitIds }`.
Overall status is `valid | warning | conflict` — deliberately not the same union
as a single check's `pass | warning | fail`, because a *record* has a conflict
whereas a *check* fails. `conflictedUnitIds` is what Subphase D's red colouring
will read, so the finding and the geometry it names are tied by data.

**The chip text is written by the rule, not the view** — the rule already holds
the figures, so the bar cannot say "20 units" while the details say nineteen.

### The UI

- **A slim status bar** between the header and the working columns: one chip per
  category (worst-wins), a verdict badge, and a details toggle. Every word comes
  from the engine; there is not a single number in the component.
- **A details card** in the right-hand column, opened from the bar: every check,
  failures first, each with its sentence and its computed figures.
- **A sixth pipeline step, `Topology Validated`** — and a fourth pipeline state,
  `failed`, because until now no step could come out wrong. A conflict reads
  **5/6, not 6/6 with a red mark nobody notices**.

### Files changed in Subphase C

| File | Change |
|---|---|
| `src/validation/geometry2d.ts` | **New, pure.** Point-in-ring (strict and boundary-tolerant), distance-to-segment, proper segment crossing, ring-in-ring containment with evidence, signed area, winding, ring simplicity. |
| `src/validation/aabb.ts` | **New, pure.** Per-axis overlap extents, `getVolumeIntersection` (`null` vs zero-volume, deliberately), vertical range test, `OVERLAP_EPSILON_M`. |
| `src/validation/types.ts` | **New, pure.** The result model and `summariseResults`, including the per-category worst-wins chip rollup. |
| `src/validation/validateTopology.ts` | **New, pure.** The six rules and `validateTopology`; `findOwnershipConflicts` exported separately for Subphase D's banner. |
| `src/validation/validationSelfCheck.ts` | **New.** 25 checks: healthy model clean, the two touching cases, six deliberate breakages, the plane-geometry primitives, and no-mutation. |
| `src/ui/ValidationStatusBar.tsx` | **New.** The bar. Formats nothing. |
| `src/ui/ValidationDetails.tsx` | **New.** The details card. Composes nothing. |
| `src/data/demoParcel.ts` | `parcelBoundaryMetric` + `parcelOutlineM` added — the parcel ring in the same axes as the footprint, converted by the same function, so the two rings the validator compares cannot be on different axes. |
| `src/workflow/pipelineSteps.ts` | Sixth step; `failed` state; takes the report. |
| `src/ui/PipelineStatus.tsx` | Renders `failed`. |
| `src/App.tsx` | `validationReport` (memoised over the **canonical** units only), the details toggle, both new components, runs the new self-check. |
| `src/index.css` | `.validation-bar`, chips, headline, details card, `.pipeline-step-failed`; the app grid gained a row; the inspector column lost its fixed row template. |

### Self-checks performed — Subphase C (cloud sandbox, source only)

- Whole tree typechecks under `--strict --noUnusedLocals --noUnusedParameters`.
- All self-checks executed in Node: **97/97 assertions pass** —
  `checkTopologyValidation` 25/25, `checkFloorIsolation` 14/14,
  `checkExplodedView` 15/15, `checkGenerationTimeline` 26/26,
  `checkFootprintGeometry` 17/17.
- Specifically verified in the sandbox: the healthy model is `valid` with zero
  failures; a 4 m overlap between 301 and 302 is detected as exactly one pair
  with an intersection volume of **84.000 m³** (4 × 7 × 3, computed not guessed);
  a unit outside the footprint, a unit through the roof, a duplicated ULPIN, a
  building moved off its parcel and a short unit count are each caught by the
  right rule.

### Still requires Windows verification — Subphase C

- [ ] Before generation the bar reads *"Topology validation runs on the generated
      3D cadastre"* — no verdict over an empty scene.
- [ ] After generation: chips read `Parcel valid · 5 floors valid · Geometry
      valid · 20 unique IDs · No conflicts · 20 units`, verdict **TOPOLOGY
      VALID**, pipeline **6/6**.
- [ ] The details toggle opens a card listing 8 checks with their figures.
- [ ] Console shows `topology validation self-check passed (25 checks)`.
- [ ] Exploding or isolating changes **nothing** on the validation bar — the
      engine sees logical geometry only.

## Completed — Subphase D (ownership conflict simulation) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** a live demonstration in which the system *detects* an impossible
cadastral overlap — the engine discovering it, not being told about it.

- [x] **`Simulate ownership conflict` / `Restore valid geometry`**, at the right
      end of the validation bar. It sits there rather than beside the generate
      button because what it demonstrates *is that bar*: press it and the verdict
      two centimetres to the left flips from valid to invalid.
- [x] **The pair is found, not named.** `findEncroachmentPair` tests adjacency
      geometrically — same floor, touching on exactly one horizontal axis,
      genuinely overlapping on the others, which is the definition of sharing a
      wall. Floor 3 is preferred; any floor with a usable pair is accepted. The
      demo therefore works on a 3 × 4 grid, or any other, with no edit.
- [x] **The canonical dataset is never mutated.** Architecture:
      `canonicalUnits → applyConflictSimulation → displayUnits`. The override
      returns a **new array** with one record translated; the canonical array is
      untouched and still in memory.
- [x] **The engine discovers the overlap.** `validateTopology` is handed the
      display units and intersects every pair exactly as it does for the valid
      model. Nothing sets `conflict = true`; the simulation module does not
      import the validator at all.
- [x] **The intersection volume is computed** — 4 × 7 × 3 = **84.000 m³** for the
      demo pair, asserted to six decimal places in the self-check.
- [x] **Both volumes turn red in the 3D view**, driven by
      `TopologyReport.conflictedUnitIds` — so the red boxes and the engine's
      finding are tied by data, not by a second hard-coded list.
- [x] **Colour hierarchy: CONFLICT > SELECTED > HOVER > NORMAL.** A selected
      *and* disputed unit stays red; the amber selection cage is still drawn
      around it. **Selection cannot hide a dispute** — a presenter clicking a
      contested volume to read its record would otherwise switch off the evidence
      in the act of examining it.
- [x] **A highly visible warning banner** over the viewer: `SPATIAL OWNERSHIP
      CONFLICT DETECTED`, then Unit A, Unit B (each with its prototype ULPIN),
      Floor, Intersection volume **with its three extents spelled out beside the
      product so the figure can be checked**, and the rule violated.
- [x] **An honesty line in the banner** when the conflict is staged: *"Simulated
      override — unit 302 moved 4.00 m east–west across its shared wall with 301
      on floor 3. The canonical cadastral record is unchanged."* An audience must
      not be left believing the demo data contains a genuine dispute.
- [x] **The validation bar updates automatically**: `No conflicts → 1 conflict`,
      `TOPOLOGY VALID → TOPOLOGY INVALID`, pipeline `6/6 → 5/6` with the topology
      step in the new `failed` state.
- [x] **`Restore valid geometry` returns the canonical array by reference** — not
      a copy, not an inverse translation, not a regeneration. Asserted with `===`.
      Restoration cannot drift because nothing was changed.
- [x] **Works in all three view modes.** The simulation changes the *record*; the
      exploded view and floor isolation change how it is *drawn*. They are
      orthogonal by construction, so a staged conflict is visible stacked,
      floor-exploded and unit-exploded alike. (In the unit-exploded view the two
      red volumes separate along with everything else — the dispute is still
      reported by the engine, which validates logical geometry and never sees an
      offset.)
- [x] **The Property Inspector shows a `CONFLICT — DISPUTED VOLUME` badge**
      *above* the record, replacing none of its normal cadastral fields.
- [x] **Reset clears the simulation** along with everything else.
- [x] **23 new pure self-checks** (`simulation/conflictSelfCheck.ts`).

### Files changed in Subphase D

| File | Change |
|---|---|
| `src/simulation/conflictSimulation.ts` | **New, pure.** `findEncroachmentPair` (geometric adjacency), `applyConflictSimulation` (returns a new array; returns the input by reference when inactive), `describeScenario`, `DEFAULT_ENCROACHMENT_M`, `PREFERRED_CONFLICT_FLOOR`. No validator import. |
| `src/simulation/conflictSelfCheck.ts` | **New.** 23 checks: canonical untouched, one unit differs, translation not resize, area/volume/ULPIN preserved, engine returns `conflict`, exactly the intended pair, computed volume, **only** the overlap rule broken, restore by reference, restore validates clean, null-pair no-op. |
| `src/ui/ConflictBanner.tsx` | **New.** The warning, with the working shown and the simulated-override disclosure. |
| `src/scene/Building.tsx` | Conflict colouring and the documented priority hierarchy; `conflictedUnitIds` prop. |
| `src/scene/SceneViewer.tsx` | Plumbs `conflictedUnitIds`; `units` widened to `readonly`. |
| `src/ui/PropertyInspector.tsx` | The dispute badge; a note recording that it shows the *display* record (canonical + any override) and never a visualisation coordinate. |
| `src/ui/ValidationStatusBar.tsx` | The simulate / restore control. |
| `src/scene/unitLayout.ts`, `src/ui/BuildingSummary.tsx` | `readonly ApartmentUnit[]` in signatures. |
| `src/App.tsx` | `canonicalUnits` → `units` (display) via the override; `encroachmentPair`, `conflictScenario`, `ownershipConflicts`, `conflictedUnitIds`; plan centres derived from **canonical** so the exploded view does not shift when a conflict is staged; reset clears the simulation. |
| `src/index.css` | `.validation-simulate`, `.conflict-banner`, `.inspector-conflict`. |

### Self-checks performed — Subphase D (cloud sandbox, source only)

- Whole tree typechecks under `--strict --noUnusedLocals --noUnusedParameters`.
- All self-checks executed in Node: **120/120 assertions pass** —
  `checkConflictSimulation` 23/23, `checkTopologyValidation` 25/25,
  `checkFloorIsolation` 14/14, `checkExplodedView` 15/15,
  `checkGenerationTimeline` 26/26, `checkFootprintGeometry` 17/17.

### Still requires Windows verification — Subphase D

- [ ] Press **Simulate ownership conflict**: two volumes on floor 3 visibly
      interpenetrate and both turn red.
- [ ] The bar flips to `1 conflict` / **TOPOLOGY INVALID**; the pipeline reads 5/6
      with a red topology marker.
- [ ] The banner reads `84.0 m³` with `4.00 × 7.00 × 3.00 m` beneath it, and the
      simulated-override note is present.
- [ ] Click a red unit: it **stays red**, gets the amber cage, and the inspector
      shows the `CONFLICT` badge above an otherwise complete record.
- [ ] Simulate, then explode to Units, then isolate F3 — the conflict stays
      reported throughout and the bar never changes because of a view change.
- [ ] **Restore valid geometry**: red disappears, bar returns to
      `No conflicts` / **TOPOLOGY VALID**, pipeline 6/6, geometry back to 63 m² /
      189 m³ / 6.0–9.0 m.
- [ ] Console shows `conflict-simulation self-check passed (23 checks)`.

## Completed — Subphase E (ownership / validation presentation) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** lightweight semantic presentation — make the ownership chain and the
per-property validation state legible, without cluttering anything.

- [x] **A compact ownership hierarchy** at the head of the Property Inspector:

      Parent parcel   KA-BLR-0482-001928
            ↓
      Floor           Floor 3
            ↓
      Unit            302
            ↓
      Prototype 3D ULPIN   KA-BLR-0482-001928-F03-U02

      It **replaced** the standalone identifier card rather than being added
      beside it — the identifier now sits at the *foot of the descent that
      produced it*, which turns `…-F03-U02` from a reference number into a
      visible derivation: the first four segments are the parcel above, `F03` is
      the floor above, `U02` is the unit above. Same monospace, same accent card,
      same disclaimer travelling with it.
- [x] **No duplication.** The parcel / floor / unit rows were removed from the
      summary list below, since they are now the chain above. One fact, one place.
- [x] **Nothing parses the identifier.** Every rung is read off a field on the
      record. Recovering the parts by splitting the string would invert the real
      dependency — the segments were built *from* those values.
- [x] **Validation status beside the hierarchy**: a quiet
      `✓ No conflicts on this volume` when the record is clean, and the
      `⚠ CONFLICT — DISPUTED VOLUME` badge when it is not. Both sit under the
      chain and above the record; neither replaces any cadastral field.
- [x] **The semantic hierarchy extracted into one module.**
      `scene/unitStatus.ts` — `conflict > selected > hovered > normal`. Before
      this the same nested ternary appeared four times in `Building.tsx` (fill,
      emissive, intensity, edge opacity), which is four chances for a unit's fill
      to say "disputed" while its edges say "selected".
- [x] **`VALIDATED` is deliberately not a colour in the 3D scene.** Every unit
      that is not in conflict is valid, so colouring valid units green would
      paint nineteen of twenty green and make the *unremarkable* case the loudest
      thing on screen. Validity is reported on the status bar and in the
      inspector; in the scene, valid is the absence of red. That restraint is
      what makes the conflict colour read as loudly as it does.
- [x] **5 further self-checks** on the status hierarchy, added to
      `simulation/conflictSelfCheck.ts` (same subject): a dispute reads as
      conflict; conflict outranks selection; selection outranks hover; an
      untargetable unit shows no hover; a clean report leaves every unit normal.

### Files changed in Subphase E

| File | Change |
|---|---|
| `src/scene/unitStatus.ts` | **New, pure.** `getUnitStatus`, `shouldShowSelectionCage`, and the written-down priority ordering with its reasoning. |
| `src/ui/OwnershipHierarchy.tsx` | **New.** The four-rung descent; arrows drawn in CSS, not typed as characters. |
| `src/ui/PropertyInspector.tsx` | Leads with the hierarchy; adds the validated / conflicted line; drops the three now-duplicated summary rows. |
| `src/scene/Building.tsx` | Uses `getUnitStatus`; the four inline ternaries collapsed to one decision. |
| `src/simulation/conflictSelfCheck.ts` | +5 status-hierarchy assertions (23 → 28). |
| `src/index.css` | `.hierarchy*`, `.inspector-validated`. |

### Self-checks performed — Subphase E (cloud sandbox, source only)

- Whole tree typechecks under `--strict --noUnusedLocals --noUnusedParameters`.
- All self-checks executed in Node: **125/125 assertions pass** across six suites.

### Still requires Windows verification — Subphase E

- [ ] Selecting a unit shows the four-rung chain with connecting arrows, ending
      in the identifier card.
- [ ] The identifier appears **once** in the panel, not twice.
- [ ] `✓ No conflicts on this volume` appears for a clean unit; the red
      `CONFLICT` badge replaces it for a disputed one, and the record below is
      complete either way.
- [ ] No unit is ever green in the 3D scene.

## Completed — Subphase F (conflict visualisation) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**Goal:** the conflict logic worked and the picture did not show it. Make the
ownership conflict demonstration visually obvious, cinematic and
presentation-ready — with **no new product capability**: no AI, no backend, no
database, no basement. Every number this subphase puts on screen was already
being computed.

**The problem it fixes.** From the default three-quarter view, the entire finding
was a colour change of a few dozen pixels, usually behind another floor. A judge
could not tell which box had moved, where from, or which part of space was being
claimed twice.

- [x] **Auto-focus conflict mode.** Triggering the simulation enters a dedicated
      presentation state in one click: the conflict's floor is isolated (reusing
      Subphase B, not a parallel mechanism), the other four ghost away, the two
      innocent units on that floor fade to a twentieth, any selection is cleared,
      and the camera flies to a new `conflict` preset. OrbitControls are handed
      straight back on arrival — the presenter can orbit immediately.
- [x] **The displaced view state is remembered, not discarded.** `explodeMode`,
      `isolatedFloor`, `activePreset` and `selectedUnitId` are captured in a ref
      on the way in and reapplied on the way out with the camera view that framed
      them, so the simulation is not a one-way door mid-demo.
- [x] **The move is animated over 1.4 s with eased motion** — and what animates is
      the **record**, not a display offset. `applyConflictSimulation` gained a
      `progress` parameter; the intermediate array is a genuine hypothetical
      record, validated on every frame.
- [x] **The disputed volume grows in front of the audience**, measured rather than
      interpolated: 0 → 8.4 → 21.0 → 42.0 → 63.0 → **84.0 m³**, because the same
      `findOwnershipConflicts` runs on each intermediate record.
- [x] **The canonical position stays visible as a ghost** — a transparent shell
      with a wireframe, captioned `CANONICAL POSITION`, read off the record rather
      than reconstructed. Visual only: `raycast={() => null}`, never validated,
      never counted, never written back.
- [x] **The real intersection volume is rendered as a mesh.** `aabb.ts` now returns
      the intersection **bounds**, not only its extents, and `OwnershipConflict`
      carries them through. The overlay positions a cube at those bounds. **The red
      box on screen is the validator's own output**, and a self-check asserts
      byte-equality.
- [x] **In-scene labels**: `84.0 m³ OVERLAP` over its own working
      (`4.00 × 3.00 × 7.00 m`), and `−4.0 m X` on the displacement arrow. Both
      derived; neither is hard-coded, and both track the animation.
- [x] **A displacement arrow** from the canonical centre to the simulated one,
      built from the simulation's own displacement vector rather than by
      subtracting two positions.
- [x] **A clear semantic hierarchy** — intersection volume (strongest, drawn
      through the model) > conflicting units > canonical ghost (colourless) >
      selection cage (amber, layered on top) > everything else (fill × 0.05).
      Deliberately *not* neon: the intersection red is a saturated signal red, not
      a fluorescent one, and nothing pulses, glows or animates.
- [x] **The conflict panel now carries the full finding**: Unit A, Unit B, floor,
      intersection volume, overlap dimensions, simulated displacement, the rule,
      and **Status: Requires cadastral review**.
- [x] **A resolution workflow**: Detected → Source records compared → Officer
      review required → Correct geometry → Revalidate. Stored as data, with the
      two automated steps styled differently from the three a cadastral officer
      performs.
- [x] **"The system detects the conflict but does not decide legal ownership."**
      Stated on the panel. A spatial validator can prove two records describe
      overlapping volumes; it cannot know which survey was wrong, which deed is
      older, or what a tribunal would decide.
- [x] **Restore is animated (900 ms) and revalidation is automatic.** There is no
      revalidate button: `units` memoises over the progress ramp and the report
      memoises over `units`, so the engine re-runs every frame of the return
      journey. At progress 0 the simulation returns the canonical array **by
      reference** — the restore is an identity, not an inverse.
- [x] **The four kinds of geometry are still separate**, and a fourth was named:
      A canonical · B visualisation · C simulation · **D presentation** (ghost,
      arrow, intersection volume — derived, drawn, read by nothing else). See
      ARCHITECTURE §10.0.
- [x] **Exploded view and conflict focus take turns.** The disputed region exists
      only where two volumes interpenetrate; drawn while they are separated it
      would hang in a visible gap and state the opposite of what it means. The
      explode levels are disabled during conflict focus — visible, with an
      explanation — and restored on dismissal.
- [x] **22 new pure self-checks** in `simulation/conflictPresentationSelfCheck.ts`.

### Files changed in Subphase F

| File | Change |
|---|---|
| `src/simulation/conflictPresentation.ts` | **New, pure.** Geometry kind D: `ConflictFocus`, `buildConflictFocus`, `getConflictEmphasis`, `getConflictFraming`, the rule / status / disclaimer constants, and the resolution workflow as data. |
| `src/simulation/conflictPresentationSelfCheck.ts` | **New, pure.** 22 assertions — the picture agrees with the logic. |
| `src/scene/ConflictOverlay.tsx` | **New.** Ghost, displacement arrow, intersection volume, three in-scene labels. Every mesh `raycast={() => null}`. |
| `src/validation/aabb.ts` | `VolumeIntersection.bounds`; `getIntersectionBox`, `getBoxCentre`, `getBoxSize`, `getBoxUnion`. |
| `src/validation/validateTopology.ts` | `OwnershipConflict.bounds`, carried through from the engine. |
| `src/simulation/conflictSimulation.ts` | `progress` parameter on `applyConflictSimulation`; `getEncroachmentShiftM`, `getDisplacementVectorM`; `CONFLICT_ANIMATION_MS` (1400), `CONFLICT_RESTORE_MS` (900). |
| `src/scene/Building.tsx` | Conflict-focus dimming, multiplied into floor isolation rather than overriding it. |
| `src/scene/SceneViewer.tsx` | Distributes the focus; renders `ConflictOverlay` after the units, outside `<Building>`. |
| `src/scene/cameraPresets.ts` | The `conflict` preset (not a button) and `CameraPresetContext.conflictFraming`. |
| `src/scene/explodedView.ts` | `getSettledExplodeAmounts` — framing the restore by where the scene is heading. |
| `src/ui/ConflictBanner.tsx` | Overlap dimensions, displacement, rule, status, workflow chain, disclaimer. **Superseded in Subphase G — this content now lives in `src/ui/ConflictPanel.tsx`.** |
| `src/ui/ViewControls.tsx` | Explode levels disabled while a conflict is presented, with the reason in the tooltip. |
| `src/animation/generationSelfCheck.ts` | `conflict` added to the preset fallback sweep. |
| `src/App.tsx` | Two ramps, the animated record, the live focus, enter/exit conflict focus with remembered state. |
| `src/index.css` | `.scene-label-ghost/-displacement/-overlap`, widened conflict panel, `.conflict-workflow*`, `.conflict-banner-disclaimer`. |

### Self-checks performed — Subphase F (cloud sandbox, source only)

The npm registry is blocked from the sandbox for one transitive dependency
(`zustand`), so `npm ci` could not run and `vite build` was **not** executed here.
Two independent checks were run instead:

- **Whole-tree typecheck.** Every file compiled under the project's own
  `tsconfig.json` settings (`strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, `jsx: react-jsx`) with the three untyped
  third-party modules stubbed. Result: **zero errors introduced by this
  subphase** — a before/after diff against the pristine tree at
  `HEAD` shows an identical error set (all of them stub artefacts). This caught
  one genuine break: `generationSelfCheck.ts` constructing a
  `CameraPresetContext` without the new required `conflictFraming` field.
- **All six self-check suites executed in Node** against real compiled output:
  **96/96 assertions pass** (ulpin 4, footprint 17, topology validation 25,
  conflict simulation 28, conflict presentation 22). The pre-existing 28
  conflict-simulation assertions still pass unchanged, which is the evidence that
  Subphase F did not alter the simulation's behaviour.
- **The growth of the disputed volume was executed and printed**, and matches the
  table in ARCHITECTURE §10.6 exactly.

### Still requires Windows verification — Subphase F

Run `npm run dev`, then in order:

- [ ] `npm run build` completes (`tsc --noEmit && vite build`) — **the one check
      the sandbox could not perform.**
- [ ] Console shows all six self-checks passing, including
      `conflict-presentation self-check passed (22 checks)`.
- [ ] **Generate 3D Cadastre** still animates 2D → 3D and settles.
- [ ] Press **Simulate ownership conflict**:
  - [ ] the camera flies once, smoothly, and framing includes both units and the
        ghost — then orbit/zoom/pan still work;
  - [ ] floor 3 stays solid, floors 1/2/4/5 ghost;
  - [ ] units 303 and 304 fade heavily; 301 and 302 stay red and solid;
  - [ ] unit 302 **slides** west over ~1.4 s — it does not teleport;
  - [ ] a grey wireframe ghost stays behind it, captioned `CANONICAL POSITION`;
  - [ ] an arrow runs from the ghost to the moved unit, labelled `−4.0 m X`;
  - [ ] a bright translucent red box appears in the overlap and **grows**,
        labelled `84.0 m³ OVERLAP` over `4.00 × 3.00 × 7.00 m`;
  - [ ] the status bar flips to **TOPOLOGY INVALID** and the chip reads
        `1 conflict`;
  - [ ] the panel shows Unit A 301, Unit B 302, floor 3, 84.0 m³,
        4.00 × 3.00 × 7.00 m, displacement 4.00 m, the rule, and
        **Requires cadastral review**;
  - [ ] the workflow chain and the "does not decide legal ownership" line are
        both visible;
  - [ ] the explode buttons are disabled with an explanatory tooltip.
- [ ] Click unit 301 while the conflict is staged: it stays **red**, gains the
      amber cage, and the inspector shows its record and the conflict badge.
- [ ] Press **Restore valid geometry**:
  - [ ] 302 slides back over ~0.9 s;
  - [ ] the red volume, the ghost and the arrow fade out;
  - [ ] floors un-ghost and the camera returns to the previous framing;
  - [ ] the status bar returns to **TOPOLOGY VALID**, `No conflicts`;
  - [ ] the explode buttons re-enable at whatever level was set before.
- [ ] Set floor isolation F2 + explode **Units** + select a unit, *then* simulate,
      *then* restore: all three come back exactly as they were.
- [ ] **Nothing else regressed:** Generate, Reset to source, exploded view (floors
      and units), floor isolation, all five camera presets, unit selection, the
      Property Inspector, the ownership hierarchy, the prototype 3D ULPIN, the
      validation bar and its checks panel, and the GIS map.
- [ ] With `prefers-reduced-motion` enabled: the simulation still works and simply
      arrives, with no journey.

## Completed — Subphase G (conflict UI placement) — *SOURCE COMPLETE, NOT host-verified, NOT committed*

**A refinement of Subphase F's presentation. No new feature, no new dependency,
no change to any geometry, simulation, validation or camera module.**

### The problem

Subphase F made the conflict visible and then covered it up. The scene carried
four pieces of evidence — the two red units, the red intersection volume at the
validator's own bounds, the colourless canonical ghost, and the displacement
arrow — and `ConflictBanner` sat in front of them: a 430 px card anchored
top-centre over the canvas with eight fields, a five-step chain and two notes.
The `conflict` camera preset frames both properties *and* the ghost, which puts
the subject in the centre of the viewport — directly behind the card describing
it. Every figure on the card was true and every one of them was in the way.

### What changed

The finding was split along the line between *that* and *what*.

| | Component | Where | Carries |
|---|---|---|---|
| **that** | `ui/ConflictAlert.tsx` | one line, top-centre over the canvas | the announcement + the intersection volume |
| **what** | `ui/ConflictPanel.tsx` | docked at the top of the right-hand column | the eight fields, the chain, the two notes |

The alert reads `⚠ SPATIAL OWNERSHIP CONFLICT DETECTED · 84.0 m³ overlap` and is
a pill, not a card — a shape that cannot grow into a panel. It quotes the **first**
conflict's volume rather than a total, because the panel below describes the first
conflict; any remainder is a count (`+1 more`), not a summary.

The panel is **docked, not a drawer**. A drawer would reintroduce the overlay
being removed, would cover the pipeline and the inspector (the two panels that
give the finding its context), and would imply an open/closed state the model does
not have — the panel renders exactly when `findOwnershipConflicts` returns
something. The right column already scrolls and already stacks cards at their
natural heights, so it needed no layout change; the panel is simply first in it,
above `PipelineStatus`, because it outranks the cards below it.

### What was deliberately NOT touched

- **The 3D scene, entirely.** `ConflictOverlay.tsx`, `conflictPresentation.ts`,
  `conflictSimulation.ts`, `Building.tsx`, `SceneViewer.tsx`, `cameraPresets.ts`,
  `explodedView.ts`, `validateTopology.ts` and `aabb.ts` are byte-identical. The
  red units, the red intersection volume, the ghost with its `CANONICAL POSITION`
  caption and the `−4.0 m X` displacement arrow all behave exactly as before.
- The auto-focus behaviour, the remembered pre-conflict view state, the 1.4 s /
  900 ms animated record, the per-frame revalidation and the automatic status flip.
- `ValidationStatusBar` and its `Simulate` control.
- The three-column grid, `ViewControls`, `GenerationStatus`, `BuildingSummary`.
- All six self-check suites — Subphase G touches markup and CSS only, so none of
  the 96 assertions had anything to re-assert.

### Accessibility

`ConflictAlert` is `role="alert"` (assertive). `ConflictPanel` is `role="region"`
with an `aria-label` — **not** a second alert, so a screen reader is interrupted
once per event rather than twice. The panel also drops `pointer-events: none`,
which the floating card needed only because it overlapped the canvas; its figures
can now be selected and copied.

### Files changed in Subphase G

| File | Change |
|---|---|
| `src/ui/ConflictAlert.tsx` | **New.** The one-line alert over the canvas. |
| `src/ui/ConflictPanel.tsx` | **New.** The docked detail panel — Subphase F's banner content, unchanged in substance. `Rule` relabelled `Rule violated`. |
| `src/ui/ConflictBanner.tsx` | Emptied to a tombstone (`export {}`) explaining the split. **Nothing imports it; it is safe to delete on the host.** |
| `src/App.tsx` | Imports the two new components; renders `ConflictAlert` in the scene panel and `ConflictPanel` first in the inspector column. One doc comment updated. |
| `src/index.css` | `.conflict-banner*` replaced by `.conflict-alert*` (pill, absolute, top-centre) and `.conflict-panel*` (docked card, no positioning, no `pointer-events: none`). `.conflict-workflow*` unchanged. One extra rule in the ≤1100 px block. |

### Self-checks performed — Subphase G (cloud sandbox, source only)

- All four touched/new `.tsx` files parse clean under the TypeScript compiler's
  JSX transform — zero diagnostics.
- Every `className` used by the two new components resolves to a rule in
  `index.css`; no `.conflict-banner*` selector survives anywhere in the tree.
- No file under `src/scene/`, `src/simulation/`, `src/validation/`,
  `src/animation/` or `src/geometry/` was modified, which is the evidence that
  requirement 6 — the red units, the intersection volume, the ghost and the
  arrow — is preserved by construction rather than by inspection.

### Still requires Windows verification — Subphase G

- [ ] `npm run build` completes (`tsc --noEmit && vite build`).
- [ ] With a conflict staged, the **centre of the 3D canvas is clear** — only the
      pill across the top, the summary top-left, the view controls top-right and
      the generate bar at the bottom.
- [ ] The pill reads `⚠ SPATIAL OWNERSHIP CONFLICT DETECTED · 84.0 m³ overlap`
      and does not overlap the building at the `conflict` preset's framing.
- [ ] The right column shows, top to bottom: the conflict panel, the pipeline,
      then the property inspector — and scrolls if the window is short.
- [ ] The panel shows Unit A 301, Unit B 302, floor 3, 84.0 m³,
      4.00 × 3.00 × 7.00 m, displacement 4.00 m, the rule, **Requires cadastral
      review**, the workflow chain, and the "does not decide legal ownership" line.
- [ ] The red units, the red intersection volume, the ghost and the arrow are all
      still visible and unchanged.
- [ ] The validation bar still flips **TOPOLOGY INVALID** → **TOPOLOGY VALID** and
      both the pill and the panel disappear on restore.
- [ ] Orbit/zoom/pan still work everywhere the pill is *not*, and the panel's text
      can be selected.
- [ ] Below 1100 px the layout still stacks and the pill still fits.
- [ ] Delete `src/ui/ConflictBanner.tsx` (the cloud session could not remove files
      on the host) and confirm the build still passes.

## Next phase

**Phase 10 is complete in source (Subphases A–E).** The text below was the plan
written before it was built; it is kept because it records what was intended, and
every item in it now exists — see the Subphase C and D sections above for what
was actually built.

**Nothing beyond Phase 10 has been started, deliberately.** The next action is
host verification, not more source.

Phase 8 made geometry something the application *consumes* rather than
something it declares. That is what makes validation meaningful: while both
rings were constants there was nothing to check that a careful author had not
already got right. Now there is a footprint polygon flowing through a pipeline,
and the pipeline has an obvious empty slot between "Footprint Loaded" and
"3D Structure Generated". Phase 9 also gave that slot somewhere to *show* a
result: the pipeline card now has an `active` state and the interface has a
status line, so a validation step that can report progress and failure has a
place to report it.

Expected scope:

1. **Containment** — is the building footprint entirely inside the parcel
   boundary? Point-in-polygon for each vertex is the cheap first pass; segment
   intersection is the correct one.
2. **Simplicity and winding** — is each ring simple (no self-intersection), and
   is its winding order consistent? `polygonAreaSqM()` uses `Math.abs`, so a
   reversed ring currently reports the right area and goes unnoticed. Signed
   area is the test.
3. **Degenerate geometry** — repeated vertices, zero-length edges, collinear
   runs, fewer than three points.
4. **Vertical non-overlap** — no two property units may claim the same volume.
   The units are stored as six bounds precisely so this is a comparison rather
   than a reconstruction.
5. **A sixth pipeline step** that reports the result honestly, including
   failures. A validator that can only pass is not a validator.
6. **Conflict simulation** — deliberately introduce an overlapping or
   out-of-bounds unit and show the engine catching it, which is the only
   convincing way to demonstrate that the validator is real.

Still out of scope, unchanged: no backend, no cadastral API, no AI extraction,
no basement, no version history, no standards export, and no subdivision of an
irregular polygon (see ARCHITECTURE §8.8).

Deferred beyond that, unchanged from Phase 6: a **decoder** for the prototype
identifier. Nothing yet reads an identifier back apart, and a parser written
before it has a caller is a parser written against a guess.

Also still outstanding from Phase 7's plan, and deliberately not done in
Phase 8 or Phase 9: **linked selection between the map and the 3D scene** —
clicking a unit does not highlight anything on the map, and the map has nothing
selectable. It keeps being dropped to keep each phase to one idea; it is now the
most visible remaining gap in the "two linked views" story.

## Known issues

- ~~**Build unverified.**~~ **Closed at Phase 4.** `npm run build` and `npm run dev` both pass on the host. The blocking item since Phase 1.
- ~~**Dependency versions are ranges chosen without registry access.**~~ **Closed at Phase 4.** `three ^0.180.0`, `@react-three/fiber ^9.0.0`, `@react-three/drei ^10.0.0` and `@types/three ^0.180.0` resolved, installed and type-checked successfully.
- ~~**No `package-lock.json` yet.**~~ **Closed.** Present in the repo and now committed, so Vercel will build reproducibly.
- ~~**Nothing committed to Git.**~~ **Closed at Phase 4.** Phases 0–4 are committed and pushed.
- **`three` and `@types/three` must stay on the same minor.** Three.js ships breaking changes between `0.x` releases, so if one is bumped the other must be bumped to match. Still live — a future `npm update` can break this silently.
- ~~**Vercel is not wired up.**~~ **Not an issue — it was already configured.** GitHub → Vercel is connected and <https://3d-ulpin-three.vercel.app> is live; the pipeline has been observed serving the repo's pushed state.
- **The 0.06 m visual gap is cosmetic and must stay that way.** It is subtracted from each unit box's geometry size symmetrically, in all three axes, so it never moves a mesh centre. If a later phase needs real slab thickness, wall thickness or floor-to-ceiling clearance, that belongs in `BuildingConfig` as its own field, not in the visual constant.
- **Phase 8 is unverified and uncommitted.** The source is complete, and every pure module has been compiled and executed in the sandbox, but nothing has rendered in a browser: the extrusion, the `ShapeGeometry`/`ExtrudeGeometry` rotation, the generate control and the pipeline card have never been seen. See *Local verification REQUIRED — Phase 8*. Phase 9 sits directly on top of it, so verifying Phase 9 verifies most of Phase 8 with it.
- **The `northM → +Z` axis convention is a choice, and it is currently unobservable.** ARCHITECTURE §8.4 fixes East = +X, North = +Z, Up = +Y in one function. A strict cartographic mapping would use `northM → −Z`, and because the demo footprint is a rectangle centred on the origin, both produce an identical ring — so nothing on screen or in the checks can tell them apart. The first asymmetric footprint will decide it. Phase 7's opposite note in `buildFootprintOutlineM` is gone with that function.
- **The unit subdivision still assumes a rectangular footprint.** `buildUnitsForFloor` lays its grid over the footprint's *bounding box*. Exact for an axis-aligned rectangle; for an L-shape or a chamfered plan it puts units over ground the building does not occupy — demonstrated in the sandbox with a six-vertex L (189 m² of polygon inside a 252 m² box, 20 units generated over the box). `isAxisAlignedRectangle()` is checked in dev and stated in the interface, so it is a known limitation rather than a silent one. Arbitrary polygon subdivision needs a decomposition pass and is future work.
- **The generation animation makes unit materials transparent, briefly.** For the ~2.2 s of the transition, units on floors that are still arriving render with `transparent: true` and a Y scale below 1. Once settled every material is opaque again and the rendering matches Phases 4–8 exactly. If any sorting or depth artefact ever appears, it can only appear inside that window — and `prefers-reduced-motion` skips the window entirely.
- **Phase 9 is unverified and uncommitted.** The whole source tree type-checks in the sandbox *against hand-written stubs*, and the pure timeline has been executed (30/30), but nothing has rendered: the animation has never been watched, the exploded view and the camera flights have never been seen, and no drei/R3F prop name is confirmed. See *Local verification REQUIRED — Phase 9*.
- **The camera rig disables OrbitControls for the duration of a flight.** ~850 ms per preset press. It is deliberate — it stops the user and the animation writing to the camera on the same frame — but it means a preset press briefly makes the viewer unresponsive to dragging. If a flight ever failed to complete, the controls would stay disabled; the only way that can happen is `useFrame` stopping, which would mean the whole canvas had stopped.
- **The exploded gap is a constant, not derived.** `EXPLODED_FLOOR_GAP_M = 3.2` was chosen against the demo's 3 m floor height. A building with 6 m floors would separate by proportionally less and read as merely loose. Deriving it from `floorHeight` is a one-line change when a second building exists.
- **Labels are DOM nodes, so a great many of them would cost.** drei's `<Html>` projects real elements. Twenty-five labels is fine; a few hundred would not be. The restraint rule in `SceneLabels.tsx` currently keeps the count at most six.
- **`generationSelfCheck` samples; it does not prove.** 200 steps across a 2.2 s sequence is roughly every 11 ms, which is finer than a frame — but it is still sampling. A defect confined to a narrower interval than that would pass.
- **The unit grid is uniform by assumption.** Every floor is cut the same way and every unit is identical, which is why the summary panel can describe all 20 from `units[0]`. Real buildings have differently sized flats and floors that differ from each other; when that arrives, `buildApartmentUnits` needs a per-floor partition rather than one grid, and the panel needs a range rather than a single figure.
- **Unit numbering assumes fewer than 100 units per floor.** `unitNumber` is `floorLevel` + a 2-digit index, so floor 1 unit 100 would collide with floor 11 unit 0. This affects the *door label only* — as of Phase 6 the prototype 3D ULPIN is built from `floorLevel` and `indexOnFloor` as separate padded segments, so it cannot collide this way.
- ~~**Phase 5 is unverified and uncommitted.**~~ **Closed.** Verified on the host and committed on 2026-09-04.
- **Phase 7 is unverified and uncommitted, and it added dependencies.** *(Still the first thing to do — Phase 8 cannot build until this install succeeds.)* `leaflet`, `react-leaflet` and `@types/leaflet` are declared in `package.json` but `npm install` has not been run, so `node_modules` does not contain them and `package-lock.json` is out of date. Nothing in Phase 7 can build until that install succeeds. The three `.tsx` map components have never been type-checked or rendered anywhere — see *Local verification REQUIRED — Phase 7*.
- **`react-leaflet` v5 requires React 19.** That matches this project, but it is a hard peer requirement rather than a preference: if npm resolves an older `react-leaflet` major, the map components' props will not type-check. Confirm the installed major is 5.
- **The map depends on a network for its basemap, and only for its basemap.** OpenStreetMap tiles are fetched at runtime; the parcel and footprint are local constants. Offline, the map greys out and every cadastral shape and figure still renders. Worth knowing before a demo on conference Wi-Fi — and worth showing, because it makes the distinction visible.
- **No topology validation.** Nothing checks that the footprint lies inside the parcel, that the rings are simple, or that the winding order is consistent. `polygonAreaSqM()` uses `Math.abs`, so a reversed ring reports the right area rather than a negative one — which is forgiving, and also means a badly wound ring would go unnoticed. **Still the live blocker, and Phase 10's whole subject:** Phase 8 made geometry something the app consumes and Phase 9 gave the pipeline somewhere to report progress and failure, which together are exactly the conditions under which this stops being premature.
- **The metre-to-degree conversion is a local flat-earth approximation.** Valid because the parcel spans under fifty metres (measured error ≈ 0.1%). It is not a projection and must not be reused as one; a real system needs proper CRS handling.
- **Phase 6 is unverified and uncommitted.** The source is complete but has never run on the host — see *Local verification REQUIRED — Phase 6* above. The sandbox check covers the pure identifier logic only, not JSX, CSS or the R3F/drei type signatures, so `npm run build` on the host is the real gate.
- **The identifier is a prototype encoding, not an official format.** `KA-BLR-0482-001928-F03-U02` was invented for this demonstration and must never be presented as the Government of India ULPIN format. The disclaimer constant `PROTOTYPE_ENCODING_NOTE` is rendered with the identifier; if the identifier is ever shown somewhere new, the disclaimer goes with it.
- **The parcel identity is a single hard-coded demo constant.** One building on one parcel. `buildApartmentUnits` already takes the parcel as a parameter, so a second parcel is a caller change, not a generator change — but nothing yet supplies one, and there is no check that two buildings on *different* parcels do not reuse a parcel number.
- **Zero padding is fixed at two digits.** 99 floors and 99 units per floor fit; a 100th does not break the identifier but makes that one string wider than its siblings, so fixed-offset slicing of the text would stop working. Nothing slices it today.
- **No decoder.** Identifiers can be generated but not parsed back into parts. Not needed yet — nothing reads one from outside the app. See *Next phase*.
- **The drag threshold is a heuristic.** `DRAG_TOLERANCE_PX = 5` decides whether a gesture was a click or an orbit. If a click ever feels unresponsive, or a small drag selects something, that constant in `SceneViewer.tsx` is the dial. A touch device may want a larger value.
- **`propertyType` is uniform.** Every generated unit is `'Residential'`, set from one constant. The `PropertyType` union already admits `Commercial` / `Parking` / `Common`, so varying it is a change to the generator — but nothing yet reads it as anything but a label.
- ~~**The 3D ULPIN identifier format is still undecided.**~~ **Closed.** Decided as `KA-BLR-0482-001928-F03-U02` — state, city/district, ward, parcel, floor, unit. The encoder is Phase 6; see *Next phase*.
- ~~The demo dataset (buildings, floors, units, coordinates) does not exist yet.~~ **Partly closed at Phase 7.** One parcel with a boundary, a footprint and real coordinates now exists in `src/data/demoParcel.ts`. Still one parcel, one building — there is no multi-parcel dataset and no loader.

## Last verified state

- **Verified on:** 2026-09-04
- **Verified by:** the developer, on the Windows host — the first end-to-end verification
  in the project's history.
- **What was verified:**
  - `npm run build` (`tsc --noEmit && vite build`) — **PASS**. The bundle builds, and the
    code type-checks against the real `@types/three` and the R3F/drei definitions.
  - `npm run dev` — **PASS**. The scene renders.
  - **20 independent 3D unit meshes**, 4 per floor, drawn correctly.
  - OrbitControls still working; the summary panel's values correct; no visible overlap
    or rendering conflict.
  - Committed and pushed as `Phase 4: subdivide floors into 3D property units`.
  - **Public deployment working.** <https://3d-ulpin-three.vercel.app> opened and tested in
    the browser. It served the Phase 3 build at the time, because Phase 4 had not been
    pushed yet — which confirms the GitHub → Vercel pipeline is functioning and tracks the
    repo's pushed state.
- **Also verified earlier, in the cloud sandbox:** `buildingConfig.ts` + `unitLayout.ts`
  compiled and **executed** — 20 units, 4 per floor, numbering 101–504, 9 × 7 × 3 m,
  63 m², 189 m³, floor 3 at y 6–9 m with centres at 7.5 m, exact tiling of the 18 × 14 m
  footprint with zero overlaps, total volume 3 780 m³. Every assertion passed. Sources
  parsed cleanly under `tsc --strict`.
- **Conclusion:** **Phase 4 is complete.** Source, build, render and behaviour all
  verified, and the work is committed and pushed. Phase 3 is closed with it. The project
  has a recoverable checkpoint for the first time, and Phase 5 started from a known-good
  state.
- **Phases 5–9 are NOT part of the above.** Phase 5 has since been verified on the host and committed (see *Local verification — Phase 5*). Phases 6, 7, 8 and 9 have not been built, rendered or committed anywhere. Their pure layers have been compiled and executed in the sandbox; their React / Three.js / Leaflet layers have never been type-checked against the *real* dependencies, because the sandbox cannot install them. Phase 9's sandbox pass used hand-written stubs, which checks the project's own wiring but not third-party prop names.
- **Phase 5 detail, retained:** Its source is written and its data model has been
  compiled and executed in the sandbox, but nothing from Phase 5 has been built, rendered
  or committed on the host. The last verified *and committed* state of this project is
  still Phase 4. Run the Phase 5 checklist before treating it as done.
- **Outstanding check:** the live URL was last observed serving the **Phase 3** build,
  before the Phase 4 push. Vercel should have rebuilt on that push — worth opening
  <https://3d-ulpin-three.vercel.app> once and confirming the 20 unit boxes are there.
  This is a confirmation, not a blocker: the pipeline itself is known to work.

---

## LAST SAFE SOURCE CHECKPOINT

> **Last safe source checkpoint:**
> Subphase F — conflict visualisation — **source complete**.
> **All six subphases (A–F) of Phase 10 are source complete.**
>
> **Next:**
> **Host verification.** Nothing further should be built until
> `npm install && npm run build` has run on the Windows machine and the browser
> checklists in each subphase's section above have been walked through — the
> Subphase F checklist first, since it is the newest and the only one whose
> `vite build` has never run anywhere. No new phase has been started.
>
> **After verification, the next phase is a decision rather than a task:**
> final presentation polish, the basement / below-ground extension, or AI-assisted
> input. **To be decided later** — none of the three has been started, and
> Subphase F deliberately added no AI, no backend, no database and no basement.

**Nothing in Phases 6–10 has been host-verified or committed.** The sandbox can
typecheck the tree and execute every pure self-check; it cannot install
react / three / @react-three / react-leaflet and it cannot render. Treat
"source complete" as exactly that and no more.

### Subphase ledger — Phase 10

| Subphase | Scope | State |
|---|---|---|
| A | Full ownership exploded view (floors **and** units) | **SOURCE COMPLETE** |
| B | Floor isolation mode | **SOURCE COMPLETE** |
| C | Topology validation engine | **SOURCE COMPLETE** |
| D | Ownership conflict simulation | **SOURCE COMPLETE** |
| E | Ownership / validation presentation | **SOURCE COMPLETE** |
| F | Conflict visualisation (focus, animation, ghost, intersection volume) | **SOURCE COMPLETE** |
| G | Conflict UI placement — alert over the canvas, details docked right | **SOURCE COMPLETE** |

### Next planned phase

**To be decided later.** One of:

- **Final presentation polish** — the demo script, timing, and whatever the host
  verification of Subphases F, G and H turns up.
- **AI-assisted input** — deliberately last, and deliberately not started.

Neither has been begun. Subphase H (below) added no AI, no backend, no database
and no export.

### How to resume this work

1. Read this section, then *Completed — Subphase A* above for what exists.
2. `ARCHITECTURE.md` §9 covers the generation animation and the exploded view;
   §10.0 states the separation of canonical geometry / visualisation transform /
   simulation override / **presentation geometry** — four kinds since Subphase F,
   and the architectural rule everything here obeys. §10.6 covers the conflict
   visualisation in full, and §10.7 covers where that finding is presented.
3. Every pure module has a `check*()` function returning `CheckResult[]` and a
   dev-only `run*SelfCheck()`. `App.tsx` runs them all under `import.meta.env.DEV`.
4. Do not commit. Do not touch `.git`. Verification happens on the Windows host.

---

## Phase 10 — Subphase H: basement / below-ground volumes

**Recovered state.** The previous session ended at commit `b30eaae`
("Milestone: complete advanced 3D cadastre conflict workflow") with a **clean
working tree and no basement code of any kind** — the phase had not started, so
nothing was resumed and nothing was reimplemented.

**Completed now.** Basement config and level layouts (−3.0 → 0.0 m); underground
space model on the building's own footprint; `B01-U0n` prototype identifiers;
underground topology rules (levels, containment, interval, overlap within and
across the datum, count) plus register-wide identifier uniqueness and
parcel consistency; underground view mode with ghosted tower, thinned ground
plane, drawn `y = 0` datum ring, relaxed orbit limit and an `Underground` camera
preset; downward exploded separation; selection, Property Inspector, ownership
hierarchy and summary totals for underground spaces through the **existing**
single-selection and single-inspector architecture.

**Unfinished.** None in this subphase.

**Self-check result.** 18 new underground checks pass; the 61 pre-existing pure
checks (topology 25, exploded 15, ULPIN 4, footprint 17) still pass unchanged.
Model: basement −3.0 → 0.0 m, 4 underground spaces, 20 + 4 = **24** 3D spaces,
all identifiers unique, one parent parcel, `status: valid`; the staged conflict
still reports `conflict` on `unit-301` / `unit-302` with every underground rule
passing.

**Host verification required.** All of the above is *source* complete and
type-clean; nothing in this session ran Vite, a browser or the real
`react` / `three` / `@react-three` packages. Run `npm run typecheck` and
`npm run dev` on the Windows host before treating any of it as working.

**LAST SAFE SOURCE CHECKPOINT:** commit `b30eaae` (unchanged — nothing was
committed). Working tree now carries Subphase H, uncommitted.
