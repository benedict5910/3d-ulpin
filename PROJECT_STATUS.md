# PROJECT_STATUS

**Project name:** 3D ULPIN

**Goal:** SIH prototype for 3D ULPIN and vertical property mapping — a demonstrable system that extends the flat, parcel-level ULPIN idea into three dimensions so that individual floors/units in a vertical building can each be identified, located and inspected.

**Current phase:** Phase 7 – GIS parcel map — **source complete, awaiting local verification, not committed**. Phase 6 is also source-complete and uncommitted. Phase 5 is the last verified and committed state. Next: Phase 8 – connect the 2D parcel to the 3D building.

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

## Next phase

**Phase 8 – connect the 2D parcel to the 3D building.** *Do not start before
Phase 7 is verified on the host.*

Phases 6 and 7 built the two halves of a vertical property record and gave them
a shared identity. They are still two views that happen to agree. Phase 8 makes
the connection a *workflow*: the 2D parcel becomes the input the 3D model is
generated from, rather than a picture beside it.

Expected scope:

1. Selecting the parcel on the map selects the building it carries, and
   highlights it in the 3D scene — one selection state across both views, the
   double-headed arrow the §1 architecture diagram has always shown.
2. Drive the 3D building's footprint *from* the parcel geometry rather than from
   `BuildingConfig` alone: read the footprint ring, convert lat/lng back into
   local metres, and extrude it. That inverts today's direction, in which the
   config feeds the map.
3. Handle a non-rectangular footprint, which follows immediately from (2) and is
   the first thing that genuinely needs `ExtrudeGeometry` rather than a box.
4. Only then consider topology validation (is the footprint inside the parcel?
   do parcels overlap?) — it becomes meaningful the moment geometry can be
   edited or supplied, and is noise while both rings are constants.
5. Still no backend, no cadastral API, no AI extraction.

Deferred beyond that, unchanged from Phase 6: a **decoder** for the prototype
identifier. Nothing yet reads an identifier back apart, and a parser written
before it has a caller is a parser written against a guess.

## Known issues

- ~~**Build unverified.**~~ **Closed at Phase 4.** `npm run build` and `npm run dev` both pass on the host. The blocking item since Phase 1.
- ~~**Dependency versions are ranges chosen without registry access.**~~ **Closed at Phase 4.** `three ^0.180.0`, `@react-three/fiber ^9.0.0`, `@react-three/drei ^10.0.0` and `@types/three ^0.180.0` resolved, installed and type-checked successfully.
- ~~**No `package-lock.json` yet.**~~ **Closed.** Present in the repo and now committed, so Vercel will build reproducibly.
- ~~**Nothing committed to Git.**~~ **Closed at Phase 4.** Phases 0–4 are committed and pushed.
- **`three` and `@types/three` must stay on the same minor.** Three.js ships breaking changes between `0.x` releases, so if one is bumped the other must be bumped to match. Still live — a future `npm update` can break this silently.
- ~~**Vercel is not wired up.**~~ **Not an issue — it was already configured.** GitHub → Vercel is connected and <https://3d-ulpin-three.vercel.app> is live; the pipeline has been observed serving the repo's pushed state.
- **The 0.06 m visual gap is cosmetic and must stay that way.** It is subtracted from each unit box's geometry size symmetrically, in all three axes, so it never moves a mesh centre. If a later phase needs real slab thickness, wall thickness or floor-to-ceiling clearance, that belongs in `BuildingConfig` as its own field, not in the visual constant.
- **The unit grid is uniform by assumption.** Every floor is cut the same way and every unit is identical, which is why the summary panel can describe all 20 from `units[0]`. Real buildings have differently sized flats and floors that differ from each other; when that arrives, `buildApartmentUnits` needs a per-floor partition rather than one grid, and the panel needs a range rather than a single figure.
- **Unit numbering assumes fewer than 100 units per floor.** `unitNumber` is `floorLevel` + a 2-digit index, so floor 1 unit 100 would collide with floor 11 unit 0. This affects the *door label only* — as of Phase 6 the prototype 3D ULPIN is built from `floorLevel` and `indexOnFloor` as separate padded segments, so it cannot collide this way.
- ~~**Phase 5 is unverified and uncommitted.**~~ **Closed.** Verified on the host and committed on 2026-09-04.
- **Phase 7 is unverified and uncommitted, and it added dependencies.** `leaflet`, `react-leaflet` and `@types/leaflet` are declared in `package.json` but `npm install` has not been run, so `node_modules` does not contain them and `package-lock.json` is out of date. Nothing in Phase 7 can build until that install succeeds. The three `.tsx` map components have never been type-checked or rendered anywhere — see *Local verification REQUIRED — Phase 7*.
- **`react-leaflet` v5 requires React 19.** That matches this project, but it is a hard peer requirement rather than a preference: if npm resolves an older `react-leaflet` major, the map components' props will not type-check. Confirm the installed major is 5.
- **The map depends on a network for its basemap, and only for its basemap.** OpenStreetMap tiles are fetched at runtime; the parcel and footprint are local constants. Offline, the map greys out and every cadastral shape and figure still renders. Worth knowing before a demo on conference Wi-Fi — and worth showing, because it makes the distinction visible.
- **No topology validation.** Nothing checks that the footprint lies inside the parcel, that the rings are simple, or that the winding order is consistent. `polygonAreaSqM()` uses `Math.abs`, so a reversed ring reports the right area rather than a negative one — which is forgiving, and also means a badly wound ring would go unnoticed. This is deliberate while both rings are constants; it becomes necessary the moment geometry can be supplied or edited.
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
- **Phases 5, 6 and 7 are NOT part of the above.** Phase 5 has since been verified on the host and committed (see *Local verification — Phase 5*). Phases 6 and 7 have not been built, rendered or committed anywhere; Phase 7's data layer has been executed in the sandbox and its React/Leaflet layer has not been compiled at all.
- **Phase 5 detail, retained:** Its source is written and its data model has been
  compiled and executed in the sandbox, but nothing from Phase 5 has been built, rendered
  or committed on the host. The last verified *and committed* state of this project is
  still Phase 4. Run the Phase 5 checklist before treating it as done.
- **Outstanding check:** the live URL was last observed serving the **Phase 3** build,
  before the Phase 4 push. Vercel should have rebuilt on that push — worth opening
  <https://3d-ulpin-three.vercel.app> once and confirming the 20 unit boxes are there.
  This is a confirmation, not a blocker: the pipeline itself is known to work.
