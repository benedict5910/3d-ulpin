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
- **drei** is a companion library of ready-made helpers for R3F. So far exactly one of them is used, `OrbitControls`.
- Buildings are rendered as footprints split vertically into floors and horizontally into property units — **one mesh per unit as of Phase 4** — so that each unit can later be made clickable and mapped to its own unit-level ULPIN.

#### How R3F sits between React and Three.js

R3F is **not** a different 3D engine. It is a *renderer* — the same idea as
`react-dom`, pointed at a different target:

```
   React                react-dom          →  HTML DOM nodes   (<div>, <p>)
   (the same
    component     ──►
    model)
                       react-three-fiber   →  Three.js objects (Mesh, Light, Camera)
```

`react-dom` turns `<div />` into a real DOM element. R3F turns `<mesh />` into a
real `THREE.Mesh`. Every lowercase tag inside `<Canvas>` maps to a Three.js class
by name, and its props map to that object's properties:

| JSX written in this repo | Three.js object constructed |
|---|---|
| `<mesh position={[0, 7.5, 0]}>` | `new THREE.Mesh()`, then `mesh.position.set(0, 7.5, 0)` |
| `<boxGeometry args={[18, 3, 14]} />` | `new THREE.BoxGeometry(18, 3, 14)`, attached to the parent mesh |
| `<meshStandardMaterial color="#5b7286" />` | `new THREE.MeshStandardMaterial({ color: '#5b7286' })` |
| `<directionalLight intensity={2} />` | `new THREE.DirectionalLight()` with `intensity = 2` |

`args` is the constructor's argument list; every other prop is set on the object
after construction. Nesting in JSX becomes parent/child nesting in the Three.js
scene graph, so a child's position is relative to its parent.

**Why this matters for this project:** the 3D view is made of ordinary React
components, so when a floor or unit is later selected, the same piece of React
state can drive the 3D scene, the Leaflet map and the detail panel at once.
Without R3F, the 3D view would be an imperative island that has to be manually
kept in sync with the rest of the UI.

#### Scene, camera, light, object — the relationship

A 3D frame needs four things, and none of them is optional:

```
  SCENE ─── the container / coordinate space. Everything else lives inside it.
    │       Also holds background colour and fog.
    │
    ├── CAMERA  the point of view. Position + direction + field of view decide
    │           which part of the scene lands on screen. Move the camera and
    │           nothing in the world changes — only what you see.
    │
    ├── LIGHTS  MeshStandardMaterial computes colour from light. With no light
    │           in the scene, every surface renders black — the geometry is
    │           still there, it is simply unlit.
    │
    └── OBJECTS (meshes) each = GEOMETRY (the shape: vertices/faces)
                              + MATERIAL (how the surface responds to light)
```

The renderer then does one job, sixty times a second: look at the scene from the
camera, work out how light falls on each surface, and paint the result into the
`<canvas>`.

In this repo those four map onto:

| Concept | Where it lives |
|---|---|
| Scene | created implicitly by `<Canvas>` in `SceneViewer.tsx` |
| Camera | `<Canvas camera={{ position: [10, 8, 12], fov: 45 }}>` |
| Lights | `<ambientLight>` (flat fill) + `<directionalLight>` (sun, casts the shadow) |
| Objects | `<Building />` (the generated stack of unit meshes) and `<Ground />` (plane + grid) |

`OrbitControls` sits alongside these: it does not add anything to the scene, it
just listens for mouse events and moves the **camera** around a target point.

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

## 3. The building model (Phase 3)

### 3.1 Unit convention: **1 Three.js unit = 1 metre**

Fixed for the whole project, and non-negotiable from here on.

Three.js itself is unitless — a `BoxGeometry(18, 3, 14)` is just three numbers.
That freedom is a liability for a cadastre prototype, where every quantity the
project is *about* (floor height, building height, footprint, and later the
vertical component of a 3D ULPIN) is a real-world measurement. Declaring the
scale once means:

- a value read off the scene is already a legal/physical quantity — no conversion step;
- the 3D model and any future GIS/registry data speak the same language;
- there is exactly one scale in the codebase, so a wrong number is visibly wrong
  rather than plausibly in "some other unit".

The reference grid in `Ground.tsx` is sized `120` with `120` divisions, so **one
grid square is exactly 1 × 1 m** — the convention is visible on screen, not just
asserted in a comment.

### 3.2 The building configuration model

`src/scene/buildingConfig.ts` is the single source of truth. It contains no
React and no Three.js — only data and arithmetic.

