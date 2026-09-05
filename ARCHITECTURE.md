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

*As of Phase 8 the arrow from the map to the 3D view is real: the building's
horizontal geometry **is** the cadastral footprint polygon shown on the map, not
a second description of it — see §8. Phase 9 made that derivation visible as an
animated 2D→3D generation, and added the exploded view, camera presets and
labels a live demonstration needs — see §9. What is still aspirational is the
arrow back: selection state is shared within the 3D half only, and clicking a
unit does not yet highlight anything on the map.*

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

- Lightweight, no API key, works with free tile providers, and handles the standard GIS primitives the prototype needs: base map tiles, polygons for parcel boundaries, markers and tooltips.
- Leaflet gives the horizontal (real-world location) half of the story; Three.js gives the vertical half. Together they are the "3D" in 3D ULPIN.
- **Built in Phase 7** — see §7. `react-leaflet` is the React binding, and it stands in the same relation to Leaflet that `@react-three/fiber` does to Three.js: a declarative wrapper, never a second model.

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

> **Superseded in part by Phase 8.** `width` and `depth` were removed from
> `BuildingConfig`; the building's horizontal geometry is now the footprint
> polygon in `data/demoParcel.ts`, measured by `geometry/footprint.ts`. The
> vertical and subdivision fields below are unchanged and still live here — see
> §8.2 for what moved and §8.7 for why floor height did not. The listing in this
> section is kept as the Phase 3 record.

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

> **Superseded in part by Phase 8.** The grid is now laid over the *footprint
> polygon's bounding box* rather than over `config.width` / `config.depth`:
> `bounds.xMin + column × unitWidth`, and so on. For the demo footprint —
> centred on the origin — `bounds.xMin` **is** `−width / 2`, so every coordinate
> below is unchanged. See §8.8, including why the bounding box is still a
> prototype limitation for irregular plans.

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

## 5. Selection and the property inspector (Phase 5)

Phases 3 and 4 built a model and drew it. Phase 5 is the first phase where the
app has to answer a question about *what the user is looking at*: which of the
twenty property units is currently under inspection. That is the "state layer"
from §1 appearing for the first time, and it is small enough to describe
completely.

### 5.1 Where the selection lives, and what is stored

```tsx
// src/App.tsx
const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
```

**Which component owns it.** `App`. The two things that care about the selection
are the 3D scene (which must draw one unit differently) and the property
inspector (which must describe it). Those are siblings: the scene is inside a
`<Canvas>`, the inspector is HTML positioned over it. The nearest component that
contains both is `App`, so that is where the state goes — the standard "lift
state to the closest common ancestor" rule. Anything lower cannot serve both;
anything higher only adds distance.

Hover state is the counter-example and is deliberately *not* lifted. Nothing
outside the 3D scene reacts to hover, so it stays local to `Building`:

```tsx
// src/scene/Building.tsx
const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)
```

The rule the project follows: **state rises exactly as far as its readers, and
no further.**

**Why an id and not the unit object.** `selectedUnitId` is a `string | null`.
The obvious alternative — `useState<ApartmentUnit | null>` — would work today,
and it is worth being explicit about why it was rejected:

| | `selectedUnitId: string \| null` | `selectedUnit: ApartmentUnit \| null` |
|---|---|---|
| What state means | *which* unit is selected | *a copy of* the selected unit |
| Comparison | `unit.id === selectedUnitId` — a string compare each mesh can do for itself | reference equality, which silently breaks if the array is ever rebuilt |
| If the config changes | the id either resolves or resolves to `null`, and the panel returns to its empty state | the reference survives as a unit the scene no longer draws — a selection of something invisible |
| Copies of the data | one: the generated `units` array | two: the array, plus whatever React is holding |
| Serialising it later (a URL, a saved view, a shared link) | it is already a string | needs flattening to an id anyway |

The id is the **question**; the generated `units` array remains the only place
with the **answer**. Turning one into the other is a single function:

```ts
// src/scene/unitLayout.ts
export function findUnitById(units: ApartmentUnit[], unitId: string | null): ApartmentUnit | null
```

`App` calls it and hands the result to the inspector. The panel therefore
receives *the* unit — the identical object the mesh was positioned from — not a
description of it.

### 5.2 How React Three Fiber pointer events work

A WebGL canvas is **one DOM element**. The browser sees a rectangle of pixels;
it has no idea there are twenty boxes inside it, so it cannot fire a `click` on
"unit 302" the way it would on a `<button>`. Something has to translate a 2D
pointer position into a 3D answer. That something is **raycasting**, and R3F
runs it for us.

```
 pointer at (x, y) on the canvas
            │
            ▼
 normalise to [-1, 1] in both axes      ← where in the viewport, camera-independent
            │
            ▼
 camera.setFromCamera(ndc, camera)      ← build a ray: origin at the camera,
            │                              direction through that pixel
            ▼
 raycaster.intersectObjects(interactive) ← test the ray against every mesh that
            │                              has a pointer handler attached
            ▼
 hits, sorted nearest-first             ← each hit carries the object, the
            │                              distance, the point, the face
            ▼
 R3F calls that mesh's onClick / onPointerOver / onPointerOut
```

Three consequences shape the code:

1. **The ray does not stop at the first box it hits.** It passes straight
   through and reports every unit along its path, front to back, and R3F calls
   the handler on each in turn. That is why the click handler starts with
   `event.stopPropagation()` — without it, clicking the front of the building
   would also "click" the units behind it, and the last one to run would win.
   The same applies to `onPointerOver`, or four units would think they were
   hovered at once.
2. **Only meshes with handlers are candidates.** R3F raycasts the objects it
   knows are interactive. `Ground` has no handlers, so it is not in the set —
   which is what makes `onPointerMissed` (below) fire when the user clicks the
   ground or the sky.
3. **The handler receives a normal React-style event object**, extended with the
   3D hit information. `event.clientX` is still there, alongside `event.object`,
   `event.distance` and `event.point`. That matters for the drag test.

### 5.3 The event flow, end to end

```
  user clicks a box in the viewport
            │
            ▼
  R3F raycasts and calls  <mesh onClick>            src/scene/Building.tsx
            │  onUnitClick(unit.id, event)
            ▼
  handleUnitClick                                   src/scene/SceneViewer.tsx
    · event.stopPropagation()  → front-most unit only
    · isClickNotDrag(event)?   → was this a click, or the end of an orbit drag?
            │  onSelectUnit(unitId)
            ▼
  setSelectedUnitId(unitId)                         src/App.tsx   ← React state
            │
            ├──────────────► SceneViewer → Building
            │                 · selected mesh turns amber + emissive
            │                 · a wireframe cage is drawn on its true bounds
            │
            └── findUnitById(units, selectedUnitId)
                       │  selectedUnit: ApartmentUnit | null
                       ▼
                 PropertyInspector                  src/ui/PropertyInspector.tsx
                   ordinary HTML: unit number, floor, type, area,
                   volume, elevation range, 3D bounds, centroid
```

Nothing in that chain reaches sideways. `Building` does not know a panel exists;
it reports *"unit 302 was clicked"* upward and re-reads `selectedUnitId`
downward. `PropertyInspector` does not know a canvas exists; it imports no
Three.js and receives one object. The only thing they share is `App`'s state and
the `units` array — which is the point.

### 5.4 Clicks versus orbit drags

OrbitControls and unit picking share one pointer, and the browser fires a
`click` at the end of a camera drag exactly as it does at the end of a tap. Left
alone, every rotation that happened to begin on a unit would also select it.

The fix is a distance threshold, owned by `SceneViewer` because that is the
component that holds both the meshes and the controls:

```tsx
const DRAG_TOLERANCE_PX = 5

const pointerDownAt = useRef<{ x: number; y: number } | null>(null)   // a ref, not state:
                                                                     // read during events,
                                                                     // must never re-render

const isClickNotDrag = (event: { clientX: number; clientY: number }) => {
  const start = pointerDownAt.current
  if (start === null) return true
  return Math.hypot(event.clientX - start.x, event.clientY - start.y) <= DRAG_TOLERANCE_PX
}
```

`onPointerDown` on the `<Canvas>` records where the press started; the click
handler measures how far the pointer travelled. Five pixels absorbs the tremor
in a real click without letting a deliberate drag through. OrbitControls itself
is untouched — it listens on the canvas element directly, while picking comes
from R3F's raycaster, so the two never compete for a listener, only for the same
gesture, and the threshold is what settles that.

The same test guards `onPointerMissed`, R3F's "the click hit nothing" callback,
which clears the selection when the user clicks the sky or the ground — but not
when they merely finish an orbit over empty space.

Both HTML overlays are `pointer-events: none`, so a drag that passes under the
summary or the inspector still reaches the canvas.

### 5.5 Why the inspector reads the same data the geometry does

This is the design decision the phase turns on.

The tempting shortcut is to give the panel its own description of the selected
unit — a small object assembled at click time, or a lookup in a table of unit
metadata kept alongside the geometry. Both create a **second source of truth**,
and second sources of truth fail in a specific, quiet way: the two descriptions
agree on the day they are written and drift apart afterwards. The scene would
draw a box from 6 m to 9 m while the panel reported 6.5 m to 9.5 m, and nothing
would error — the picture and the record would simply disagree, which for a
*cadastre* is the one failure that matters. A land registry whose map and whose
register disagree is not a registry.

So the app is arranged so the situation cannot arise:

```
DEFAULT_BUILDING_CONFIG
        │  buildApartmentUnits()            ← called once, in App
        ▼
   units: ApartmentUnit[]  ─────────┬──────────────► Building   (positions meshes)
        │                           └──────────────► BuildingSummary
        │                                                 (counts and per-unit figures)
        │  findUnitById(units, selectedUnitId)
        ▼
   selectedUnit  ───────────────────────────────────► PropertyInspector
                                                          (reads its fields)
```

Concretely:

- The units are generated **once**, in `App`, and passed down. Before Phase 5,
  `Building` and `BuildingSummary` each called `buildApartmentUnits` themselves.
  The numbers were never going to disagree — same pure function, same input —
  but the arrays were separate objects, and selection makes object identity
  meaningful. One array is also simply easier to reason about than two that
  happen to match.
- The inspector holds **no geometry state of its own**. Bounds are read
  straight off the unit. The centroid is computed with `getUnitCenter(unit)` —
  the same function `Building` uses to place the mesh, so the point the panel
  names is by construction the point the box is centred on. It is derived in
  both places, stored in neither.
- Property metadata lives on the **same record** as the geometry.
  `propertyType` was added to `ApartmentUnit` and set by the generator, so the
  panel *reads* a unit's use rather than deciding it. When later phases give
  different floors different uses, one generator changes and no UI file does.
- The area and volume shown are the `areaSqM` and `volumeCubicM` computed in
  Phase 4 from the bounds. The panel does no arithmetic beyond formatting.

The general principle, and the reason it is worth the small amount of plumbing:
**a fact is computed once, at the point it is defined, and everything else asks
for it.** `ApartmentUnit` is where a unit is defined. The mesh is a picture of
one; the inspector is a read-out of one; neither is a second copy.

### 5.6 What "selected" looks like

Colour was held in reserve through Phases 3 and 4 for exactly this. The resting
palette is two near-identical slate blues; selection spends the one hue that is
obviously not part of a neutral building palette:

| State | Appearance | Why |
|---|---|---|
| Rest | `#5b7286` / `#4d6376`, no emissive | quiet enough that one highlighted unit is unmissable |
| Hover | resting colour, faint cool emissive (`#22384d`, 0.5) + pointer cursor | an affordance, not an answer — it says "clickable", not "selected" |
| Selected | amber `#d99b3f`, warm emissive (`#6b4310`, 0.55), plus a wireframe cage on the unit's true bounds | a hue change *and* an outline: two channels, so it cannot be confused with hover |

Hover and selection are deliberately different *kinds* of change — hover
brightens, selection changes hue and adds an edge — so hovering a unit while
another is selected can never make the hovered one read as selected. A selected
unit also ignores hover styling entirely.

The cage is a `lineSegments` built from `EdgesGeometry`, drawn at the unit's
**full** bounds rather than the shrunk visual box, so it sits a few centimetres
proud of the mesh and reads as a crisp edge instead of z-fighting.
`EdgesGeometry` keeps only the twelve real edges of the box; a `wireframe`
material would also draw each face's triangulation diagonal, which looks like a
rendering fault rather than a selection.

### 5.7 What Phase 5 deliberately does not do

No ULPIN generation (Phase 6 — the format is decided, the encoder is not
written), no GIS, no topology validation, no ownership-conflict simulation, no
AI, no backend, no basement, no exploded view. The scene, the camera, the
lighting, the ground and the building's dimensions are unchanged; Phase 5 adds
interaction to the model that already existed.

---

## 6. The prototype 3D ULPIN identifier (Phase 6)

> **PROTOTYPE NOTICE.** The identifier described in this section is an **encoding
> scheme invented for this SIH demonstration**. It is **not** the official
> Government of India ULPIN format, it is not derived from any published
> specification, and none of its codes name real land. The contribution being
> demonstrated is the *idea* — that a vertical property can be named by composing
> a land-parcel identity with a position inside the building standing on it — not
> the particular letters chosen to express it. Everywhere the identifier is shown
> to a user it is labelled **"Prototype encoding – demonstration only"**.

Phases 3–5 gave every unit a **shape** (bounds, area, volume, elevation) and a
way to **point at it** (click → selection → inspector). What no unit had was a
**name**. A cadastre is not a collection of boxes; it is a collection of boxes
that can be referred to — in a deed, a tax record, a dispute, an API call.
Phase 6 gives each of the twenty volumes a name that is unique, deterministic,
and readable by a human.

### 6.1 The format

```
KA - BLR - 0482 - 001928 - F03 - U02
│    │     │      │        │     └─ unit index on that floor, 1-based, zero-padded to 2
│    │     │      │        └─────── floor level, 1-based, zero-padded to 2
│    │     │      └──────────────── parent land-parcel number within the zone (6 digits)
│    │     └─────────────────────── spatial / zone code within the city (4 digits)
│    └───────────────────────────── city or district demo code (3 letters)
└────────────────────────────────── state code (2 letters)
```

The first four segments — `KA-BLR-0482-001928` — are the **parent parcel
identifier**: the flat, ground-level, 2D thing that ULPIN-style systems already
name today. The last two segments are the **vertical extension**: where inside
the building standing on that parcel this particular property is.

Read it as a sentence: *"on parcel 001928, in zone 0482 of Bengaluru, Karnataka —
the second property on the third floor."*

### 6.2 The parcel identity structure

`src/ulpin/parcelIdentity.ts`:

```ts
export interface ParcelIdentity {
  readonly stateCode: string    // 'KA'
  readonly cityCode: string     // 'BLR'
  readonly zoneCode: string     // '0482'
  readonly parcelNumber: string // '001928'
}

export const DEMO_PARCEL_IDENTITY: ParcelIdentity = {
  stateCode: 'KA', cityCode: 'BLR', zoneCode: '0482', parcelNumber: '001928',
}
```

Three decisions are embedded here.

**Four fields, not one string.** `'KA-BLR-0482-001928'` as a single constant
would be less code and strictly worse. Each segment means something on its own:
the code lists differ per administrative level, a later map layer will want to
filter by zone, and a validator must be able to check the parcel number's width
without re-splitting text it has just joined. Text is *assembled* from the
fields; the fields are never *parsed back out of* the text.

**Every field is a `string`, never a `number`.** `0482` and `001928` carry
meaningful leading zeros. Stored as numbers they become `482` and `1928`, and
the zeros have to be guessed back at display time. Identifier segments are
codes, not quantities — nothing here is ever added or averaged.

**Parcel identity lives apart from `BuildingConfig`.** The building's
*dimensions* and the parcel's *identity* are unrelated facts that happen to
describe the same site. A building can be redesigned without moving; a parcel
can be renumbered without the building changing. Keeping them in separate
modules means the phase that loads real parcels from a GIS layer replaces one
file and leaves the geometry untouched.

### 6.3 The generator

`src/ulpin/generateUlpin.ts`:

```ts
generatePrototype3DULPIN(parcel: ParcelIdentity, floorLevel: number, unitIndex: number): string
```

Pure: no React, no Three.js, no I/O, no clock, no randomness. The same three
inputs return the same string forever — which is the entire point of an
identifier. Purity is also what lets the self-check execute the real function
in plain Node, with no browser and no test runner.

It does three things:

1. **Validates.** `floorLevel` and `unitIndex` must be 1-based positive
   integers. `0`, `-1`, `2.5` and `NaN` are all upstream bugs, and each would
   otherwise produce a plausible-looking identifier (`F00`, `F-1`, `F2.5`).
   Throwing here reports the error where it was introduced.