```ts
interface BuildingConfig {
  width: number           // metres, along X
  depth: number           // metres, along Z
  numberOfFloors: number
  floorHeight: number     // metres, floor-to-floor, uniform
  unitColumns: number     // Phase 4: units per floor along X
  unitRows: number        // Phase 4: units per floor along Z
}

const DEFAULT_BUILDING_CONFIG = {
  width: 18, depth: 14, numberOfFloors: 5, floorHeight: 3,
  unitColumns: 2, unitRows: 2,
}
```

Everything else about the building is **derived**, never stored alongside it:

| Derived value | Formula | For this config |
|---|---|---|
| `floorBaseY` | `floorIndex * floorHeight` | 0, 3, 6, 9, 12 m |
| `floorCenterY` | `floorBaseY + floorHeight / 2` | 1.5, 4.5, 7.5, 10.5, 13.5 m |
| `topY` | `floorBaseY + floorHeight` | 3, 6, 9, 12, 15 m |
| total height | `numberOfFloors * floorHeight` | 15.0 m |
| units per floor | `unitColumns * unitRows` | 4 |
| total units | `numberOfFloors * unitsPerFloor` | 20 |

Storing a derived value would create a second place that has to be kept in step
with the first, and the two would eventually disagree — a rendered building of
five floors described by a panel claiming six. Deriving makes that class of bug
unrepresentable.

### 3.3 Procedural floor generation

`Building.tsx` places nothing by hand. It reads the config and calls
`buildFloorLayouts(config)`, which returns one `FloorLayout` per floor — the
vertical slicing of the building, and nothing else.

```
BuildingConfig  ──►  buildFloorLayouts()  ──►  FloorLayout[]
 (6 numbers)          the loop + maths        base/top/centre per floor
```

In Phase 3 each `FloorLayout` became one slab mesh. As of Phase 4 it is an
**intermediate result**: the floors define the vertical extent, and §4 subdivides
each one horizontally into the property units that are actually rendered. The
floor maths is unchanged — a unit's `yMin`/`yMax` are its floor's `baseY`/`topY`,
copied verbatim.

Changing `numberOfFloors` to 12 produces a twelve-storey building, correct
elevations, correct total height and a correct summary panel, with **no edit to
`Building.tsx` at all**. That is the test of whether the generation is genuinely
procedural.

### 3.4 Floor base vs mesh centre — why they differ

This is the one genuine trap in the phase.

A `BoxGeometry` is built **centred on its own origin**: a 3 m tall box spans
−1.5 m to +1.5 m locally. So `mesh.position.y` positions the box's **centre**,
not its underside. Placing a floor at its `baseY` would sink half of it below
where it belongs — the ground floor would occupy −1.5 to +1.5 m and be half
buried.

```
   logical model                  what Three.js needs
   (what a cadastre records)      (where the mesh origin goes)

   topY   ── 3 m ───────┐
                        │  slab      centerY = 1.5 m  ●  ← mesh.position.y
   baseY  ── 0 m ───────┘                                 (the middle)
            ground
```

So the code keeps both, and keeps them separate:

- **`baseY` / `topY`** — the logical, real-world extent of the floor. These are
  the numbers the project is about, and the ones a ULPIN will eventually encode.
- **`centerY`** — a rendering detail, computed as `baseY + floorHeight / 2`,
  existing only because of how Three.js anchors a box.

The 0.06 m visual gap is applied to the box's *size* symmetrically, so the
centre is unmoved: floor 3 still occupies exactly 6–9 m in the model even though
its visible geometry is 2.94 m tall. **The pixels are allowed to differ from the
model; the model is not allowed to drift.**

The same rule governs the units in §4, in all three axes.

---

## 4. The property-unit model (Phase 4)

Phase 3 gave the building floors. Phase 4 gives it **properties**: each
above-ground floor is subdivided into four independent 3D units, so the thing on
screen is no longer a storey but an apartment — the object a 3D ULPIN will
actually identify.

### 4.1 The `ApartmentUnit` model

`src/scene/unitLayout.ts` is the second pure-data module, alongside
`buildingConfig.ts`: no React, no Three.js, only a description of property.