2. **Pads.** `String(value).padStart(2, '0')` → `F01`, `F03`, `F12`. Values
   wider than the pad are left intact rather than truncated: a 120-storey tower
   should produce an ugly identifier, never a wrong one.
3. **Joins.** `parentParcelId` + `F<floor>` + `U<index>`, one separator.

### 6.4 Generation flow — and why it happens at the model layer

```
DEMO_PARCEL_IDENTITY ──┐
                       ├──► buildApartmentUnits(config, floors, parcel)
DEFAULT_BUILDING_CONFIG┘             │
                                     │  per floor, per grid cell:
                                     │    bounds  ← geometry maths
                                     │    prototypeUlpin ← generatePrototype3DULPIN(
                                     │                        parcel, floor.level, indexOnFloor)
                                     ▼
                        assertUniqueIdentifiers(...)   ← throws on any duplicate
                                     ▼
                              ApartmentUnit[]  (20 units, each already named)
                                     ▼
                        App ──► SceneViewer / PropertyInspector
```

The identifier is produced **in the same loop iteration that produces the
geometry**, from the same inputs, and is stored on the same record. That is a
deliberate architectural choice, and it is the most important one in this phase:

- **One pass, one truth.** A unit's volume and a unit's name are two facts about
  one property. Computing them together, from one set of inputs, means they
  cannot come to describe different things. Computing the name later, elsewhere,
  from a copy of the inputs, means they can.
- **The view displays data; it does not invent it.** If `PropertyInspector`
  built the string, then the identifier would exist only while that panel was
  open. A GIS export, a URL, a printed record and a second panel would each need
  their own copy of the encoding rule — four places to change, three of them
  easy to forget. Because the unit carries `prototypeUlpin`, every consumer
  reads the same string, and the inspector's job stays what Phase 5 made it:
  render a record it was handed.
- **Validation has somewhere to stand.** Uniqueness can only be checked over the
  *whole set*, and the whole set exists exactly once — at the moment
  `buildApartmentUnits` returns it. A panel sees one unit at a time and could
  never notice a collision.

`ApartmentUnit` gained two fields, both `readonly` like the rest:

| Field | Example | Why on the unit |
|---|---|---|
| `parentParcelId` | `KA-BLR-0482-001928` | "which land is this?" without importing the parcel config |
| `prototypeUlpin` | `KA-BLR-0482-001928-F03-U02` | the unit's name, generated with its geometry |

### 6.5 Apartment number ≠ unit index — the distinction that matters most

These two values are 3 and 2 for the same property and are easy to confuse:

| | `unitNumber` | `indexOnFloor` |
|---|---|---|
| Example | `"302"` | `2` |
| Type | `string` | `number` |
| Means | the label on the door | the unit's ordinal position on its floor |
| Comes from | a human numbering convention | the generation loop |
| Used for | display | the `U` segment of the identifier |

For apartment **302**: floor is **3**, index on floor is **2**, and the
identifier is `KA-BLR-0482-001928-F03-U02`. The `02` in the identifier and the
`02` in the door number look alike here only because the prototype numbers doors
as *floor* + *index*. That is a convention, not a rule. Real buildings label
doors `3A`/`3B`, skip 13, restart per wing or tower, renumber after a
subdivision, and reuse numbers across blocks. Every one of those breaks a parser
that recovers the index from the label — silently, producing a well-formed
identifier for the wrong property.

So the rule enforced in code is: **the identifier is never derived by parsing
the human-readable unit number.** The generator is handed `floor.level` and
`indexOnFloor` as structured numbers that the loop already holds. `unitNumber`
is display text and has no other job.

Phase 6 deliberately **did not** add a parallel `unitIndexWithinFloor` field:
`indexOnFloor` already carries exactly that value, reliably, generated as
`row * unitColumns + column + 1`. Two fields meaning the same thing is the drift
this model avoids everywhere else — the same reason the mesh centre is a
function of the bounds rather than a stored field (§4.3).

### 6.6 Uniqueness — and why it fails loudly

`buildApartmentUnits` calls `assertUniqueIdentifiers` over all twenty generated
identifiers before returning them, and **throws** on any duplicate.

A duplicate would mean two distinct 3D volumes claiming to be the same property
— precisely the ownership ambiguity this project exists to remove. It would also
be **invisible**: each inspector panel would look perfectly correct on its own,
and the demo would show two flats with one name and nobody would notice until a
judge did. A warning would scroll past; a silent skip would hide the cause. A
thrown error at generation time stops the app at the moment the wrong data is
created, which is the only moment the message can point at the cause.

The split is deliberate: `findDuplicateIdentifiers` is a pure function returning
data, so a future import screen can list offending rows next to their input;
`assertUniqueIdentifiers` is the policy that says "for generated units, this is
fatal".

This is a **uniqueness** check and nothing more. Overlapping volumes, gaps
between floors, units that escape their building — the topology validation
engine — is a later phase, and none of it is smuggled in here.

### 6.7 Why zero padding

`F03`, not `F3`. Four reasons, in order of how much they will matter:

1. **Sorting.** As text, `F10` sorts before `F2`. With fixed width, `F02` sorts
   before `F10`, so identifiers sort into building order in any list, database
   index, spreadsheet or filename.
2. **Fixed width.** Every identifier for a given parcel is the same length, so
   segments sit at known offsets, columns line up in a table, and a truncated or
   corrupted string is visible at a glance.
3. **No ambiguity.** `F12` cannot be read as floor 1 unit 2.
4. **Room to grow.** Two digits cover 99 floors and 99 units per floor without
   the format changing shape — and a 100th does not break it, it just widens
   that one identifier.

### 6.8 Self-check without a test runner

The project has no test framework, and adding one is not this phase's job. So
the checks are an ordinary pure function, `checkPrototypeUlpin()` in
`src/ulpin/ulpinSelfCheck.ts`, that returns results and neither logs nor throws.
The day Vitest arrives, its body becomes a test file unchanged.

Two kinds of check:

- **Known-answer cases**, written as literal strings — `F01-U01`, `F03-U02`,
  `F05-U04`. Literals on purpose: an expectation computed the same way as the
  code under test proves nothing. These are the answers a human decided the
  format must give, so any change to padding, prefixes, separator or field order
  breaks them.
- **Uniqueness** across all twenty.

`runPrototypeUlpinSelfCheck()` wraps it, logs failures with `console.error` and
rethrows. `App` calls it inside `if (import.meta.env.DEV)`, which Vite evaluates
at compile time — so the check runs on every dev reload and the entire branch is
removed from the production bundle. It is passed the identifiers **actually
attached to the generated units**, not a freshly generated look-alike set: the
point is to catch a wiring mistake in the model layer, which a self-contained
check would sail straight past.

### 6.9 How this is shown

`PropertyInspector` gained a leading block and one row, and nothing else
changed — the Phase 5 panel absorbed the identifier as data, exactly as
predicted:

```
┌──────────────────────────────────┐
│ ▎PROTOTYPE 3D ULPIN              │  ← accent rule, accent label
│ ▎KA-BLR-0482-001928-F03-U02      │  ← monospace, largest value in the panel
│ ▎Prototype encoding –            │  ← always with the identifier
│ ▎demonstration only              │
├──────────────────────────────────┤
│ Parent parcel   KA-BLR-0482-001928│
│ Unit            302              │
│ Floor           3                │
│ …                                │
```

Prominence is carried by four cheap signals at once — a tinted inset card, a
left accent rule, a larger monospace value, and the only non-muted label in the
panel — rather than by one loud one. Everything below the block *describes* the
property; the block *names* it, and that hierarchy is the point.

The disclaimer text is a shared constant, `PROTOTYPE_ENCODING_NOTE`, not a
string typed into the component, so it cannot appear in one place and be
forgotten in another.

### 6.10 What Phase 6 deliberately does not do

No GIS or map layer *(added in Phase 7 — see §7)*. No topology or overlap
validation. No ownership-conflict
simulation. No AI. No backend, no database, no government API. No basement
levels and no negative floors. No exploded view. No decoder — nothing yet needs
to read an identifier back apart, and a parser written before it has a caller is
a parser written against a guess. All of these are later phases or non-goals;
none of them is worth a partial implementation now.

---

## 7. The GIS parcel map (Phase 7)

### 7.1 What "GIS" means in this prototype

GIS — Geographic Information System — is a large field, and this prototype uses
a deliberately small corner of it. Here, GIS means exactly three things:

1. **Positions on the Earth**, expressed as latitude and longitude in decimal
   degrees.
2. **Shapes made from those positions** — closed rings of coordinates, each
   standing for a real thing on the ground, each carrying attributes (an
   identifier, an area, a name).
3. **A way to draw them over a map of the world**, so a shape can be seen in the
   context of the roads and blocks around it.

That is the whole of it. There is no spatial database, no projection library,
no topology engine, no query language, no analysis. Those are what a production
GIS adds, and every one of them is out of scope for a 48-hour prototype.

The distinction worth holding onto is that **GIS is about the horizontal
world**. It answers *where*, on a two-dimensional surface. Three.js answers
*how high, and what is inside*. The prototype needs both because a vertical
property has a location on the ground **and** a position in the air, and
neither view can express the other's answer. `KA-BLR-0482-001928-F03-U02` is
one property described in two halves: the map draws the first four segments,
the 3D scene draws the last two.

### 7.2 What the parcel polygon represents

The **cadastral parcel** is the legal unit of land — the plot, as a registry
records it. It is the thing that has an owner, a survey number, a tax
assessment and, in India's flat ULPIN scheme, an identifier. The polygon on the
map is that plot's boundary: four corners enclosing roughly 46 m by 34 m, an
area of **1 547 m²**.

Three things about it are worth stating plainly.

**It is a legal line, not a physical one.** There is usually nothing on the
ground at a cadastral boundary — no wall, no paint, no fence that matches it
exactly. That is why it is drawn dashed: a dashed line reads as an abstraction,
which is what it is.

**It is not a rectangle.** The demo boundary is a slightly irregular
quadrilateral on purpose. Real plots follow old field boundaries, road
widenings and the shape of whatever the neighbours agreed to a century ago. A
perfectly square demo parcel quietly teaches the wrong lesson about what
cadastral geometry looks like, and makes the 18 × 14 m footprint inside it look
like a scale model rather than a building on a plot.

**It is invented.** Every coordinate is demo data. `data/demoParcel.ts` says so
in its header, `DEMO_PARCEL_DATA_NOTE` says so in the panel, and no phase of
this prototype calls a cadastral API.

### 7.3 What the building footprint represents

The **footprint** is the outline of the building where it meets the ground —
the shape you would trace by walking around its outside walls, or the shape it
casts on a plan drawing. Here it is **18 m × 14 m = 252 m²**, and it sits inside
the parcel with setbacks on all four sides.

The important property is that this rectangle is **not typed in**. It is
computed from `DEFAULT_BUILDING_CONFIG.width` and `.depth` — the same two
numbers `buildFloorLayouts` and `buildApartmentUnits` generate the 3D geometry
from:

```
DEFAULT_BUILDING_CONFIG { width: 18, depth: 14, ... }
        │
        ├──► buildFloorLayouts / buildApartmentUnits ──► 20 meshes in Three.js
        │
        └──► buildFootprintOutlineM ──► the green rectangle on the map
```

So the map is not showing *a* building, it is showing **this** building. Change
`width` to 22 and both views change together, because there is only one width in
the project. The footprint is the 3D model's shadow, and the code makes that
literal.

The relationship between the two polygons is the ratio a planning authority
cares about: 252 m² of footprint on 1 547 m² of plot is about **16% ground
coverage**. Five floors of it is roughly 1 260 m² of built-up area — which is
exactly the kind of number a 3D cadastre exists to make computable.

### 7.4 Why the geometry is authored in metres, not degrees

Every coordinate in `data/demoParcel.ts` is written as a **local offset in
metres** from one origin point, and converted to latitude/longitude by a single
function. `{ eastM: -23, northM: -17 }`, not `12.935047, 77.624288`.

Three reasons, and each one pays for itself:

1. **It matches the project's unit convention.** The whole model is built on
   *1 unit = 1 metre*. Authoring the map geometry in metres means the 2D
   footprint and the 3D building are stated in the same units, so the 18 × 14
   figure is *reused* rather than re-measured into a second coordinate system.
2. **Area comes out exact.** The shoelace formula over metres gives a true
   square-metre figure. The same formula over raw degrees gives a number in
   degrees-squared that has to be re-projected — and re-projected wrongly at any
   latitude other than the equator, because a degree of longitude is shorter
   than a degree of latitude everywhere else.
3. **A human can review them.** "23 m west and 17 m south of the reference
   point" is a statement someone can check against a plan. Six decimal places of
   latitude is not.

The conversion itself is deliberately small:

```
latitude  = originLat + northM / 111320
longitude = originLng + eastM  / (111320 × cos(originLat))
```

The `cos(latitude)` term is the one that must not be dropped. Meridians converge
towards the poles, so at Bengaluru's ~12.94° N a degree of longitude is about
2.6% shorter than a degree of latitude. Ignoring that stretches every east–west
measurement — on an 18 m building, nearly half a metre, in one direction only,
which is exactly the sort of quiet distortion that makes a footprint sit
visibly askew inside its parcel.

This is a flat-earth approximation and is valid only because the whole parcel
spans under fifty metres. It is **not** a general projection and must not be
reused as one; a real system carries proper CRS handling (EPSG:4326 for storage,
a local UTM zone for measurement). Measured back with a haversine distance, 18 m
east comes out as 17.98 m and 14 m north as 13.98 m — a 0.1% error from using
one mean Earth radius, four orders of magnitude better than this demo needs.

### 7.5 How Leaflet fits into the React application

**What Leaflet is.** A small open-source JavaScript library for interactive
maps. It handles the things a map has to do and nothing else: fetch square
image tiles for the visible area and stitch them into a seamless picture, pan
and zoom, convert between screen pixels and latitude/longitude, and draw vector
shapes — polygons, lines, circles, markers — on top in the right place at every
zoom level. It has no opinion about where data comes from and needs no API key
or account.

**What react-leaflet is.** A thin binding, not a reimplementation. Leaflet is
imperative — you create a map object, call `addLayer`, keep the handle, remove
it later. React is declarative — you describe what should exist and the renderer
works out the calls. react-leaflet closes that gap: `<Polygon positions={…} />`
creates a Leaflet polygon on mount, updates its options when the props change,
and removes it on unmount.

The parallel with the 3D half is exact, and it is why the codebase feels
consistent across two very different libraries:

| | 3D | 2D |
|---|---|---|
| Underlying library | Three.js | Leaflet |
| React binding | `@react-three/fiber` | `react-leaflet` |
| Root component | `<Canvas>` | `<MapContainer>` |
| A drawn thing | `<mesh>` | `<Polygon>` / `<CircleMarker>` |
| Access to the raw object | `useThree()` | `useMap()` |
| Where the data comes from | `unitLayout.ts` | `demoParcel.ts` |

Both are "structured data in, view out". Neither library ever owns the model.

**Three practical points the code makes explicit:**

*The stylesheet is not optional.* `leaflet/dist/leaflet.css` is imported in
`main.tsx`, before `index.css`. Leaflet positions its tiles with CSS; without
that file the map renders as a vertical stack of unpositioned square images and
the controls appear as bare text. It is imported at the entry point rather than
in the component because it is global, and importing it *first* means the
project's own rules win any specificity tie — which is what allows the dark-theme
overrides for Leaflet's controls to work by restyling rather than by `!important`.

*The container must have height.* Leaflet measures its container in pixels once,
at initialisation, and a zero-height container produces a zero-height map with
no warning and no error — the most common way a Leaflet map "does not work".
`.gis-map` therefore gets height from two directions: a `minmax(0, 1fr)` grid
row in the normal layout, and a `min-height: 260px` floor that survives a layout
where that row collapses. A `ResizeObserver` inside `<MapContainer>` calls
`map.invalidateSize()` whenever the container's size changes afterwards, because
Leaflet caches that first measurement and has no way to notice a grid column
getting wider — a stale cache shows as grey wedges where tiles should be and
clicks landing a few pixels off.

*No default marker.* The reference point is a `<CircleMarker>`, not a
`<Marker>`. Leaflet's default marker icon is a PNG referenced by a relative URL,
which breaks under a bundler unless the icon paths are patched by hand. A circle
is a vector: no asset, no patch, no build-configuration footnote.

### 7.6 Why the 2D parcel and the 3D property system share one parcel identity

This is the architectural point of the phase, and it is worth being precise
about what is being claimed.

The naive version of this feature would put `'KA-BLR-0482-001928'` in the map's
data file and be done. It would look identical on screen. It would also be a
**coincidence** — two strings that happen to match today, with nothing stopping
one from being edited tomorrow. The map would then show one parcel and the
inspector would name another, and the application would be quietly, unfalsifiably
wrong: every number on screen would still look plausible.

So instead there is one source, read twice:

```
ulpin/parcelIdentity.ts
  DEMO_PARCEL_IDENTITY { stateCode: 'KA', cityCode: 'BLR', zoneCode: '0482',
                         parcelNumber: '001928' }
        │
        ├──► buildApartmentUnits(config, parcel)
        │      └─► every unit's parentParcelId  ──► PropertyInspector
        │
        └──► buildDemoParcel(identity)
               └─► DEMO_PARCEL.parcelId         ──► GISMap + ParcelInfoPanel
```

Both branches call `formatParentParcelId()` on the same four strings.
`data/demoParcel.ts` does not contain the text `KA-BLR-0482-001928` anywhere —
it imports the identity and formats it. The two panels showing the same
identifier is therefore not a fact to be checked but a consequence of the
structure, and the only way to make them disagree is to give the two calls
different identities on purpose.

**Why the identity and the geometry are still separate modules.** They are
different kinds of fact with different lifetimes. The identity says *which*
parcel — four administrative codes, changed by a re-numbering. The geometry says
*where* — coordinates, changed by a re-survey. Either can change without the
other. Keeping them in one file would mean a boundary correction touches the
module the identifier generator depends on, which is how unrelated things start
breaking each other.

This also sets up what comes next. Right now the connection is a shared string:
the map's `Parent parcel` row and the inspector's `Parent parcel` row read the
same value. The next phase makes it a shared *interaction* — clicking the parcel
selects the building it carries, and the 3D units become addressable from the
2D map — and that only works because both sides already agree on what the parcel
is.

### 7.7 Basemap tiles versus cadastral geometry

The map draws three things and only two of them are ours. Confusing them is the
single most misleading thing this view could do, so the distinction is enforced
in three places at once — in the layer order, in the styling, and in the words.

| | Basemap tiles | Parcel polygon | Building footprint |
|---|---|---|---|
| What it is | Photographs of a rendered world map, cut into squares | The legal plot boundary | The building's ground outline |
| Where it comes from | `tile.openstreetmap.org`, over the network | `data/demoParcel.ts`, in this repo | `DEFAULT_BUILDING_CONFIG`, in this repo |
| Format | Raster (PNG images) | Vector (coordinates) | Vector (coordinates) |
| Authority | None for our purposes — context only | Demo data; represents what a registry would hold | Demo data; represents what a survey would hold |
| Replaceable? | Yes, entirely — swap the URL | No, it *is* the data | No, it *is* the data |
| Zoom behaviour | Blurs past zoom 19 (upscaled) | Stays sharp at any zoom | Stays sharp at any zoom |

**The basemap is scenery.** It exists so a viewer can see that the parcel sits
next to roads and buildings rather than floating in a void. It contributes
nothing to the cadastral record. Point the `TileLayer` at a different provider,
at a local offline tile set, or delete it entirely, and the parcel and footprint
render exactly as before, in exactly the same place, with exactly the same
areas — the application still *works*, it just loses its sense of place. Nothing
downstream reads a pixel of it.

**Everything cadastral is local and deterministic.** No fetch, no key, no
network dependency, identical on every machine and offline. This matters for a
judged demo — a dead conference Wi-Fi connection greys the background and leaves
the actual content intact — and it matters more as a statement about the data
model: the record does not live in someone else's tile server.

**The styling says so too.** A CSS filter desaturates and darkens the tile pane
so it recedes behind the interface. It is scoped to `.leaflet-tile-pane` alone,
so the parcel and footprint — which Leaflet draws in a separate overlay pane —
keep their true colours. The visual result is that the borrowed layer looks
borrowed and our layers look authored, which is exactly the right impression.

**And the attribution is not decoration.** OpenStreetMap's tiles are free to use
under the ODbL, which requires crediting contributors. The `attribution` prop on
`<TileLayer>` puts that credit in the corner of the map, and it is repeated in
the application footer. It is a licence obligation, not a nicety.

### 7.8 Layout: three columns, and why the panels stopped floating

Phases 3–6 put the summary and inspector panels *over* the canvas, absolutely
positioned with `pointer-events: none` so an orbit drag passing beneath them
still reached the 3D scene. That was right while the 3D viewer was the only
content: an overlay costs no layout space, and there was no second view
competing for it.

A second **view** changes the calculus. A map is not an annotation on the 3D
scene; it is a peer of it, and it needs real width, a real height Leaflet can
measure, and its own scroll and pointer behaviour. So `.viewer` became a
three-column grid:

```
┌──────────────────┬───────────────────────────┬───────────────────┐
│  2D parcel map   │   3D property viewer      │ Property          │
│  (336px)         │   (1fr — the largest)     │ inspector (306px) │
│  ┌────────────┐  │                           │                   │
│  │  Leaflet   │  │   ┌───────────────┐       │  Prototype        │
│  │  + legend  │  │   │ building      │       │  3D ULPIN         │
│  └────────────┘  │   │ summary       │       │  …                │
│  Cadastral       │   └───────────────┘       │                   │
│  Parcel record   │   (still an overlay)      │                   │
└──────────────────┴───────────────────────────┴───────────────────┘
      WHERE                    WHAT                     RECORD
```

Read left to right it is the same order a property is described in: where it is,
what it looks like, what the register says about it. The 3D viewer keeps the
largest column because it is still the centre of the demonstration, and the map
is deliberately the narrowest — a 46 m plot needs very little room.

Two details in the CSS are load-bearing rather than cosmetic:

- **`minmax(0, 1fr)`, not `1fr`,** on the 3D column and the map row. A bare
  `1fr` track has an automatic minimum equal to its content's size, and a WebGL
  canvas reports a size — so the column could push the grid wider than the
  window and never shrink back. The explicit `0` minimum removes that floor.
- **`pointer-events: none` is gone from the inspector.** It existed only to let
  orbit drags pass through an overlapping panel. Nothing overlaps the canvas any
  more, and keeping it would have made a tall record impossible to scroll or
  select text in. The building summary keeps it, because it still floats.

Below 1100px the three columns stack and the page is allowed to scroll — the
only place in this application where it does.

### 7.9 What Phase 7 deliberately does not do

No cadastral API and no external data source of any kind beyond the OSM
basemap. No AI extraction of parcels from imagery or documents. No topology
validation — nothing checks that the footprint lies inside the parcel, that
parcels do not overlap, or that a ring is simple and correctly wound. No
2D-to-3D generation: the map does not build the 3D model, and the two are
connected today only by a shared identity, not by a workflow. *(Superseded by
Phase 8 — see §8, which makes the footprint the 3D building's source geometry
and the transformation an explicit user action. Topology validation remains
absent and is Phase 9.)* No backend, no
database, no ownership records, no valuation. No second parcel, and therefore no
parcel selection — `buildDemoParcel()` already takes an identity and a config as
parameters, so a second parcel is a caller change rather than a rewrite, but
nothing yet supplies one. No linked highlighting between the map and the 3D
scene. Each of these is a later phase or a non-goal, and each would be worse as
a partial implementation than as an honest absence.

---

## 8. Footprint-driven geometry: the 2D-to-3D pipeline (Phase 8)

Phases 6 and 7 built two halves that shared an *identity*. Phase 8 makes them
share a *geometry*, and turns the relationship between them into a workflow the
user performs. This is the phase where the prototype stops being two
visualisations of one property and becomes a cadastral transformation.

### 8.1 The duplication Phase 8 removes

Before this phase the building had **two independent horizontal descriptions**:

```
      BuildingConfig.width  = 18
      BuildingConfig.depth  = 14
              │
              ├──► buildApartmentUnits()   ──►  the 3D model
              └──► buildFootprintOutlineM() ──► the polygon on the map
```

They agreed, and Phase 7's notes were right to say so — the map's rectangle was
*derived from* the config rather than typed beside it, which already ruled out
the ordinary way two numbers drift apart. But look at what the arrow means. The
3D building was the primary object, generated from two scalars, and the cadastral
footprint was a **picture of it**. That is backwards for a cadastre: on the
ground, the surveyed outline is the fact and the building is what stands on it.

It is also a description that runs out. "Width and depth" can describe exactly
one shape. The moment a real footprint arrives — an L, a chamfered corner, a
plot boundary that a road widening cut across — the two scalars can no longer
say what the building is, and the map and the model would have to be given
separate geometry that a human keeps in step by hand. That is the failure this
phase forecloses.

### 8.2 The footprint is now the source of truth

The arrow is reversed. A single polygon is authored, and everything horizontal
is measured from it:

```
   DEMO_BUILDING_FOOTPRINT_M          ← four corners, in metres, in data/demoParcel.ts
   (a ring, not a width and a depth)
            │
            ├──► footprintFromEastNorth() ──► buildingFootprintMetric  (x/z metres)
            │            │
            │            ├──► getFootprintMetrics()  width · depth · area · centroid
            │            │            └──► BuildingSummary, ParcelInfoPanel, camera framing
            │            │
            │            ├──► createFootprintPadGeometry()   the plan, drawn on the ground
            │            ├──► createBuildingShellGeometry()  the plan, extruded to 15 m
            │            └──► buildApartmentUnits()          the volume, cut into 20 units
            │
            └──► localPointToGeoPoint() ──► buildingFootprint (lat/lng) ──► the Leaflet polygon
```

`BuildingConfig.width` and `BuildingConfig.depth` **no longer exist**. Nothing
in `scene/` contains the number 18 or the number 14. The demo building is still
18 m × 14 m, but that is now a *measurement of the polygon* (`getFootprintWidth`,
`getFootprintDepth`) rather than an input to the renderer.

The map and the 3D viewer agree because they consume one array. Not "two values
that match" — the same object, converted once at module load and passed down
from `App`. That is checkable rather than asserted: `checkFootprintGeometry()`
asserts `DEMO_PARCEL.buildingFootprintAreaSqM` equals the area the 3D pipeline
measures, and it passes because both are measurements of one ring.

### 8.3 Why latitude and longitude never enter the 3D scene

The map speaks degrees. Three.js cannot.

A degree of latitude is about 111 320 m and a degree of longitude at Bengaluru
is about 108 500 m — and those two figures are **different**, because meridians
converge. Feed raw degrees to a renderer that treats its axes as equal and the
building comes out stretched east-west by 2.6% and shrunk to a speck at the
origin's precision limits. Worse, a scene built in degrees has no scale: "how
tall is 15?" has no answer, and every volume, area and elevation the cadastre
records becomes meaningless.

So the project works in **local metres from a single reference point** —
`DEMO_PARCEL_ORIGIN`, 12.9352° N, 77.6245° E. That origin is the one place the
two coordinate systems are tied together:

```
    lat/lng  ◄── localPointToGeoPoint() ──  local metres  ──► Three.js x/y/z
   (Leaflet)         (one function,         (the model)        (the renderer)
                      one origin)
```