```ts
interface ApartmentUnit {
  id: string            // "unit-301" — unique within the building
  floorLevel: number    // 3        (1-based, ground floor is 1)
  indexOnFloor: number  // 1        (1-based, within its own floor)
  unitNumber: string    // "301"    (the door number)
  column: number        // 0        (0-based grid coordinate along X)
  row: number           // 0        (0-based grid coordinate along Z)

  xMin: number; xMax: number   // -9 → 0   metres, along X (width)
  yMin: number; yMax: number   //  6 → 9   metres above ground (height)
  zMin: number; zMax: number   // -7 → 0   metres, along Z (depth)

  width: number         // 9   m    = xMax - xMin
  depth: number         // 7   m    = zMax - zMin
  height: number        // 3   m    = yMax - yMin
  areaSqM: number       // 63  m²   = width * depth
  volumeCubicM: number  // 189 m³   = areaSqM * height
}
```

**Why six bounds rather than a centre and a size.** Bounds are what a register
records — "this property occupies 0–9 m east, 6–9 m up". They also compose:
two units are adjacent exactly when one's `max` equals the other's `min`, a unit
is inside a floor exactly when its `yMin`/`yMax` fall within the floor's, and two
units overlap exactly when their intervals overlap on all three axes. Every one
of those is a comparison of numbers already present. Store a centre and a size
instead and each of those questions has to reconstruct the bounds first — and a
future ULPIN, GIS export or topology check would each reconstruct them
separately, which is three chances to disagree.

`width` / `depth` / `height` / `areaSqM` / `volumeCubicM` *are* derivable from
the bounds, and are stored anyway — but only because they are the values every
consumer wants and computing them once, in the module that owns the bounds,
means no consumer subtracts a pair of coordinates by hand. The centre is
deliberately **not** stored (see §4.3).

### 4.2 How a floor becomes four units

The subdivision is a plain 2D grid over the floor's footprint —
`unitColumns` cells along X, `unitRows` along Z — taken from the same
`BuildingConfig` as everything else. The building is centred on the origin, so
the footprint runs from `−width / 2` to `+width / 2` and from `−depth / 2` to
`+depth / 2`, and a cell's bounds are offsets into that:

```
  unitWidth = width / unitColumns          18 / 2 = 9 m
  unitDepth = depth / unitRows             14 / 2 = 7 m

  xMin = -width / 2 + column * unitWidth   xMax = xMin + unitWidth
  zMin = -depth / 2 + row    * unitDepth   zMax = zMin + unitDepth
  yMin = floor.baseY                       yMax = floor.topY     ← inherited
```

Floor 3 (`baseY` 6 m, `topY` 9 m) therefore produces:

```
            z = -7                z = 0                 z = +7
  x = -9   ┌────────────────────┬────────────────────┐
           │  301               │  303               │   each 9 × 7 m
           │  x[-9, 0] z[-7, 0] │  x[-9, 0] z[0, 7]  │   y[6, 9] for all four
  x =  0   ├────────────────────┼────────────────────┤   63 m²   189 m³
           │  302               │  304               │
           │  x[0, 9] z[-7, 0]  │  x[0, 9] z[0, 7]   │
  x = +9   └────────────────────┴────────────────────┘
```

Two properties of this are worth stating because they are what make the
subdivision *correct* rather than merely plausible:

- **The vertical bounds are not computed here.** They are copied from the floor
  the unit belongs to. A unit therefore cannot disagree with its floor about
  which 3 m slice of the building it occupies — the disagreement is not
  representable.
- **The four units tile the floor exactly.** 4 × 63 m² = 252 m² = 18 × 14 m,
  with no gap and no overlap, because each cell starts precisely where the
  previous one ended. Executed and checked: see PROJECT_STATUS.md.

Naming follows the ordinary Indian convention `floor` + `unit`, zero-padded to
two digits: floor 1 gives 101–104, floor 5 gives 501–504. The padding is not
cosmetic — it keeps the numbers sortable and unambiguous once a floor holds more
than nine units.

The generation itself is one nested loop over `FloorLayout[]`:

```
BuildingConfig ──► buildFloorLayouts() ──► FloorLayout[] ──► buildApartmentUnits()
 (6 numbers)        vertical slicing        5 floors          horizontal slicing
                                                                     │
                                                                     ▼
                                                            ApartmentUnit[]  (20)
```

Twenty units exist because the config says five floors of a 2 × 2 grid. Nothing
is hard-coded: setting `unitColumns` to 3 gives 15 units of 6 × 7 m, and
`numberOfFloors` to 12 gives 48 units, with no edit to `unitLayout.ts`,
`Building.tsx` or the summary panel.

### 4.3 From bounds to mesh centre