Metres are what a cadastre records, what a person can check ("that corner is 9 m
east of the reference point"), and what makes `1 unit = 1 metre` true rather
than aspirational. The conversion to degrees happens once, at the boundary, for
the map alone. **No file under `scene/` imports `GeoPoint`.**

This is a deliberately local, flat-earth conversion, valid because the plot
spans under fifty metres. It is not a projection and must not be reused as one;
a production system would carry proper CRS handling (EPSG:4326 against a local
UTM zone) instead.

### 8.4 The axis convention, stated once

Two coordinate namings meet, and the mapping between them is fixed in
`geometry/footprint.ts` — in exactly one function, `footprintFromEastNorth()`:

| GIS local metric | Three.js world | Meaning |
|---|---|---|
| `eastM` (+ east) | **X** | east–west |
| `northM` (+ north) | **Z** | north–south |
| — | **Y** | elevation, up |

**East = +X, North = +Z, Up = +Y.**

An honest note about the choice, because it is a choice. Three.js's default
camera looks down −Z, so +Z points *towards the viewer* — on a north-up map that
reads as downwards, and a strict cartographic mapping would use `northM → −Z`.
The demo footprint is a rectangle centred on the origin, so both conventions
produce a **byte-identical ring** and nothing on screen can tell them apart. The
project takes `northM → +Z` because it is the version a reader can hold in their
head, and because it keeps the conversion free of a sign that looks like a bug.
The day the footprint stops being symmetric the choice becomes observable, and
the fix is one line in one function rather than a hunt through the renderers.
Phase 7's note in `buildFootprintOutlineM` said the opposite; that function is
gone, and this table supersedes it.

### 8.5 From a 2D polygon to horizontal 3D geometry

`THREE.Shape` is a 2D path and it lives in the **XY** plane. The footprint lives
in the world's **XZ** plane. So the geometry is built flat and then laid down,
and laying it down is where a sign quietly goes wrong.

Rotating by −90° about X maps shape-local coordinates to world like this:

```
   (xLocal, yLocal, zLocal)  ──rotate −90° about X──►  (xLocal, zLocal, −yLocal)
```

Read the columns: `xLocal` becomes world X (the footprint's x passes straight
through), `zLocal` — the extrusion depth — becomes world **Y**, so the building
rises; and `yLocal` becomes world Z **negated**. That third line is the trap.
Authoring the shape with `y = point.z` would mirror the building north-to-south
relative to the property units, which are built from the footprint's raw `z`. On
a symmetric demo rectangle the mirror is invisible: it would ship, and surface
much later on the first asymmetric plan as a building subtly the wrong way round.

So `createFootprintShape()` authors the path with **`y = −point.z`**, which the
rotation negates back to `+point.z`. One deliberate sign, in one function, with
`FOOTPRINT_FLAT_ROTATION` exported beside it so the two can never be applied
apart. `scene/footprintGeometry.ts` is the only file in the project that imports
both `BuildingFootprint` and `THREE`; everything upstream of it is metres and
arithmetic, everything downstream is meshes.

`ShapeGeometry` triangulates an arbitrary polygon (earcut, internally), so an
L-shaped plan renders correctly through this path with no change. The
rectangular assumption in this project lives in the *unit subdivision*, not in
the drawing of the plan — see §8.8.

### 8.6 Vertical extrusion: how a plan becomes a volume

A cadastral plan plus a height is a volume, and `ExtrudeGeometry` is the
operation that says so:

```
   footprint polygon  ──► THREE.Shape  ──► ExtrudeGeometry(depth = 15 m)  ──► the envelope
```

`bevelEnabled: false`, because a bevel would round the walls by a few
centimetres and quietly falsify the geometry. `steps: 1`, because a uniform
extrusion needs no intermediate rings — the floor divisions are *property
boundaries*, not mesh subdivisions.

The shell is the **envelope**: the volume the building occupies, before anyone
asks who owns which part of it. The prototype draws it translucent in the source
state, then hands over to the twenty property units as the generation completes.
That handover is the clearest available explanation of what a 3D cadastre is —
the same plan, carried upward, then cut into ownable pieces:

```
   plan  ─────────►  volume  ─────────►  properties
   FootprintPad      BuildingShell       Building (20 units)
   (ShapeGeometry)   (ExtrudeGeometry)   (one BoxGeometry per unit)
```

The shell and the units are not drawn solidly at the same time. The units fill
exactly the shell's volume, so both would z-fight and every apartment would sit
inside an opaque box. The shell fades out as the units fade in; it is a *stage*
in the transformation, not a permanent part of the model.

### 8.7 Why floor height stays in `BuildingConfig`

The footprint is the horizontal truth. It is emphatically **not** the vertical
truth, and collapsing the two would be the wrong simplification.

`numberOfFloors` and `floorHeight` are not measured from the ground. No survey
of the plot reveals them. They come from the building's design and its
approvals — a plan sanction says five floors at three metres. A cadastral
footprint, by contrast, *is* a survey product. Two kinds of fact, from two
sources, with two lifetimes: a re-survey moves the footprint without touching a
floor, and a revised sanction adds a storey without moving one corner.

So they are two modules and two parameters:

```
   buildApartmentUnits(config, footprint)
                        │       └── where the walls stand   (surveyed)
                        └────────── how high, how many, how cut  (designed)
```

`unitColumns` / `unitRows` stay with the config for the same reason: how a floor
is partitioned into saleable properties is a decision about the building, not a
measurement of the land.

### 8.8 The 2 × 2 subdivision is still a prototype limitation

Phase 8 makes the *building* footprint-driven. It does **not** make the internal
subdivision polygon-aware, and it is worth being exact about where the line
falls.

`buildUnitsForFloor()` now lays its grid over the footprint's **bounding box**:

```
   unitWidth = (bounds.xMax − bounds.xMin) / unitColumns      (18 / 2 = 9 m)
   unitDepth = (bounds.zMax − bounds.zMin) / unitRows         (14 / 2 = 7 m)

   xMin = bounds.xMin + column × unitWidth
   zMin = bounds.zMin + row    × unitDepth
```

For an axis-aligned rectangle the bounding box and the polygon are the same
shape, so the subdivision is exact — and because the demo footprint is centred
on the origin, `bounds.xMin` *is* `−width / 2` and the twenty units come out at
precisely the coordinates Phases 4–7 produced. That is the intended outcome: the
architecture changed and the geometry did not, and a demo whose numbers shifted
would make the two impossible to tell apart.

For an L-shaped or chamfered plan they are not the same shape. The grid would
lay units over ground the building does not occupy, and the corner cells would
claim area that does not exist. Genuine subdivision of an arbitrary polygon
needs a partitioning pass — a trapezoidal or monotone decomposition, then an
allocation of the pieces to properties — and it is deliberately not in this
phase.

What *is* here is the honesty. `isAxisAlignedRectangle()` can answer the
question; `App` asks it in development and warns when the answer is no; the
building summary states the assumption in the interface. A checked assumption is
a known limitation. An unchecked one is a bug waiting for its first irregular
input.

### 8.9 The generation workflow, and why there is a button

Everything the "Generate 3D Cadastre" button does could happen at page load. The
units are pure data and cost nothing to build — indeed `App` builds them
eagerly, before anything is pressed, so the action is a reveal rather than a
spinner.

The button exists because the *point* of Phase 8 is that a 2D cadastral record
can be **transformed** into a 3D one, and a transformation nobody performs is
indistinguishable from two pictures drawn side by side. Making the user press it
turns a claim into a demonstration:

| State | The viewer shows | The pipeline says |
|---|---|---|
| **Source** | ground · footprint polygon · translucent extruded envelope | 2 of 5 complete |
| **Generated** | ground · footprint polygon · 20 selectable property units | 5 of 5 complete |

It also keeps the interface honest about what the prototype is. Showing the
building fully formed on arrival would quietly suggest the 3D model is itself
source data — the exact misunderstanding this phase exists to dispel.

`isGenerated` is the single piece of workflow state, and it lives in `App`
beside `selectedUnitId` for the same reason: `App` is the nearest component
containing every reader. Resetting clears the selection in the same action,
because a selected unit that is no longer rendered would leave the inspector
describing a property that is not on screen.

The transition is a 620 ms eased ramp from `useFadeProgress` — plain
`requestAnimationFrame`, no animation library, and `prefers-reduced-motion`
jumps straight to the end. It is the only animation machinery in the project.
Note that the units' materials are marked `transparent` **only while the ramp is
running**; once it settles the rendering is byte-for-byte what Phases 4–7
produced, so the settled model pays nothing for the effect.

### 8.10 The pipeline status is derived, not tracked

The five-step list is computed by `workflow/pipelineSteps.ts` from the model:

```
   Parcel Loaded             ← always complete: source data
   Footprint Loaded          ← always complete: source data
   3D Structure Generated    ┐
   Vertical Units Created    ├── complete together, on generation
   Prototype ULPIN Assigned  ┘
```

The last three complete together because they are three consequences of one
action: `buildApartmentUnits` extrudes nothing by itself, but a single pass
through it cuts the volume into units and names each one. Staging them as three
separately-timed ticks would be a nicer animation and a false account of what
the code does.

Each step carries a *figure* rather than a bare tick — the parcel id, the ring's
vertex count and area, the floor count and height, the unit and identifier
counts. A tick shows that a flag was set; a figure shows that the step actually
ran.

`buildPipelineSteps()` is a pure function returning data, so the view renders
what it is given and decides nothing. It cannot report a step complete that the
model says is pending.

**There is no validation step.** Nothing here asks whether the footprint lies
inside the parcel, whether the rings are simple, or whether two units overlap.
That is Phase 9's topology engine, and a "Validated" row lighting up with no
validator behind it would be the one dishonest thing in the interface.

### 8.11 One measurement, read everywhere

`App` calls `getFootprintMetrics()` once and passes the result down. The
building summary, the parcel info panel, the pipeline and the camera framing all
read that object. Nothing re-measures.

This matters more than it looks. Four components each computing "the width of
the footprint" is four opportunities to compute it slightly differently — one
takes the bounding box, one takes the distance between the first two vertices,
one rounds early — and the disagreement surfaces as a panel that says 18 m
beside a model that is 17.9 m wide. Measuring once removes the possibility
rather than managing it.

The same reasoning removed the last hard-coded horizontal constants from the
renderer. `SceneViewer`'s shadow-camera extent was `±30 m`, correct for an
18 × 14 m plan and silently wrong for any other; the camera position was
`[26, 18, 30]`, hand-tuned to the same building. Both are now derived from the
footprint's own extent, with multipliers chosen to reproduce the previous view
for the demo.

The shoelace area formula went the same way. It existed in `demoParcel.ts` over
`eastM`/`northM` and would have needed a second copy over `x`/`z` for the 3D
side. There is now one implementation, in `geometry/footprint.ts`;
`polygonAreaSqM()` is a thin adapter onto it.

### 8.12 Verification without a test runner

`geometry/footprintSelfCheck.ts` follows the pattern Phase 6 established: a pure
function returning `CheckResult[]`, plus a dev-only runner that logs failures
and rethrows. `App` runs it under `import.meta.env.DEV`, which is a compile-time
constant, so the whole branch leaves the production bundle.

The expectations are **literals** — 18, 14, 252, 0, 15, 20, 63, 189 — because a
value recomputed the same way as the code under test agrees with any bug that
code contains. They are the numbers Phases 3–7 produced, pinned so that a
refactor which quietly moved the geometry fails instead of looking like a
success.

Note what the checks cover beyond the individual figures: that the ground
floor's units *tile* the footprint exactly (252 m², no gap and no overlap), that
no unit extends beyond the footprint bounds, and that the area the map reports
equals the area the 3D pipeline measures. Per-unit areas alone would not catch a
subdivision reading the wrong extent.

### 8.13 What Phase 8 deliberately does not do

No topology validation engine — nothing checks that the footprint lies inside
the parcel, that rings are simple or consistently wound, or that units do not
overlap. No ownership conflict simulation. No AI extraction of footprints from
imagery or documents. No basement or below-ground volumes; `y = 0` is still the
floor of the model. No version history and no edit workflow — the footprint is a
constant, not a document. No standards export (CityGML, IFC, LandInfra). No
backend, no database, no cadastral API. No polygon triangulation beyond what
`ShapeGeometry` does for the current demo footprint, and no subdivision of an
irregular plan. No second parcel and no parcel selection.

Each of these is a later phase or a non-goal, and each would be worse as a
partial implementation than as an honest absence. Phase 9 is the topology
validation engine, which only became meaningful once geometry could be supplied
from data rather than declared in a config.

---

## 9. Presentation: the animated 2D→3D generation (Phase 9)

Phase 8 made the 3D building a *consequence* of the 2D footprint. Phase 9 makes
that consequence **visible as it happens**, and adds the controls a person needs
to present it: an animated generation sequence, an exploded view, camera presets
and a small number of 3D labels.

Nothing about the model changed. No new dependency was added. The whole phase is
presentation, and it is worth being precise about what that means: the twenty
property units, their bounds, their areas and their identifiers are byte-for-byte
what Phase 8 produced. What changed is *when they are drawn and where they are
drawn*.

### 9.1 The problem the phase solves

Phase 8's viewer had two states and a fade between them. Two things were wrong
with it, and both cost the demonstration its point.

**The pre-generation state was already three-dimensional.** It showed the
footprint extruded to 15 m as a translucent box. That is a preview of the answer,
shown before the question is asked. A viewer who sees a 3D volume on arrival has
no reason to think the button that follows *creates* anything — it looks like it
turns on a colour scheme. Worse, it quietly implied that the 3D form was itself
source data, which is the exact misunderstanding this project exists to dispel: a
cadastral record today holds a plan and a height, not a volume.

**The transition was a 620 ms crossfade.** A crossfade shows two states. It does
not show a *transformation*, and "a 2D cadastral record can be transformed into a
3D one" is the claim the prototype is making.

So: the source state is now purely 2D — flat geometry only, nothing above the
ground plane — and the transition is a staged, two-second build that a person can
narrate while it runs.

### 9.2 One number drives everything

The central design decision of the phase, and the one that everything else falls
out of:

> **Every timing decision in the application is a pure function of a single
> progress value between 0 and 1.**

```
  isGenerated ──► useFadeProgress ──► generationProgress   (0 → 1, linear, rAF)
                                              │
                                              ▼
                             getGenerationVisuals(progress, floorCount)
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                      footprintPulse   shellHeightFraction  floorReveal[]
                      footprintEmphasis  shellPresence      unitReveal[]
                              │               │            unitsInteractive
                              ▼               ▼               stage
                        FootprintPad   BuildingShell    FloorSlabs, Building,
                                                        PipelineStatus,
                                                        GenerationStatus
```

The obvious alternative — a sequence of timed `setState` calls, "after 300 ms
show the shell, after 900 ms show the floors" — was rejected. Timers produce
state that can be *inconsistent with itself*: a timer that fires after a reset, a
stage that advances while an earlier one is still running, a component that
re-mounts and no longer knows which timers already ran. Every one of those
manifests as the exact defect the brief rules out: janky re-mount flicker.

Deriving everything from one number removes the possibility structurally. The
scene at progress 0.63 is the same scene whether it was reached smoothly, after
a dropped frame, or by a reset and a second run. **Determinism here is a property
of the architecture, not something to be careful about.**

It also means the whole sequence is testable without a renderer, which is what
`animation/generationSelfCheck.ts` does — see §9.8.

### 9.3 The sequence

`animation/generationTimeline.ts` declares four overlapping windows on the
master progress run. `GENERATION_DURATION_MS = 2200`.

```
  0.00 ┬─ highlight ──┐                    the source footprint pulses:
       │              │                    "this is what we start from"
  0.12 ┼──────── rise ────────┐            the envelope grows out of the
       │                      │            footprint, 0 m → 15 m
  0.46 ┼──────────── floors ──────────┐    floor plates appear, bottom-up
       │                              │
  0.70 ┼──────────────── units ───────────┐  each floor's property units grow
       │                                  │  into place, bottom-up, as the
  1.00 ┴──────────────────────────────────┘  envelope hands over
```

The windows **overlap on purpose**. Strictly sequential stages read as four
animations played back to back; a few percent of overlap reads as one continuous
build — which is what a building going up actually looks like. The overlap is
small enough that the order is never in doubt.

2.2 s is chosen inside the brief's 1.5–3 s range for a concrete reason: with five
floors it gives each floor roughly 150 ms of its own, which is long enough to
read as a stagger and short enough that nobody waits. A twelve-storey building
would animate as twelve steps with no change to any code — the stagger is
computed from `floorCount`.

Sampled output at eleven points (the actual values, printed from the module):

| p | shell height | shell presence | floor reveal | unit reveal | stage |
|---|---|---|---|---|---|
| 0.00 | 0.00 | 0.00 | 0 0 0 0 0 | 0 0 0 0 0 | source |
| 0.16 | 0.26 | 0.40 | 0 0 0 0 0 | 0 0 0 0 0 | structure |
| 0.30 | 0.81 | 1.00 | 0 0 0 0 0 | 0 0 0 0 0 | structure |
| 0.55 | 1.00 | 1.00 | .99 .65 0 0 0 | 0 0 0 0 0 | floors |
| 0.65 | 1.00 | 1.00 | 1 1 .97 .44 0 | 0 0 0 0 0 | floors |
| 0.75 | 1.00 | 0.77 | 1 1 1 1 .91 | .50 0 0 0 0 | units |
| 0.85 | 1.00 | 0.32 | 1 1 1 1 1 | 1 1 .50 0 0 | units |
| 1.00 | 1.00 | 0.00 | 1 1 1 1 1 | 1 1 1 1 1 | ready |

### 9.4 What each stage is, mechanically

**The pulse.** `FootprintPad` brightens and returns, shaped as half a sine wave.
A pulse rather than a step because the footprint has to end up back where it
started — it is being *pointed at*, not changed.

**The rise is the extrusion, animated.** `BuildingShell` builds its
`ExtrudeGeometry` once, at full height, and is drawn at
`scale={[1, 1, heightFraction]}` inside the group that already carries
`FOOTPRINT_FLAT_ROTATION`. That rotation maps shape-local Z — the extrusion axis
— onto world Y, so a local Z scale *is* a world height scale, and the extrusion's
own base at local `z = 0` keeps the building standing on the ground rather than
shrinking toward its middle.

Rebuilding the geometry each frame would have been the naïve implementation, and
it would have put a re-triangulation of the plan plus a GPU buffer allocation
inside the render loop, sixty times a second. Scaling costs one matrix. The scale
and the rotation must stay on the same element: separated, the building would
silently scale along north–south instead of upward.

**The floor plates are new geometry.** `createFloorSlabGeometry()` is the same
extrusion operation as the shell with a different depth — a floor plate and a
building envelope are both "this plan, carried upward by some distance", and
writing them as two calls to one function is the honest account of that. Each
plate is 12 cm thick and sits *on* a floor's `baseY`, occupying the boundary
between two floors rather than the space inside one, so it never intersects a
unit. (Phase 3 had full-height floor slabs and Phase 4 deleted them precisely
because they did.)

They earn their place twice: in the animation they are the middle term between
"this plan has a height" and "each level holds four properties" — the
*stratification*, which is the actual subject of a vertical cadastre, shown on
its own. And in the exploded view they are what the eye follows: four floating
boxes read as four boxes; four boxes on a plate read as a floor.

**The units grow out of their own floors.** Each unit mesh is scaled on Y by its
floor's reveal, with its centre placed so the *base* stays pinned to the unit's
own `yMin`:

```
centerY = yMin + gap/2 + (height − gap) × reveal / 2
```

At reveal 1 this reduces exactly to the true centre. Growth upward from the floor
reads as construction; scaling about the middle reads as a dissolve.

### 9.5 Exploded view is a visualisation transform

Floor 3 of the demo building occupies 6 m to 9 m above ground. In exploded view
it is *drawn* several metres higher. **It still occupies 6 m to 9 m.** The
property inspector still says 6–9 m, the prototype ULPIN is unchanged, and any
future export is unchanged.

`scene/explodedView.ts` is one pure function:

```
offset(floorIndex, amount) = floorIndex × EXPLODED_FLOOR_GAP_M × amount
```

The ground floor never moves, so the stack separates upward from its own base and
stays standing on the footprint that generated it. The offset is added at render
time in exactly three places — the unit meshes, the floor plates, the selection
cage — and one more for the labels. Nothing reads it back.

That separation is the design, not an implementation detail. `yMin` / `yMax` are
cadastral facts: they say which slice of space a person owns. If exploding the
view edited them, the interface would be answering "how high is this property"
with a number that depends on a display toggle — which is the class of bug that
makes a spatial register untrustworthy.

Three components need the same offset for the same floor and must agree exactly,
or the selection cage floats away from the box it highlights. One function
imported three times is the only arrangement in which they cannot disagree.

Exploded view is gated on the generation having **settled**, not merely having
been requested: running two transforms on the same meshes at once would leave
neither animation readable.

### 9.6 Camera presets

`scene/cameraPresets.ts` computes four named viewpoints — Parcel, Building, Top,
Selected Unit — as pure arithmetic on tuples, with no `three` import at all.
Every position is a multiple of the building's own extent, exactly as Phase 8
derived the default framing; nothing in the file contains an 18, a 14 or a 15.
The `building` preset reproduces the historic `[26.1, 18, 29.7]` to the
centimetre, which is verified in the self-check.

`scene/CameraRig.tsx` is the only file that turns a view into motion. It holds
**no state at all** — its entire working memory is refs — so a camera flight
causes zero re-renders of the scene graph while it is in progress. It interpolates
position and orbit target with `EASE_IN_OUT_CUBIC` over `CAMERA_FLIGHT_MS = 850`.

Three details matter:

**It owns the orbit target.** Phase 8 passed `target` to `<OrbitControls>` as a
prop. That cannot coexist with an animated target — React re-applies the
declarative prop on each render and yanks the target back mid-flight. The prop is
gone; the rig sets `controls.target` once on mount and thereafter only during a
flight.

**`controls.enabled = false` for the duration.** Without it, a user who nudges the
mouse mid-flight has two things writing to the camera on the same frame, which
reads as a stutter. Disabling for 850 ms is invisible in use — the camera is
already moving — and it guarantees the hand-off back to free orbit happens at a
well-defined moment, from a known position. **That is what "preserve OrbitControls
after the motion" means in practice.**

**Requests are tokens, not values.** A preset can be pressed twice and must
re-frame both times; comparing views would swallow the second press. The request
carries a monotonically increasing token, the rig acts when the token changes, and
nothing has to clear the request afterwards. The counter is a `useRef`, not state:
incrementing it from inside a state updater would be double-invoked by React's
StrictMode in development and produce two tokens for one click.

`getPresetView` is *total* — `unit` with nothing selected falls back to the
building view — so no caller has to handle a `null` view. The button is disabled
as well, but a function that could return nothing would push that decision
everywhere.

### 9.7 Labels, and the restraint rule

A vertical cadastre with twenty units has twenty things that *could* be labelled,
five floors that could be labelled, and a footprint that could be dimensioned.
Doing any of that produces a scene where floating text is the dominant visual
element and the geometry is what the eye has to hunt for.

Labels appear in exactly two situations:

- **Floor labels (F1…F5) only in exploded view.** That is the one moment the
  strata are separated and unlabelled. Stacked, the floors are obviously in order
  and the labels would be noise.
- **The selected unit's number, only for the selected unit.** It answers "which
  box did I just click" at the moment the inspector fills in on the other side of
  the screen; the two together tie a record to a volume.

Nothing else is labelled — not hovered units, not unselected units, not the axes.
They use drei's `<Html>` rather than 3D text so they inherit the interface's
typography and stay crisp at every zoom, and they are `pointer-events: none`
throughout so a label can never swallow a click meant for the unit beneath it.
No labels are drawn at all until the building has settled: labels on a building
that is still assembling itself would name things before they exist.

### 9.8 Selection, reset, and what the transition guarantees

**Selection becomes available only when `progress >= 1`** — settled, not merely
requested. A click on a half-grown box would open a record for a property the
animation has not finished drawing: correct data, wrong moment, and
indistinguishable from a bug to anyone watching. The gate lives in
`GenerationVisuals.unitsInteractive`, is enforced in the viewer's click handler,
and hover is suppressed by the same flag.

Once settled, **everything Phases 4–8 built works exactly as before**: twenty
units, click to select, amber highlight plus the edge cage, the property
inspector, the prototype ULPIN, the building summary, the GIS map, the pipeline
card. The transition is the only thing that is new; the destination is unchanged.

**Reset undoes all of it in one action** — `handleReset` clears the generation
flag, the selection, the exploded mode, and returns the camera to the opening
view. Doing all four in one place rather than guarding each where it is read is
what makes reset feel clean in a live demo: one press, one known state, no
residue from the previous run. The progress ramp *snaps* back to 0 rather than
animating in reverse (`reverseDurationMs: 0`), because un-building a building is
not a thing a cadastre does and a presenter wants to start again immediately.

### 9.9 Why no animation library

The brief allowed React Spring or Framer Motion "only if truly needed". They were
not. What Phase 9 needs is a *timing* function: given one number between 0 and 1,
decide how far along each part of a sequence is. That is arithmetic —
`animation/easing.ts` is about eighty lines including its comments — not a
state-machine or spring-physics problem.

An animation library would have brought a runtime, a second reconciliation model
and a second place animation state can live, in exchange for functions that fit
on one screen. It would also have been the wrong shape: the values being animated
here are mesh scales and material opacities inside a WebGL scene, not DOM styles.

The one driver is `ui/useFadeProgress.ts` — a `requestAnimationFrame` ramp that
follows a boolean. `useFrame` was not used for it because the same value drives
HTML (the status line, the progress bar, the pipeline card) as well as meshes, so
it is owned above both; and plain rAF keeps the hook free of any Three.js import.
Both directions honour `prefers-reduced-motion` by jumping to the target.

**Phase 9 added no dependencies.**

### 9.10 Workflow feedback

Three surfaces report the same underlying state, at three levels of detail:

| Surface | Before | During | After |
|---|---|---|---|
| `GenerateCadastreControl` | footprint area, primary action | disabled, "Generating…" | outcome + Reset |
| `GenerationStatus` | absent | stage name + determinate bar | absent |
| `PipelineStatus` | 2/5, three pending | steps become `active` | 5/5 |

The pipeline gained a third step state, `active`, because a binary list had to
choose between lying early (all five complete the moment the button is pressed)
and lying late (nothing changes for two seconds while the scene visibly builds).
The mapping from animation stage to step is deliberately **coarse**: the units and
the identifiers move together because they *are* produced together — one pass
through `buildApartmentUnits` generates a unit's bounds and its prototype ULPIN in
the same loop iteration. Animating them as two separately-timed steps would be a
nicer list and a false account of the code.

`countCompletedSteps` deliberately does not count `active` steps: a step under way
has not produced anything, and a counter that rounded up would be the interface
claiming a result it does not have.

The `active` marker differs from `complete` and `pending` in *shape* as well as
colour — a ring with a filled core, against a solid disc and an empty ring —
because a demo projector may flatten all three colours to the same grey.

There is still **no validation step**. Nothing asks whether the footprint lies
inside the parcel or whether two units overlap. That is Phase 10's topology
engine, and a "Validated" row that lit up without a validator behind it would be
the one dishonest thing in the interface.

### 9.11 What is verified, and what is not

`animation/generationSelfCheck.ts` follows the pattern established in Phase 6 and
followed in Phase 8: a pure function returning `CheckResult[]`, plus a dev-only
runner that throws on failure. It exists because an animation is the hardest kind
of code to be sure about by looking at it — the thing that is wrong is usually a
*moment* rather than a line.

Because the sequence is a pure function of one number, it can be **sampled**. The
check walks the timeline in 200 steps and asserts:

- **The endpoints are exact.** At 0: no envelope, no plates, no units, selection
  off. At 1: everything at exactly 1, selection on. Not "close to" — a 0.997
  opacity is a permanently transparent building.
- **Nothing ever goes backwards.** Every reveal is monotonic. A value that dips is
  a flicker.
- **The wave travels upward.** Floor *i* is always at least as far along as floor
  *i+1*, at every sample.
- **The envelope hands over.** Absent at both ends, present only in between.
- **Out-of-range input clamps.** Progress 1.4 gives the settled state, not a
  building at 140 % height.
- **Exploded view does not alter the record** — asserted against the model: unit
  301 is still 6–9 m.
- **Camera presets are finite, the top view is above the building, and the unit
  view falls back to the building view.**

All 30 checks pass, and Phase 8's 17 footprint checks still pass unchanged.

What is **not** verified in the sandbox: the npm registry is unreachable there, so
`react`, `three`, `@react-three/*` and `react-leaflet` cannot be installed. The
whole source tree — every `.tsx` file included — was typechecked under
`--strict --noUnusedLocals --noUnusedParameters` against minimal hand-written
stubs for those packages, which catches the project's own wiring (prop types,
hook usage, typos, unused imports) but **not** whether a drei or R3F prop name is
correct. `npm run build` on the host remains the only real gate.

---

## 10. Ownership visualisation, validation and simulation (Phase 10)

Phase 9 made the *generation* of a 3D cadastre legible. Phase 10 is about the
record it produces: showing what is actually owned, checking that the record is
spatially possible, and demonstrating what happens when it is not.

It runs as five subphases — A full ownership explosion, B floor isolation,
C topology validation, D conflict simulation, E ownership presentation — each
source-complete on its own so the work is recoverable if it stops midway.

### 10.0 THE ARCHITECTURAL RULE THIS PHASE IS BUILT ON

Everything below depends on keeping three things separate, and the separation is
the most important design decision in the project:

```
  A. CANONICAL CADASTRAL GEOMETRY          the record
     ApartmentUnit[] from buildApartmentUnits()
     six bounds, area, volume, prototype ULPIN
     built once, never written to by anything
                 │
                 ▼
  C. SIMULATION OVERRIDE                   a hypothetical
     a pure function: canonical units → display units
     off by default; produces a NEW array, never edits the old one
     what the validation engine is pointed at
                 │
                 ▼
  B. VISUALISATION TRANSFORM               a way of drawing
     exploded offsets, floor isolation, camera, fades
     applied at render time only; produces no data
     never read back by anything
```

**Subphase F added a fourth, and it is genuinely a fourth rather than a variant
of B:**

```
  D. PRESENTATION GEOMETRY                 evidence about the record
     the canonical ghost, the displacement arrow,
     the intersection volume
     DERIVED from A and C (and from the engine's finding)
     drawn, labelled, and read by nothing else
     never clickable, never validated, never counted
```

B *moves things that exist*; D *adds things that do not*. The ghost is not a
property, the arrow is not a boundary, and the intersection volume is owned by
nobody — it is precisely the region whose ownership is the question. Calling
those a visualisation transform would be a category error with a practical
consequence: a transform is something the renderer may apply to any unit, and
these three must never end up in the array a unit iteration walks. They live in
`simulation/conflictPresentation.ts` (derivation) and `scene/ConflictOverlay.tsx`
(drawing), outside `<Building>` entirely, and every mesh among them carries
`raycast={() => null}`.

The direction of dependency is one-way and worth stating: A and C are inputs to
D, and D's output reaches the renderer and the conflict panel and nothing else.
Nothing in `validation/`, `scene/unitLayout.ts` or `simulation/conflictSimulation.ts`
imports the presentation module, and nothing should.

The rule, stated once so it can be quoted:

> **The cadastral record must never inherit a coordinate that came from a
> visualisation transform, and the validation engine must never be shown one.**

Why it matters more than it sounds. Every one of these is a *coordinate in
metres*, and they are trivially confusable: an exploded floor is drawn at
`baseY + 6.4`, a simulated conflict genuinely moves a unit's `xMin`, and the real
record says neither. If the exploded offset ever leaked into the model, the
property inspector would answer "how high is this property" with a number that
depends on a display toggle. If the validator were pointed at exploded
coordinates, it would report twenty conflicts in a valid building and none in an
invalid one, because separating things on screen is exactly what makes overlaps
disappear.

How the code enforces it rather than merely intending it:

- **A is produced once and is `readonly` throughout.** `ApartmentUnit`'s every
  field is `readonly`; `buildApartmentUnits` returns a fresh array and nothing
  mutates it afterwards.
- **B produces offsets, not positions.** `explodedView.ts` exports functions that
  return numbers to *add* to a mesh position. It has no way to write anything: it
  takes a unit and returns a triple. `explodedSelfCheck.ts` snapshots the units,
  runs every offset function over them at full explosion, and asserts they are
  byte-identical afterwards — so the property is *checked*, not assumed.
- **C is a pure `canonical → display` function.** It returns a new array with one
  or two entries replaced. The canonical array is still there, unchanged, and
  "Restore Valid Geometry" is simply the app pointing at it again — not an
  undo, not an inverse edit.
- **The validation engine takes the display units** (A, or C-over-A) **and never
  the transform.** It has no import path to `explodedView.ts` at all, which is
  the strongest form of "cannot": not a rule someone must remember, a module
  graph in which the mistake is unavailable.

### 10.1 Subphase A — full ownership exploded view

Phase 9's exploded view separated floors. That showed

```
    parcel  →  floor layers
```

and stopped one level short of the thing the project is about. A vertical
cadastre's claim is not that a building has five levels — every building has
levels — it is that **each level is divided into separately owned volumes, each
with its own identifier**. Subphase A carries the picture to the end:

```
    parcel  →  floor layers  →  individual ownership volumes
```

Three ordered levels, exposed as a segmented control beside the camera presets:

| Level | What separates |
|---|---|
| `Stacked` | nothing — the building as built |
| `Floors` | floors lift apart vertically |
| `Units` | floors stay lifted **and** each floor's units slide outward |

One `ExplodeMode` value rather than two booleans, because the levels are ordered:
units cannot disperse from a floor that has not been lifted clear, so
"units apart, floors together" is a state the interface should not be able to
reach.

#### The horizontal direction is derived, not tabulated

The obvious implementation is a lookup — 301 north-west, 302 north-east, and so
on. It would work today and be wrong in principle, because *the direction a unit
moves is a fact about where that unit sits on its floor*, so it should be
computed from where that unit sits on its floor:

```
  floorCentre = centre of the bounding box of that floor's units
  direction   = normalise(unitPlanCentre − floorCentre)
  offset      = direction × EXPLODED_UNIT_DISTANCE_M × amount
```

Change the grid from 2 × 2 to 3 × 4 and this keeps working with no edit. The
middle unit of a 3 × 3 grid sits *on* its floor's centre, has no direction, and
correctly does not move — that is the right answer, not a special case being
papered over. (It is also the one case that would divide by zero, so it is
handled explicitly and checked.)

**Normalised rather than scaled.** Multiplying the raw offset vector — a "scale
about the centre" — would push far-out units further than near ones, so a wide
floor would fly apart while a narrow one barely opened. Normalising gives every
unit the same displacement, which reads as *the same operation applied to each
property*, which is what it is.

The floor centre comes from the **bounding box** of that floor's units rather
than the mean of their centres, so a floor with unevenly sized units still
explodes about the middle of the floor rather than about wherever the small units
pull the average. For the prototype's uniform grid the two agree exactly.

#### One offset function, four callers

`getUnitDisplayOffsetM(unit, floorCentre, amounts)` returns the complete
`[x, y, z]` display offset for one property. Four things need that exact value —

- the unit's own mesh (`Building.tsx`),
- its selection cage (`SelectionOutline`),
- its floating label (`SceneLabels.tsx`),
- the "Selected Unit" camera preset (`cameraPresets.ts`),

— and they must agree to the millimetre, or the highlight floats away from the
box it highlights and the camera flies to where the property used to be. One
function called four times is the only arrangement in which they cannot disagree.
Floor plates use the sibling `getFloorDisplayOffsetM`, which returns only the
vertical component: a floor plate *is* the floor, so there is nothing on it to
move apart, and its staying whole is exactly what makes the unit explosion
legible — the properties leave, and the layer they belong to stays put.

#### Two ramps, both directions

`explodeAmounts` is `{ floors, units }`: two independent eased values, because
both are animated and during a transition they genuinely differ. Both ease in and
out, unlike the generation ramp which snaps back — these are movements between
two states the user is *looking at*, so regrouping has to be as watchable as
separating.

The unit ramp is 760 ms against the floors' 620 ms. Going straight from `Stacked`
to `Units` runs both at once, and the small difference means the floors arrive
fractionally first, so the eye reads "the building opened into layers, and the
layers opened into properties" rather than one undifferentiated scatter. It costs
one constant and no sequencing logic.

#### The honesty line

Whenever an explosion is active the view controls carry:

> *Visualization offset only — cadastral geometry unchanged*

It is held as a constant in `explodedView.ts`, next to the transform it
describes, so the disclaimer and the thing it disclaims cannot drift apart. It is
shown only while exploded — a permanent disclaimer is one nobody reads.

#### What is checked

`scene/explodedSelfCheck.ts`, 15 assertions, executed in bare Node. Two subjects:

**That the offsets are right.** A sign error would move every unit *inward*, and
on a symmetric 2 × 2 grid the result is still symmetric and still looks
deliberate — so the direction is asserted against the geometry it claims to be
derived from, unit by unit: every unit moves exactly `EXPLODED_UNIT_DISTANCE_M`,
every unit's offset has the same sign as its own displacement from the floor
centre, diagonally opposite units cancel to zero, and a unit on the centre does
not move.

**That the transform is a transform.** The units are serialised, every offset
function is run over them at full explosion, and they are serialised again and
compared. If anyone ever "optimises" one of these functions into an in-place
mutation, that is what catches it.

### 10.2 Subphase B — floor isolation

A five-storey building with twenty property volumes is, from most angles, a box
with lines on it. A presenter who wants to say "*this* floor holds four
separately owned volumes" has to first get the audience looking at the right
layer, and orbiting until it happens to be unobstructed is not a plan. Isolation
makes that one instruction — and, since choosing a floor also flies the camera to
it, one click.

#### Ghosting, and why not hiding

The subphase allowed heavy fading, hiding, or ghosted wireframes. Hiding is the
tempting one and it is wrong: a single floating slab tells the viewer nothing
about *where in the building* the layer is, and a property's position in the
stack is part of its identity in a vertical cadastre. Floor 3 shown alone could
be any floor.

So the other floors stay, drawn as ghosts — fill down to a tenth, **edges kept at
better than half**:

```
  fillScale = mix(1, 0.10, amount)      the volume recedes
  edgeScale = mix(1, 0.55, amount)      the structure stays
```

That ratio is the whole mechanism. What survives is the building's shape *drawn
in line*, which is exactly the information needed to locate the isolated floor
within it. It also keeps working from any camera angle, which a plain fade does
not: from directly overhead, four faded floors and one solid one are
indistinguishable; four wireframes and one solid one are not.