`BoxGeometry` is built centred on its own origin, so `mesh.position` places a
box's **centre**. The unit model stores corners. `getUnitCenter(unit)` bridges
the two, and is the only place the conversion is written:

```ts
centerX = (xMin + xMax) / 2      // (-9 + 0) / 2  = -4.5
centerY = (yMin + yMax) / 2      // ( 6 + 9) / 2  =  7.5
centerZ = (zMin + zMax) / 2      // (-7 + 0) / 2  = -3.5
```

It is a **function, not a field**. Storing the centre alongside the bounds would
put the same fact in two places, and the pair would eventually drift — an edit
that moves a wall would have to remember to move the centre too. Deriving it
means a unit has exactly one description of where it is, and the renderer asks
for the form it needs at the moment it needs it. This is the same
logical-vs-rendering split Phase 3 drew between `baseY`/`topY` and `centerY`,
now in all three axes:

> **`xMin`…`zMax` are what the cadastre records. The centre is how Three.js
> happens to want it.**

### 4.4 Why each unit is a separate mesh

Twenty meshes cost more than one, and the geometry could have been merged. It is
not, for one reason: **an apartment is the unit of ownership, so it has to be an
object.**

- A mesh can be picked. Phase 5 raycasts a click to a mesh; a mesh that *is* a
  unit resolves straight to `unit.id`. A merged box would give a triangle index,
  from which the unit would have to be reverse-engineered by comparing the hit
  point against every unit's bounds — solving a problem the geometry had already
  solved and then thrown away.
- A mesh can carry state. Selection highlighting, hover, per-unit colouring by an
  attribute (vacant / registered / disputed) are all one material on one object.
- A mesh can carry identity. `name={unit.id}` means the scene graph itself knows
  which apartment is which — inspectable in the browser, and directly mappable to
  the unit-level ULPIN the project exists to demonstrate.

This is the same argument Phase 3 made for one mesh per floor, one level further
down, and it is why Phase 4 **removed** the full-floor slabs rather than keeping
them underneath. The units now fill the entire building volume; rendering the old
slabs as well would put an opaque box inside every apartment, z-fighting with it
and hiding the very subdivision the phase exists to show. There is no separate
slab geometry: the visible structure between floors and between neighbours is the
0.06 m gap shaved off each unit box, which is cheaper than extra meshes and
cannot overlap anything.

### 4.5 How this connects to a vertical cadastre

A conventional cadastre is a set of 2D polygons: a parcel has a boundary, an
owner and an identifier, and everything above and below it is implicitly the same
property. That model cannot describe a tower, where twenty owners share one
footprint and are distinguished only by elevation.

The unit model is the smallest honest fix: each property carries its own
**3D extent**, and the vertical interval is a first-class part of it rather than
an afterthought. From that, everything a vertical register needs follows:

| Registry question | Answered by |
|---|---|
| Where is this property? | `xMin…zMax` — a 3D envelope, not a footprint |
| How big is it? | `areaSqM` for a deed, `volumeCubicM` for air rights |
| Which floor is it on? | `floorLevel`, and independently `yMin`/`yMax` |
| What is it called? | `unitNumber` — the door number an owner recognises |
| Do two claims collide? | interval overlap on all three axes |
| What is its 3D ULPIN? | parcel + building + `floorLevel` + `unitNumber` (Phase 6+) |

The last row is the point of the project. A flat ULPIN identifies the parcel this
building stands on; the vertical component that turns it into a 3D ULPIN is
exactly the floor-and-unit pair this phase generates, and the bounds are what
makes that identifier *resolvable* to a real volume of space rather than just a
label.

---

## 5. Repository shape

### As built (Phases 1–4 — this exists now)

```
3d-ulpin/
├─ PROJECT_STATUS.md         # where the project stands right now
├─ ARCHITECTURE.md           # this file
├─ .gitignore                # excludes node_modules/, dist/, env files
├─ index.html                # the single HTML page Vite serves; holds <div id="root">
├─ package.json              # dependencies + the dev/build/preview scripts
├─ tsconfig.json             # one TypeScript config, covering src/ and vite.config.ts
├─ vite.config.ts            # Vite config; enables the React plugin
└─ src/
   ├─ main.tsx               # entry point: mounts <App> into #root
   ├─ App.tsx                # page shell: header, viewer (+ overlay), footer
   ├─ index.css              # dark theme; global styles
   ├─ vite-env.d.ts          # tells TypeScript about Vite-specific imports (e.g. CSS)
   ├─ scene/                 # everything 3D (added Phase 2)
   │  ├─ buildingConfig.ts   # Phase 3: the config type, floor maths, total height
   │  ├─ unitLayout.ts       # Phase 4: ApartmentUnit, the 2 x 2 subdivision, centres
   │  ├─ SceneViewer.tsx     # <Canvas>: camera, lights, fog, OrbitControls
   │  ├─ Building.tsx        # Phase 4: generates one mesh per property unit
   │  └─ Ground.tsx          # ground plane + 1 m reference grid
   └─ ui/                    # HTML overlays and panels (added Phase 3)
      └─ BuildingSummary.tsx # building dimensions + property-unit read-out
```