Ghosts additionally stop casting shadows and stop writing depth. A ghost that
throws a full-strength shadow reads as a rendering fault, and one that writes
depth occludes the very layer it is supposed to be framing.

#### The priority rule

Isolation and the exploded view are **independent and orthogonal**:

```
  explosion   decides WHERE each floor and unit is drawn        (position)
  isolation   decides HOW STRONGLY it is drawn, and whether
              it can be clicked                                 (appearance)
```

They compose by multiplication and neither module imports the other, so all six
combinations are defined and none of them is a special case. The most useful
picture the prototype can produce falls out of that for free: one floor solid,
its four properties dispersed horizontally, the rest of the building hanging
around them in outline.

One rule is *not* orthogonal, so it is stated rather than left to be discovered:

> **While a floor is isolated, only that floor's units are clickable.**

A ghost is a context cue, not a target. Clicking one would open a record for a
property the presenter has just deliberately pushed into the background. The rule
lives in the `interactive` field of `FloorEmphasis`, and — because a boolean that
is wrong in one branch produces an interface where ghosts are *secretly*
selectable, which nobody notices until a judge clicks one —
`floorIsolationSelfCheck.ts` asserts it explicitly.

Interactivity switches the moment a floor is isolated rather than fading with the
ghost. A floor 60 % of the way to being background is already background, and a
target whose clickability flickered on the way in would be worse than one that
simply stops being a target.

#### The indicator, and why every figure is derived

```
  ISOLATED LAYER
  Floor 3
  Property volumes   4
  Elevation          6.0 – 9.0 m
  Combined area      252 m²
```

Ghosting tells the audience *which* layer is the subject. It says nothing *about*
that layer, and what a cadastral audience wants at that moment is the layer's own
record: how many separately owned volumes it holds and what slice of space they
occupy.

`getIsolationSummary(floorLevel, units)` computes all of it from the units on
that floor — the count is `filter().length`, and the elevations are read back off
those units' own `yMin` / `yMax` rather than recomputed from the config. That
last choice is deliberate: the panel reports the elevation of *the property
volumes it is counting*, so if the units and their floor layout ever disagreed
the panel would show it rather than paper over it. A floor with no units returns
`null`, so the panel is absent rather than confidently claiming "0 property
volumes, elevation 0–0 m".

The self-check recomputes both figures from the generator, so a hard-coded "4" —
the easy way to build that panel, and the one that would quietly go stale — cannot
pass.

#### One action, three effects

Choosing a floor does three things at once, and doing them in one place is what
makes the control feel like a single instruction:

1. the mode changes;
2. a selection on *another* floor is cleared, so the inspector never describes a
   property that has just been pushed into the background;
3. the camera flies to the `floor` preset — the automatic framing the subphase
   asked for.

The camera view is computed inside the handler with the *new* floor spliced into
the preset context, because state set in a callback is not readable until the
next render. Choosing `All` returns to the building view.

### 10.3 Subphase C — the topology validation engine

**The test of a validator is whether anything can turn it red.** A green panel
over a valid model proves nothing: a validator broken in the direction of always
passing looks exactly like a working one. That observation shapes both the engine
and the way it is checked.

#### What it is pointed at

`src/validation/` has **no import path** to `scene/explodedView.ts` or
`scene/floorIsolation.ts`. That is the enforcement of §10.0, and it is deliberate
rather than incidental: separating volumes on screen is exactly what makes
overlaps disappear, so a validator handed display coordinates would pass an
invalid building and fail a valid one. The module graph makes the mistake
unavailable rather than merely discouraged.

It *is* pointed at whatever unit array it is handed, which is how Subphase D
works: the simulation produces a modified array, the engine validates it, and
discovers the overlap with no knowledge that a simulation exists.

#### The six rules

```
  1  parcel-containment      footprint ⊆ parcel, rings simple
  2  unit-containment        every unit ⊆ footprint (plan), ⊆ 0…H (height)
  3  floor-hierarchy         ordered, non-negative, non-overlapping,
                             each unit's Y == its own floor's Y
  4  identifier-uniqueness   every prototype ULPIN distinct
  5  ownership-overlap       AABB intersection over all C(n,2) pairs
  6  structure-count         actual vs getTotalUnits(config)
```

Every rule runs; there is no short-circuit on first failure. A presenter looking
at a broken record wants the whole picture, and "we stopped checking after the
first problem" is not a thing a register should say.

#### The two boundary problems, and why they are the interesting part

**Touching is not overlapping.** Unit 301 occupies x ∈ [−9, 0]; unit 302 occupies
x ∈ [0, 9]. They share a wall. Every floor shares a slab with the floor above it.
So the test is:

```
  overlapX = min(A.xMax, B.xMax) − max(A.xMin, B.xMin)
  overlapY = min(A.yMax, B.yMax) − max(A.yMin, B.yMin)
  overlapZ = min(A.zMax, B.zMax) − max(A.zMin, B.zMin)

  conflict  ⟺  overlapX > ε  ∧  overlapY > ε  ∧  overlapZ > ε
```

A shared wall gives exactly zero on one axis. **`>` and not `>=`** — that one
character is the difference between a valid twenty-unit building and
thirty-one reported disputes, and it is asserted directly rather than trusted.
Requiring all three axes is what makes this a volume test rather than three
interval tests: units on different floors have identical X and Z and
`overlapY = 0`.

For axis-aligned boxes AABB intersection is **exact**, not conservative — which
is why the units are stored as six bounds in the first place. It becomes a bound
the moment a property is not a box, and that limitation is recorded in `aabb.ts`
rather than discovered later.

**A point on an edge is inside.** Ray casting is unreliable for a point lying
exactly on a boundary — whether the ray is judged to cross depends on
floating-point luck at the vertex. That is not an edge case here, it is the
normal case: every unit's plan corners sit on the footprint edge, because the
units were cut from that footprint. A naive ray cast would report a valid
building invalid about half the time.

So containment asks *"is this point on the boundary, within a tolerance"* first,
and ray-casts only if not. Cadastral geometry is measured in centimetres; a point
a micrometre outside a line it is meant to lie on is a rounding artefact, not a
trespass.

Containment of a ring needs both tests — **every vertex inside, and no edge
properly crossing**. Vertices alone miss a ring bulging through a notch in a
concave polygon, which the deliberately non-rectangular demo parcel is exactly
the shape to have; edge crossings alone miss a ring entirely outside.

#### The result model

Structured, never strings:

```ts
ValidationResult { id, category, status, message, chip, affectedUnitIds, details }
TopologyReport   { status, results, passCount, warningCount, failCount,
                   chips, conflictedUnitIds }
```

Three consumers read one record and none of them parses English: the status bar
reads `chip` and `status`, the details panel reads `message` and `details`, and
the 3D scene will read `affectedUnitIds` to paint conflicting volumes red. That
last field is what ties a *finding* to the *geometry it is about* by data rather
than by a second hard-coded list.

`TopologyStatus` (`valid | warning | conflict`) is deliberately a different union
from `ValidationStatus` (`pass | warning | fail`). A check fails; a *record* has a
conflict. Using the check-level word at the model level would make the headline
read "FAIL", which says something went wrong with the software rather than
something is wrong with the record.

**Chip text is written by the rule, not the view.** The rule already holds the
figures, so the bar cannot say "20 units" while its own details say nineteen —
and `ValidationStatusBar.tsx` contains no numbers at all.

A count mismatch is a `warning`, not a `fail`, and the distinction is considered:
a building with nineteen units is not spatially impossible, it is a building
whose generator and configuration disagree. `conflict` is reserved for two people
owning the same air.

#### The pipeline's fourth state

`Topology Validated` is the sixth step, and `failed` is the fourth
`PipelineStepState`. Until Subphase C no step could come out wrong — extruding a
polygon and cutting it into boxes cannot fail — and a pipeline whose last step
could only ever show a tick would be precisely the decorative validator this
project set out not to build. `countCompletedSteps` does not count `failed`, so a
model with a dispute reads **5/6**, not 6/6 with a red mark nobody notices.

#### How it is checked

`validationSelfCheck.ts`, 25 assertions, in two halves.

**The healthy model must be clean** on every rule — a validator that cries wolf
on correct data is worse than none, because a presenter learns to ignore it.

**Six deliberately broken models must each be caught**: two units genuinely
overlapping (and the intersection volume computed as 4 × 7 × 3 = 84 m³, not
guessed), a unit outside the footprint, a unit through the roof, a duplicated
identifier, a building moved off its parcel, and a short unit count that must
*warn* rather than declare a conflict. Each is fed to the same engine the
interface uses, and the engine is required to find it and name the right units.

Plus the two touching cases, the plane-geometry primitives directly (including a
bow-tie ring detected as non-simple, and a reversed ring flipping the sign of its
signed area while `getFootprintAreaSqM` — which takes the magnitude — cannot see
it), and the standing no-mutation check.

### 10.4 Subphase D — ownership conflict simulation

A validation engine that has only ever been shown a valid model has demonstrated
nothing: the panel says `TOPOLOGY VALID`, and so would a panel that always says
`TOPOLOGY VALID`. The only convincing demonstration is to break the geometry in
front of the audience and let the same engine find the break.

#### The third kind of coordinate

```
  canonicalUnits ──► applyConflictSimulation ──► units (display record)
                              │                        │
                     off by default                    ├─► the 3D scene
                     returns a NEW array               ├─► PropertyInspector
                     canonical untouched               └─► validateTopology
```

A simulated conflict is **not** a visualisation. Exploding the view changes where
a box is *drawn*; simulating a conflict changes *what the record says the
property is*. That is why the inspector shows the simulated bounds and the
validator is pointed at them — and why the exploded offset reaches neither.
Confusing the two in either direction breaks the demonstration: treat the offset
as a simulation and the validator sees phantom conflicts; treat the simulation as
an offset and it never sees the real one.

`applyConflictSimulation` returns **the input array by reference** when inactive.
"Restore Valid Geometry" is therefore not an undo, not an inverse translation and
not a regeneration — it is the app pointing at the original again. Restoration
cannot drift, because nothing was changed. The self-check asserts it with `===`,
which is a stronger guarantee than a deep comparison and free.

#### The pair is found, not named

Hard-coding "302 encroaches into 301" would work today and would misrepresent
what the code knows. `findEncroachmentPair` tests adjacency geometrically: two
units on the same floor, overlapping genuinely on Y and on one horizontal axis,
touching within a tolerance on the other. That is exactly the condition the
validator's overlap test treats as *not* a conflict — which is what makes such a
pair the right one to break. Move one of them across their shared plane and a
legal adjacency becomes an illegal intersection, with nothing else about the
model changed.

Floor 3 is preferred (a middle floor has neighbours above and below for the
exploded and isolated views to show), but any floor with a usable pair is
accepted. Units are considered in `indexOnFloor` order so the choice is
deterministic — the same pair every time, which matters when a demo is rehearsed.

#### It is a translation, not a resize

The encroaching unit's bounds both move by the same amount, so its extent — and
therefore its area, its volume and its recorded size — are preserved. That is the
realistic fault: a boundary recorded in the wrong place moves a whole property.
Its area is not wrong; *where it is* is wrong, and the consequence is that it now
occupies space its neighbour also occupies. Resizing instead would produce a unit
whose stated area no longer matched its bounds — a second, different defect that
would muddy which rule the validator caught. The self-check asserts that
**only** `ownership-overlap` fails.

#### The colour hierarchy

```
  conflict   red         highest
  selected   amber
  hovered    faint glow
  normal     slate       lowest
```

**Conflict outranks selection**, and that ordering is the substantive one: a
presenter clicking a red volume to read its record would otherwise turn the
evidence off in the act of examining it. Selection stays legible through its
*cage* — colour says what a property **is**, the outline says which one you
**picked**. Two meanings, two channels.

The red comes from `TopologyReport.conflictedUnitIds`, so the boxes on screen and
the engine's finding are tied by data rather than by a second list that could
drift.

#### The banner, and the honesty line

*(Subphase G moved this content out of the canvas and into a docked panel in
the right column — `ui/ConflictPanel.tsx`. What it says is unchanged; only
where it says it changed. See §10.7.)*

The warning shows the two units with their identifiers, the floor, the rule
violated, and the intersection volume **with its three extents spelled out beside
the product** — `84.0 m³` above `4.00 × 7.00 × 3.00 m` — so the figure can be
checked rather than believed. No adjective, no severity score, no advice.

And when the conflict was staged rather than found in the data, the banner says
so: *"Simulated override — unit 302 moved 4.00 m east–west across its shared wall
with 301 on floor 3. The canonical cadastral record is unchanged."* A
demonstration that let an audience believe the demo data contains a genuine
ownership dispute would be winning the point by misleading them.

### 10.5 Subphase E — ownership presentation

#### The identifier as a derivation

Phase 6 gave the inspector a prominent ULPIN card, and it was right to. But shown
alone the identifier is a string, and a string does not explain itself:
`KA-BLR-0482-001928-F03-U02` looks like a reference number.

Laid out as a descent — parcel, then floor, then unit, then the identifier —
each rung narrows the one above it and the last rung is visibly the first three
joined. The identifier stops being a label and becomes a **derivation**, which is
the clearest statement the interface can make about what a 3D ULPIN is. It costs
four lines and it *replaced* the standalone card rather than being added beside
it, so the identifier still appears exactly once.

Every rung is read off a field on the record. Nothing splits the identifier to
recover its parts, which would be the tempting shortcut and would invert the real
dependency: the segments were built *from* those values.

#### One decision, one module

`scene/unitStatus.ts` holds the priority ordering and `getUnitStatus` is the only
place it is applied. Before Subphase E the same nested ternary appeared four
times in `Building.tsx` — once each for fill colour, emissive colour, emissive
intensity and edge opacity — which is four chances for a unit's fill to say
"disputed" while its edges say "selected". The five status assertions in
`conflictSelfCheck.ts` pin the ordering.

#### Why nothing is green

Every unit that is not in conflict is valid. Colouring valid units green would
paint nineteen boxes of twenty green, leave the palette with nothing left to say,
and make the *unremarkable* case the loudest thing on screen — the default state
of a register is that it is consistent.

So validity is reported where it is a question being asked: on the status bar,
which states the standing condition of the whole record, and in the property
inspector for the one unit the user selected (`✓ No conflicts on this volume`).
In the 3D scene, valid is the absence of red. That restraint is precisely what
makes the conflict colour read as loudly as it does.

### 10.6 Subphase F — making the conflict visible

#### The problem

By the end of Subphase E the conflict demonstration was *correct* and almost
*invisible*. The engine found the overlap, the status bar flipped to TOPOLOGY
INVALID, two boxes turned red — and an audience three metres from a projector
could not tell which box had moved, where it had moved from, or which part of
space was being claimed twice. From the default three-quarter view the whole
finding was a colour change of a few dozen pixels, usually behind another floor.
The most common question after the demo was *"wait, which one is wrong?"*.

The logic was doing the work and the picture was not showing it. Subphase F is
about the picture, and it adds no new product capability: no AI, no backend, no
database, no basement. Every number it puts on screen was already being computed.

#### The five facts, and who owns each

A judge needs to answer five questions without being told, and the design rule is
that the renderer must not be the thing that invents any of the answers:

| Question | Answered by | Owned by |
|---|---|---|
| Which property moved? | the encroachment pair | `conflictSimulation.ts` |
| Where was it supposed to be? | the canonical record, still in memory | `unitLayout.ts` |
| Which one did it hit? | the encroachment pair | `conflictSimulation.ts` |
| What volume overlaps? | the engine's intersection **bounds** | `validation/aabb.ts` |
| How far did it move? | the simulation's displacement function | `conflictSimulation.ts` |

`simulation/conflictPresentation.ts` collects those five into one `ConflictFocus`
record. It measures nothing, decides nothing and discovers nothing.

#### The engine now returns the region, not only its size

`VolumeIntersection` previously carried `extents` and `volumeCubicM`: *how big*
the overlap is, never *where*. A scene that wants to draw the contested volume
needs where, and the only way to get it was for the renderer to re-derive the
bounds from the two units — a second implementation of the intersection, living
in a file that draws things, free to disagree with the one that decides things.

So `getVolumeIntersection` gained a `bounds` field, computed by the same clamp
that produces the extents and kept beside them so they cannot drift:

```
  xMin = max(A.xMin, B.xMin)      xMax = min(A.xMax, B.xMax)     (and Y, Z)
```

`OwnershipConflict` carries it through, and `ConflictOverlay` positions a cube at
`bounds`' centre and scales it by `bounds`' size. **The red box on screen is the
validator's own output rather than an illustration of it.** The self-check asserts
byte-equality between the two.

#### The move is animated, and the record is what animates