Deliberately **not** included, to keep the foundation small: no ESLint config, no
`App.css`, and none of the Vite starter assets or demo counter component.

**Why `scene/` is split.** `SceneViewer` owns the *environment* (camera, lights,
controls), `Building` / `Ground` own the *contents*, and `buildingConfig.ts` /
`unitLayout.ts` own the *numbers*. Phase 3 proved the split works: replacing the
placeholder box with a generated floor stack touched `Building.tsx` and added one
data module; the camera and lighting code only changed to re-frame a larger
subject, and it did so by reading the same config rather than by hand-tuned
constants. Phase 4 proved it again at a smaller cost: subdividing every floor
added one data module and rewrote one component's render body, and
`SceneViewer.tsx` and `Ground.tsx` were not touched at all — the building's
outer envelope did not change, only what it is made of.

**Why the unit maths is a second module, not more of `buildingConfig.ts`.**
The config describes *the building* — six numbers an architect would give you.
`unitLayout.ts` describes *the properties inside it* — the objects a registry
owns. They change for different reasons and will end up in different places:
`BuildingConfig` is headed for `types/` as one node of
`parcel → building → floor → unit`, while `ApartmentUnit` is what the ULPIN
encoder, the detail panel and any GIS export will consume. Splitting them now
costs one import and keeps that seam visible.

**Why `BuildingSummary` lives in `ui/`, not `scene/`.** It is HTML positioned over
the canvas, not a 3D object. Keeping the boundary strict means the 3D code never
has to know a panel exists — it only exports the config, and the panel derives its
own values from it.

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

`BuildingConfig` and `ApartmentUnit` are expected to move into `types/` once they
stop describing a lone building and become nodes of
`parcel → building → floor → unit`. They sit in `scene/` for now because that is
their only consumer; moving them early would be structure without a reason.

### Toolchain as pinned in `package.json`

| Package | Range | Role |
|---|---|---|
| `react`, `react-dom` | `^19.1.0` | UI library and its browser renderer |
| `three` | `^0.180.0` | the 3D engine (WebGL) |
| `@react-three/fiber` | `^9.0.0` | React renderer for Three.js |
| `@react-three/drei` | `^10.0.0` | R3F helpers; only `OrbitControls` is used so far |
| `@types/three` | `^0.180.0` | type definitions for Three.js |
| `vite` | `^7.0.0` | dev server and production bundler |
| `@vitejs/plugin-react` | `^5.0.0` | teaches Vite to compile JSX and enable fast refresh |
| `typescript` | `^5.9.0` | type checking (`tsc --noEmit`, run as part of `npm run build`) |
| `@types/react`, `@types/react-dom` | `^19.1.0` | type definitions for React |

`npm run build` runs `tsc --noEmit && vite build`, so a type error fails the build
rather than shipping silently — Vite alone strips types without checking them.

---

## 6. Why we are building incrementally

The build is split into small phases, and **each phase must leave the project runnable, documented and committed** before the next one starts.

1. **This is a 48-hour prototype.** The real risk is not writing too little code — it is having a large amount of code that does not run an hour before the deadline. Small steps mean the broken thing is always the last small thing.
2. **Every phase is a recoverable checkpoint.** A commit that runs is a point to return to. Without checkpoints, a bad change means unpicking it by hand under time pressure.
3. **There is always something to demo.** From Phase 1 onward the project has a working URL. If time runs out, the prototype is smaller than planned but still complete and presentable — never half-built.
4. **Understanding, not just output.** Each phase is small enough to read, explain and defend to a judge. The point of the project is to understand the architecture, and that only happens if each piece is absorbed as it lands.
5. **Documentation stays true.** `PROJECT_STATUS.md` is updated at each checkpoint, so the project's state is a fact that has been verified, not a memory.