`applyConflictSimulation` gained a `progress` parameter. It is important to be
precise about what that is: **not** a display offset on a settled override. The
intermediate array is a genuine hypothetical *record* — the inspector reports its
bounds, and the validator is handed it — exactly as at full strength. What is
being animated is the hypothesis, not the drawing of it.

That has a visible consequence, and it is the best moment in the demonstration.
Because the engine is re-run on each intermediate record, the reported
intersection volume genuinely grows:

```
  progress   displacement   engine's finding
  0.00        0.0 m         (no intersection — they only touch)
  0.10       −0.4 m          8.4 m³
  0.25       −1.0 m         21.0 m³
  0.50       −2.0 m         42.0 m³
  0.75       −3.0 m         63.0 m³
  1.00       −4.0 m         84.0 m³   (4.00 × 3.00 × 7.00 m)
```

Nobody interpolated those numbers. The same `findOwnershipConflicts` that
measures the settled overlap measures each intermediate one, ~190 pair tests per
frame, comfortably under a millisecond.

At `progress === 0` the simulation returns the canonical array **by reference**,
which is what makes the end of the restore not merely equal to the original
record but *be* the original record.

#### Two ramps, because two different things are being animated

| Ramp | Duration | Drives |
|---|---|---|
| `conflictProgress` | 1400 ms out / 900 ms back | the **record** — the array the validator sees |
| `conflictFocusAmount` | 460 ms both ways | **opacity only** — dimming, ghost, arrow, red volume |

They answer to different clocks. The framing should land quickly and get out of
the way; the property's journey is the thing being watched and deserves the full
second and a half. The slide is deliberately longer than the 850 ms camera flight
it starts alongside, so the camera has arrived and settled before the property
finishes arriving — the viewer is looking at the right place by the time the
overlap forms.

Restoring is faster than breaking: going wrong is what is being demonstrated and
deserves the time; going right again is a *restoration*, and one that took as long
as the damage would read as hesitancy.

#### Auto-focus is one action, and it is reversible

Triggering the simulation enters a dedicated presentation state in a single
click — the presenter never hunts for the consequence:

- the conflict's own floor is isolated, so the other four ghost away (reusing
  Subphase B's mechanism rather than adding a parallel one);
- the exploded view is stood down and its controls disabled — see below;
- any selection is cleared, so an amber cage cannot compete with the red;
- the camera flies to a new `conflict` preset framing **both properties and the
  ghost position**, then hands control straight back to OrbitControls;
- the two innocent units on that floor fade to a twentieth.

The four displaced values (`explodeMode`, `isolatedFloor`, `activePreset`,
`selectedUnitId`) are captured in a ref on the way in and reapplied on the way
out, together with the camera view that framed them. A presenter who had isolated
floor 2, exploded the floors and selected a unit gets all three back; otherwise
the simulation would be a one-way door in the middle of a live demo.

The `conflict` preset is deliberately **not** a button. It is applied by the
simulation rather than chosen, and a sixth button that only worked while a
conflict was staged would be disabled for the entire rest of the demonstration.

#### Why the exploded view and the conflict presentation take turns

The disputed region is a box that exists only where two property volumes
interpenetrate. Separate those two volumes on screen and the region no longer lies
inside either of them: it would hang in the gap between two boxes that visibly do
not touch, stating the opposite of what it means. Rather than draw something false
or silently hide it, the explosion levels are disabled while a conflict is being
presented — visible and disabled with an explanation, like every other unavailable
control — and the previous level is restored on dismissal.

Floor explosion is still honoured for *placement*: everything the overlay draws
sits at true cadastral coordinates plus the conflict floor's own
`getExplodedOffsetM`, the same call the floor's plate and units make.

#### The semantic hierarchy

| Layer | Appearance | Why |
|---|---|---|
| Intersection volume | `#f0392c`, 46 % opacity, edges drawn through everything | The answer. It must out-rank the two red units it sits between. |
| Conflicting units | `#c0453d`, full strength | Unchanged from Subphase E. |
| Canonical ghost | `#cfdae4`, 5.5 % fill / 62 % edges | Deliberately *colourless* — every other hue means a state, and a remembered position is not a state. |
| Selected unit | amber cage, layered on top | A different channel from fill: colour says what a property **is**, the cage says which one you **picked**. |
| Everything else | fill × 0.05, edges × 0.3 | Structure, not objects. |

Two restraints are worth stating because they were tempting to break. The
intersection red is a *saturated signal red, not a fluorescent one*: the cheap way
to out-rank `#c0453d` is a colour that could not occur in a building, and that
reads as a rendering artefact rather than a finding — the scene stops looking like
a cadastre and starts looking like a game. And nothing pulses, glows or animates:
the scene already contains a translucent volume being claimed by two people, and
dressing that up would make the strongest evidence in the demonstration look less
true rather than more urgent.

The intersection's edges use `depthTest: false`, which is normally a mistake.
Here it is the point: the disputed volume is buried between two solid boxes and
would otherwise be visible only from the two angles that happen to look down the
gap. Conflict focus fades everything else to near-nothing precisely so that a
shape drawn through the model reads as "inside there" rather than "in front".
The volume's *faces* are coplanar with the units' faces by construction — that is
what an intersection is — so the material carries a polygon offset, without which
the most important object in the scene z-fights along every shared plane.

#### Detection is not adjudication

The panel gained two rows that are not figures, and they are the most important
thing in the subphase:

```
  Rule     3D ownership volumes must not positively overlap
  Status   Requires cadastral review

  Detected → Source records compared → Officer review required
           → Correct geometry → Revalidate

  The system detects the conflict but does not decide legal ownership.
```

Everything above those rows is a finding of fact about geometry. Everything below
concedes that a finding of fact about geometry is not a finding of law about
people. A spatial validator can prove two records describe overlapping volumes. It
cannot know which survey was wrong, which deed is older, which sale was registered
first, or what a tribunal would decide — and a prototype that implied otherwise
would be making a claim about *law* on the strength of arithmetic about boxes.

The workflow is stored as data in `conflictPresentation.ts` rather than written
out in the panel, because it is a claim about process and should be reviewable as
one. Note where the human is: the system performs steps one and five; a cadastral
officer performs steps two, three and four. The chain carries that distinction in
its styling — filled chips for the automated steps, outlined for the manual ones —
rather than in a footnote.

#### Restore, and revalidation

"Restore Valid Geometry" animates the property back over 900 ms. Revalidation is
not a separate step and there is no button for it: `units` is a `useMemo` over
`conflictProgress`, the validation report is a `useMemo` over `units`, so the
engine re-runs on every frame of the return journey and the status flips back to
TOPOLOGY VALID the instant the overlap falls below `OVERLAP_EPSILON_M`. The alert
and the conflict panel disappear at the same moment, because both render only
when the engine has actually found something. The ghost, the arrow and the red volume fade out over
460 ms, the floors un-ghost, the camera returns to the remembered view, and the
displaced explode/isolation/selection state comes back.

#### What is checked, and why each check exists

`simulation/conflictPresentationSelfCheck.ts` — 22 pure assertions. They exist
because the failure mode here is the worst kind: everything still renders, nothing
throws, and the demonstration confidently highlights a volume the validator never
found.

| Property | Why it could break |
|---|---|
| Deriving the presentation leaves the record byte-identical | A focus builder that normalised bounds in place |
| Displacement equals the configured encroachment, on the shared-wall axis only | An arrow drawn from centres rather than from the vector |
| Displacement is proportional at 0, ¼, ½, ¾, 1 | A presentation right at both ends and wrong in between looks correct in every screenshot and wrong in the only thing an audience watches |
| Drawn intersection bounds **are** the validator's bounds | The renderer re-deriving the intersection |
| Drawn volume **is** the validator's volume, and is the product of its own extents | A formatted figure drifting from the box |
| Mesh size equals the engine's extents | Bounds and extents are two views of one region |
| The disputed region lies inside **both** properties | A region that stuck out of one would be a rendering error wearing the demo's most persuasive clothes |
| Ghost bounds are identical to the record's bounds | A ghost reconstructed by subtracting the displacement |
| The ghost stays put while the property slides | A ghost that trailed the animation |
| Progress 0 returns the canonical array **by reference** | Restore drifting instead of being an identity |
| No conflict remains after restore | — |
| Emphasis leaves the model alone at zero focus | A dimming rule that never fully switched off |
| The framing reaches the canonical position | A camera that framed the answer and cropped the evidence |

Run with the other five self-checks under `import.meta.env.DEV`, so the whole set
is stripped from the production bundle.

#### Files

| File | Change |
|---|---|
| `validation/aabb.ts` | `VolumeIntersection.bounds`; `getIntersectionBox`, `getBoxCentre`, `getBoxSize`, `getBoxUnion` |
| `validation/validateTopology.ts` | `OwnershipConflict.bounds` |
| `simulation/conflictSimulation.ts` | `progress` parameter; `getEncroachmentShiftM`, `getDisplacementVectorM`; `CONFLICT_ANIMATION_MS`, `CONFLICT_RESTORE_MS` |
| `simulation/conflictPresentation.ts` | **new** — the whole of geometry kind D |
| `simulation/conflictPresentationSelfCheck.ts` | **new** — 22 checks |
| `scene/ConflictOverlay.tsx` | **new** — ghost, arrow, intersection volume, three labels |
| `scene/Building.tsx` | conflict-focus dimming, multiplied into isolation |
| `scene/SceneViewer.tsx` | distributes the focus; renders the overlay after the units |
| `scene/cameraPresets.ts` | the `conflict` preset and `conflictFraming` |
| `scene/explodedView.ts` | `getSettledExplodeAmounts` |
| `ui/ConflictBanner.tsx` | dimensions, displacement, rule, status, workflow, disclaimer — *superseded in Subphase G; this content now lives in `ui/ConflictPanel.tsx`* |
| `ui/ViewControls.tsx` | explode levels disabled during conflict focus |
| `animation/generationSelfCheck.ts` | `conflict` added to the preset fallback sweep |
| `App.tsx` | the two ramps, the animated record, enter/exit focus with remembered state |
| `index.css` | three scene labels, the widened panel, the workflow chain |

---

### 10.7 Subphase G — where the finding is presented

#### The problem

Subphase F made the conflict visible and then covered it up.

By the end of F the 3D scene carried the whole argument: the two properties in
signal red, the disputed region as a translucent red box occupying exactly the
validator's own intersection bounds, the colourless ghost standing where the
register says the moved property belongs, and an arrow from the ghost to the
overridden position. Four pieces of evidence, all derived, all in one place.

And in front of them sat `ConflictBanner` — a 430 px card, anchored top-centre
over the canvas, carrying eight fields, a five-step resolution chain and two
notes. On a 1440 px screen the middle column is roughly 800 px wide, so the card
occupied over half of it, from the top edge down past the middle. The `conflict`
camera preset frames both properties **and** the ghost, which puts the subject
squarely in the centre of the viewport — directly behind the card describing it.

Every figure on that card was true and every one of them was in the way. The
demonstration's strongest picture was competing with its own caption, and the
caption was winning because it was opaque.

#### The split: *that* versus *what*

The finding was divided along the only line that matters for placement — whether
a reader needs it **while looking at the scene**, or **after looking at it**.

| | Component | Where | Carries |
|---|---|---|---|
| **that** | `ui/ConflictAlert.tsx` | one line, top-centre over the canvas | the announcement and the intersection volume |
| **what** | `ui/ConflictPanel.tsx` | docked at the top of the right-hand column | the eight fields, the resolution chain, the two notes |

The alert reads:

```
⚠  SPATIAL OWNERSHIP CONFLICT DETECTED · 84.0 m³ overlap
```

The volume is carried up into it deliberately. `CONFLICT DETECTED` on its own is
a claim; `84.0 m³ overlap` is a measurement, and the measurement costs eighteen
characters and one line of a pill that occludes a strip of empty sky above the
building. That is the whole of what the 3D viewer is now asked to give up.

The alert quotes the **first** conflict's volume rather than the sum of all of
them, because the panel below describes the first conflict. An alert quoting a
total beside a panel quoting a part would be two numbers for one finding. Any
remainder is reported as a count (`+1 more`), which is the honest way to say
"and others" without implying they have been summarised.

#### Why docked, and not a drawer

A drawer sliding in from the right was the more theatrical option and was
rejected on three grounds.

1. **It reintroduces the thing being removed.** The point of Subphase G is one
   fewer overlay, not a different one.
2. **It would cover the pipeline and the inspector.** Those two panels are what
   give the finding its context — which step of the workflow reported it, and
   what the selected property's record says. A reader wants them *beside* the
   conflict, not replaced by it.
3. **It would imply state the model does not have.** A drawer opens and closes,
   so an interface with one owes the user a control for it. This panel is present
   exactly when `findOwnershipConflicts` returns a non-empty array and absent
   otherwise. It has no state of its own, and a control suggesting it did would be
   lying about the model.

The right column was already the right place. It already scrolls
(`.inspector-panel { overflow-y: auto }`), it already stacks cards at their
natural heights with `align-content: start`, and it is already where every
*statement about the record* lives. A conflict is a statement about the record.
It is docked at the **top** of that column, above `PipelineStatus` and
`PropertyInspector`, because it outranks both.

#### The three levels of the same truth, now visibly separate

| Level | Element | Says |
|---|---|---|
| the standing condition | `ValidationStatusBar` | the record as a whole is `TOPOLOGY INVALID` |
| the announcement | `ConflictAlert` | there is a conflict, and it is 84.0 m³ |
| the finding | `ConflictPanel` | which units, which floor, which extents, which rule, what happens next |

None is derived from another by hand; all three read the same
`validateTopology` / `findOwnershipConflicts` output. Subphase G did not add a
level — it moved the third one somewhere it does not obscure the evidence for
the first two.

#### What was deliberately not touched

Nothing in the 3D presentation. `ConflictOverlay.tsx`,
`conflictPresentation.ts`, `conflictSimulation.ts`, `Building.tsx`,
`SceneViewer.tsx`, `cameraPresets.ts` and `validateTopology.ts` are unchanged, so
the four pieces of scene evidence behave exactly as Subphase F left them:

- the two overlapping units in signal red,
- the red intersection volume at the validator's own bounds,
- the canonical ghost with its `CANONICAL POSITION` caption,
- the displacement arrow and its `−4.0 m X` label.

The `conflict` camera preset still frames both properties and the ghost; it now
frames them into a viewport with a pill across the top instead of a card across
the middle. The auto-focus behaviour, the remembered pre-conflict view state, the
1.4 s animated record, the per-frame revalidation and the automatic status flip
on restore are all untouched.

The validation bar is untouched. The `Simulate` control that enters conflict mode
is untouched. The three-column grid is untouched — the panel is a fourth card in
a column that was designed for an unknown number of them.

#### Accessibility: one announcement, not two

`ConflictAlert` is `role="alert"` — assertive, interrupting, which an ownership
dispute in a register warrants. `ConflictPanel` is `role="region"` with an
`aria-label`, **not** a second alert: two assertive live regions appearing
together would interrupt a screen reader twice for one event. The alert says what
happened; the panel is the landmark the listener is then sent to.

The panel also drops `pointer-events: none`. The floating card needed it so that
an orbit drag passing under it still reached the canvas. Nothing overlaps the
canvas any more, so the panel's text can be selected and quoted — which matters
for figures somebody may want to copy.

#### Files

| File | Change |
|---|---|
| `ui/ConflictAlert.tsx` | **new** — the one-line alert over the canvas |
| `ui/ConflictPanel.tsx` | **new** — the docked detail panel (the former banner's content) |
| `ui/ConflictBanner.tsx` | emptied to a tombstone (`export {}`) explaining the split; safe to delete |
| `App.tsx` | renders `ConflictAlert` in the scene panel and `ConflictPanel` first in the inspector column |
| `index.css` | `.conflict-banner*` replaced by `.conflict-alert*` and `.conflict-panel*`; `.conflict-workflow*` unchanged |

No module gained a dependency, no geometry changed, and no self-check needed
revision — Subphase G moves markup and CSS only.

---

### 10.8 Subphase H — the ground datum and below-ground volumes

Everything before this subphase lived above `y = 0`, so `y = 0` was merely where
the building started. The moment volumes exist on both sides it becomes a
**boundary with a meaning**, and four genuinely new concepts follow. Only these
four are new; everything else in the subphase is an application of §10.0's rule.

**1. The ground datum is a stated constant, not a literal zero.**
`GROUND_DATUM_Y` lives in `underground/basementConfig.ts` and every rule
compares against it. Three sentences the interface must let an audience read off
the screen without being told:

```
above ground   y > 0
ground datum   y = 0
underground    y < 0
```

It is *drawn* as well as stated — a ring on the building's own footprint at
exactly `y = 0` (`scene/GroundDatum.tsx`) — because a boundary that matters and
is invisible is a boundary an audience has to take on trust.

**2. Touching the datum is valid; crossing it is not.**

```
basement ceiling  y = 0   ┐ share a SURFACE, not a volume  → VALID
ground-floor slab y = 0   ┘ overlap extent on Y is exactly 0

basement ceiling  y = +0.1 ┐ genuinely interpenetrate      → CONFLICT
ground-floor slab y =  0   ┘
```

Nothing new enforces this: it falls straight out of `getVolumeIntersection`,
which already required **all three** axis extents to exceed the epsilon before
reporting an intersection. The subphase's contribution is to point that test at
the cross-datum pairs and to check the rule *from both sides* — the underground
self-check builds a basement raised 0.1 m and asserts the validator catches it.
A validator that only ever sees valid models cannot be distinguished from one
that returns "valid".

**3. Two record types, one selection and one inspector.**
`UndergroundSpace` is deliberately **not** an `ApartmentUnit`: four consumers
read `floorLevel` as "1-based floor in the upward stack" (the ULPIN encoder,
floor isolation, the exploded offset, the conflict simulation), and a record
whose `floorLevel` meant "basement 1" would make every one of them silently
wrong. Identifiers separate the same way — `B01-U02`, not a negative floor — so
a collision across the datum is impossible by construction rather than merely
unlikely.

What is *not* duplicated is the reading of them. `App` still holds one
`selectedUnitId: string | null`; `ui/spaceRecord.ts` flattens whichever record
it names into a `SpaceRecord`, and `PropertyInspector` renders that with no
branch in it. There is one register, one panel, and no way for two panels to
drift.

```
ApartmentUnit ────┐
                  ├──► SpaceRecord ──► PropertyInspector + OwnershipHierarchy
UndergroundSpace ─┘     (chain, bounds, centroid, isUnderground)
```

**4. The datum-side priority rule.**
Floor isolation states "while a floor is isolated, only that floor is a target".
The underground view states the same kind of rule on the other axis: **the side
of the datum you are looking at is the side you can select on.** Without it a
ray cast at a thinned ground plane would pass through and select a volume the
presenter cannot see. Like isolation's rule it is a decision, not a fade —
interactivity switches when the mode is entered rather than tracking the opacity
ramp.

The visualisation obeys §10.0 unchanged. `getUndergroundExplodedOffsetM` is a
display transform that returns a **negative** offset (`basementIndex + 1`, so
the first gap opens at the datum rather than welding the basement to the ground
floor), the canonical interval stays −3.0 → 0.0 m at every explosion amount, and
the underground emphasis multiplies with floor isolation and conflict focus
rather than overriding either — so all their combinations remain defined.

## 11. Repository shape

### As built (Phases 1–10 — this exists now)

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
   │                         # Phase 7: imports leaflet/dist/leaflet.css first
   ├─ App.tsx                # page shell + Phase 5: owns the units array and the selection
   │                       # Phase 6: runs the identifier self-check in dev
   │                       # Phase 7: three-column layout; passes DEMO_PARCEL to the map
   │                       # Phase 8: owns isGenerated; measures the footprint once
   │                       # Phase 9: owns the progress ramp, the exploded flag and
   │                       # the camera request; derives GenerationVisuals once
   ├─ index.css              # dark theme; global styles
   │                         # Phase 7: the three-column viewer grid + map styling
   │                         # Phase 8: the generate bar and the pipeline card
   │                         # Phase 9: view controls, generation status strip,
   │                         # the active pipeline state, 3D label styling
   ├─ vite-env.d.ts          # tells TypeScript about Vite-specific imports (e.g. CSS)
   ├─ animation/             # timing, added Phase 9 — no React, no Three.js, no DOM
   │  ├─ easing.ts           # clamp01, subProgress, LINEAR / EASE_OUT_CUBIC /
   │  │                      # EASE_IN_OUT_CUBIC / pulse — stable module constants
   │  ├─ generationTimeline.ts # THE SEQUENCE: getGenerationVisuals(progress,
   │  │                      # floorCount) → every opacity, height and reveal;
   │  │                      # stage ids and their status wording
   │  └─ generationSelfCheck.ts # samples the timeline in 200 steps: monotonic,
   │                          # bottom-up, exact at both ends; dev-only runner
   ├─ geometry/              # the footprint, added Phase 8 — no React, no Three.js
   │  ├─ footprint.ts        # MetricPoint2D, BuildingFootprint, bounds/width/depth/
   │  │                      # area/centroid, the east-north → x/z axis convention
   │  └─ footprintSelfCheck.ts # pure literal-answer checks; dev-only runner
   ├─ ulpin/                 # the identifier, added Phase 6 — no React, no Three.js
   │  ├─ parcelIdentity.ts   # ParcelIdentity, DEMO_PARCEL_IDENTITY, parent-parcel text
   │  ├─ generateUlpin.ts    # generatePrototype3DULPIN(), padding, uniqueness guard
   │  └─ ulpinSelfCheck.ts   # pure known-answer + uniqueness checks; dev-only runner
   ├─ simulation/            # the conflict override, added Subphase D — pure
   │  ├─ conflictSimulation.ts # findEncroachmentPair (geometric adjacency),
   │  │                      # applyConflictSimulation (new array; input by
   │  │                      # reference when off). No validator import
   │  └─ conflictSelfCheck.ts # canonical untouched, engine discovers it,
   │                          # restore is exact, + the status hierarchy
   ├─ validation/            # the topology engine, added Subphase C — pure
   │  ├─ geometry2d.ts       # point-in-ring (boundary-tolerant), segment
   │  │                      # crossing, ring containment, winding, simplicity
   │  ├─ aabb.ts             # 3D overlap extents + intersection volume;
   │  │                      # touching is NOT overlapping
   │  ├─ types.ts            # ValidationResult / TopologyReport; no strings
   │  ├─ validateTopology.ts # the six rules; findOwnershipConflicts
   │  └─ validationSelfCheck.ts # healthy model clean + six breakages caught
   ├─ workflow/              # the pipeline, added Phase 8 — pure, no React
   │  └─ pipelineSteps.ts    # the five steps as derived data; no view decides state
   │                          # Phase 9: a third state, `active`, driven by the stage
   ├─ data/                  # demo datasets, added Phase 7 — no React, no Leaflet
   │  └─ demoParcel.ts       # DemoParcel, metre→lat/lng conversion, shoelace adapter,
   │                         # DEMO_PARCEL built from the shared parcel identity
   │                         # Phase 8: DEMO_BUILDING_FOOTPRINT_M — the authoritative
   │                         # horizontal geometry; buildingFootprintMetric on the parcel
   ├─ map/                   # everything 2D (added Phase 7)
   │  ├─ GISMap.tsx          # <MapContainer>: tiles, parcel, footprint, centre point
   │  ├─ MapLegend.tsx       # the key; swatches read from parcelStyles.ts
   │  ├─ ParcelInfoPanel.tsx # the parcel record beneath the map
   │  │                      # Phase 8: shows the footprint's measured plan dimensions
   │  └─ parcelStyles.ts     # one source for layer colours, tile URL, zoom limits
   ├─ scene/                 # everything 3D (added Phase 2)
   │  ├─ buildingConfig.ts   # Phase 3: the config type, floor maths, total height
   │  │                      # Phase 8: width/depth REMOVED — vertical + grid only
   │  ├─ unitLayout.ts       # Phase 4: ApartmentUnit, the 2 x 2 subdivision, centres
   │  │                      # Phase 5: propertyType, findUnitById()
   │  │                      # Phase 6: prototypeUlpin + parentParcelId per unit
   │  │                      # Phase 8: subdivision derives from the footprint bounds
   │  ├─ footprintGeometry.ts # Phase 8: the only file that knows both the footprint
   │  │                      # and THREE — Shape, ShapeGeometry, ExtrudeGeometry,
   │  │                      # and the rotation/sign pair that lays them down
   │  │                      # Phase 9: createFloorSlabGeometry — the same extrusion
   │  ├─ explodedView.ts     # Phase 9: the display-only floor offset. Pure. The
   │  │                      # logical elevations are never touched
   │  │                      # Subphase A: + horizontal unit offsets, derived from
   │  │                      # each unit's own position on its floor; ExplodeMode;
   │  │                      # getUnitDisplayOffsetM — the ONE shared offset
   │  ├─ explodedSelfCheck.ts # Subphase A: derived directions, and the check that
   │  │                      # the transform never writes to the model
   │  ├─ floorIsolation.ts   # Subphase B: per-floor fill/edge scales, targeting
   │  │                      # and the derived isolated-layer summary. Pure
   │  ├─ floorIsolationSelfCheck.ts # Subphase B: the priority rule, the derived
   │  │                      # indicator figures, and no-mutation
   │  ├─ unitStatus.ts       # Subphase E: conflict > selected > hovered >
   │  │                      # normal. The ONE place the ordering exists
   │  ├─ cameraPresets.ts    # Phase 9: four named views as pure tuple arithmetic;
   │  │                      # no THREE import, nothing hard-coded to this building
   │  ├─ CameraRig.tsx       # Phase 9: the only file that turns a view into motion;
   │  │                      # owns controls.target, refs only, no state
   │  ├─ SceneViewer.tsx     # <Canvas>: camera, lights, fog, OrbitControls
   │  │                      # Phase 5: the click-vs-orbit-drag decision
   │  │                      # Phase 8: framing derived from the footprint; two states
   │  │                      # Phase 9: distributes GenerationVisuals; three lights
   │  ├─ FootprintPad.tsx    # Phase 8: the 2D cadastral plan, drawn on the ground
   │  │                      # Phase 9: base plane + corner ticks — the whole source state
   │  ├─ BuildingShell.tsx   # Phase 8: the plan extruded to full height — the envelope
   │  │                      # Phase 9: heightFraction — the extrusion, animated
   │  ├─ FloorSlabs.tsx      # Phase 9: one 12 cm plate per floor; the stratification
   │  ├─ SceneLabels.tsx     # Phase 9: floor labels in exploded view, selected unit only
   │  ├─ Building.tsx        # one mesh per unit; Phase 5: click + hover + highlight
   │  │                      # Phase 8: an opacity prop, used only during the fade
   │  │                      # Phase 9: per-floor reveal, exploded offset, shared edges
   │  └─ Ground.tsx          # ground plane + 1 m reference grid
   └─ ui/                    # HTML overlays and panels (added Phase 3)
      ├─ BuildingSummary.tsx # Phase 8: footprint measured from the polygon; two states
      ├─ GenerateCadastreControl.tsx # Phase 8: the Generate / Reset control
      │                        # Phase 9: a third, disabled "Generating…" state
      ├─ FloorIsolationPanel.tsx # Subphase B: the isolated-layer indicator
      ├─ ValidationStatusBar.tsx # Subphase C: the chips + verdict. No numbers
      ├─ ValidationDetails.tsx # Subphase C: every check and its figures
      ├─ ConflictAlert.tsx   # Subphase G: the one-line alert over the canvas
      ├─ ConflictPanel.tsx   # Subphase D: the finding, with the working shown
      │                        # Subphase G: docked in the right column, not floating
      ├─ ConflictBanner.tsx  # Subphase G: tombstone; superseded by the two above
      ├─ OwnershipHierarchy.tsx # Subphase E: parcel → floor → unit → identifier
      ├─ GenerationStatus.tsx # Phase 9: stage name + determinate bar, transition only
      ├─ ViewControls.tsx    # Phase 9: the four camera presets + the exploded toggle
      ├─ PipelineStatus.tsx  # Phase 8: the five-step pipeline, rendered from data
      │                        # Phase 9: the active state and the status line
      ├─ useFadeProgress.ts  # Phase 8: the 0→1 generation ramp; rAF, no library
      │                        # Phase 9: generalised — reverse duration + easing;
      │                        # the ONLY animation driver in the application
      └─ PropertyInspector.tsx # Phase 5: the selected unit's cadastral record
                               # Phase 6: the prototype 3D ULPIN block, shown first
                               # Phase 7: now a real column, no longer a floating overlay
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

Phase 5 is the first phase to cross the seam, and it shows where the seam
actually is. `SceneViewer` gained the click-versus-drag decision, because that
is an argument between the *camera controls* and the *contents* and it belongs
to whoever owns both. `Building` gained pointer handlers and two extra material
states. `ui/` gained a panel that imports no Three.js at all. What did **not**
happen is the interesting part: no 3D code learned that a panel exists, and the
panel learned nothing about meshes or rays. They meet only at `App`, over one
array and one string.

**Why `PropertyInspector` lives in `ui/`, not `scene/`.** Same reason as
`BuildingSummary`: it is HTML positioned over the canvas, not a 3D object. It
receives an `ApartmentUnit` — a plain data record with no Three.js in it — which
is exactly why `unitLayout.ts` was kept free of the renderer in Phase 4.

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

**Why `geometry/` is separate from `scene/` (Phase 8).** `scene/` is the
renderer. `geometry/footprint.ts` is a description of *land* — a polygon and the
measurements taken from it — and it is consumed by the map, the panels and the
pipeline as much as by the 3D viewer. Putting it in `scene/` would say the
footprint belongs to the 3D view, which is the exact inversion the phase
removes. It also keeps the module free of React and Three.js, which is what lets
the Phase 8 arithmetic be checked in bare Node.

**Why `scene/footprintGeometry.ts` sits in `scene/` even though it is geometry.**
Because it imports `THREE`. It is the *bridge*: the one file that knows both a
`BuildingFootprint` and a `BufferGeometry`, and it owns the shape-plane sign
convention and the rotation that must travel with it. Everything above it is
metres; everything below is meshes.

**Why `workflow/` is one file and not a folder of state machinery.** The pipeline
is derived state — a function of the model, not a thing tracked alongside it. One
pure function returning five records is the whole of it, and making it a module
rather than JSX is what stops a view from claiming a step is complete when the
model says it is not.

### Planned additions (later phases)

```
src/
└─ types/                 # Parcel, Building, Floor, Unit, Ulpin3D
```

`data/` and `map/` arrived in Phase 7 and are listed above as built. `types/` is
still outstanding: `BuildingConfig`, `ApartmentUnit` and `DemoParcel` are
expected to move there once they stop describing one building on one plot and
become nodes of `parcel → building → floor → unit`.

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
| `@react-three/drei` | `^10.0.0` | R3F helpers; only `OrbitControls` is used so far — the Phase 5 selection outline is plain Three.js (`EdgesGeometry`), not a drei helper |
| `@types/three` | `^0.180.0` | type definitions for Three.js |
| `leaflet` | `^1.9.4` | the 2D map engine; ships its own required stylesheet |
| `react-leaflet` | `^5.0.0` | React binding for Leaflet — v5 is the first line that requires React 19, which is why it matches this project |
| `@types/leaflet` | `^1.9.12` | type definitions for Leaflet; `react-leaflet` ships its own types but builds on these |
| `vite` | `^7.0.0` | dev server and production bundler |
| `@vitejs/plugin-react` | `^5.0.0` | teaches Vite to compile JSX and enable fast refresh |
| `typescript` | `^5.9.0` | type checking (`tsc --noEmit`, run as part of `npm run build`) |
| `@types/react`, `@types/react-dom` | `^19.1.0` | type definitions for React |

`npm run build` runs `tsc --noEmit && vite build`, so a type error fails the build
rather than shipping silently — Vite alone strips types without checking them.

**Phase 8 added no dependencies.** The extrusion uses `THREE.Shape` /
`ExtrudeGeometry` / `ShapeGeometry`, which ship with `three`; the generation
transition is plain `requestAnimationFrame`. The lockfile is unchanged by this
phase — the outstanding `npm install` is still Phase 7's.

---

## 12. Why we are building incrementally

The build is split into small phases, and **each phase must leave the project runnable, documented and committed** before the next one starts.

1. **This is a 48-hour prototype.** The real risk is not writing too little code — it is having a large amount of code that does not run an hour before the deadline. Small steps mean the broken thing is always the last small thing.
2. **Every phase is a recoverable checkpoint.** A commit that runs is a point to return to. Without checkpoints, a bad change means unpicking it by hand under time pressure.
3. **There is always something to demo.** From Phase 1 onward the project has a working URL. If time runs out, the prototype is smaller than planned but still complete and presentable — never half-built.
4. **Understanding, not just output.** Each phase is small enough to read, explain and defend to a judge. The point of the project is to understand the architecture, and that only happens if each piece is absorbed as it lands.
5. **Documentation stays true.** `PROJECT_STATUS.md` is updated at each checkpoint, so the project's state is a fact that has been verified, not a memory.
