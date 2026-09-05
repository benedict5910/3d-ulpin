/**
 * The bridge from a cadastral polygon to Three.js geometry.
 *
 * This is the only file in the project that knows both `BuildingFootprint` and
 * `THREE`. Everything upstream of it is metres and arithmetic; everything
 * downstream is meshes. Keeping the crossing in one small module is what lets
 * the model layer stay runnable in bare Node while the renderer still gets real
 * extruded geometry.
 *
 * THE PLANE PROBLEM, AND THE ONE SIGN THAT SOLVES IT
 * `THREE.Shape` is a **2D** path and it lives in the XY plane; `ExtrudeGeometry`
 * pushes it along **+Z**. Our footprint lives in the *world's* XZ plane and must
 * be extruded along **+Y**. So the geometry has to be built flat and then laid
 * down, and laying it down is where a sign quietly goes wrong.
 *
 * Rotating by −90° about X maps shape-local coordinates to world like this:
 *
 *     (xLocal, yLocal, zLocal)  ──rotate −90° about X──►  (xLocal, zLocal, −yLocal)
 *
 * Read the three columns:
 *
 *   • `xLocal` becomes world X.               ✔ footprint x goes straight through
 *   • `zLocal` — the extrusion depth — becomes world Y.  ✔ the building rises
 *   • `yLocal` becomes world Z **negated**.   ✘ north and south would swap
 *
 * The third line is the trap. Feeding the shape `y = point.z` would mirror the
 * building along the north-south axis relative to the property units, which are
 * built from the footprint's raw `z`. On a symmetric demo rectangle that mirror
 * is invisible — it would ship, and it would surface much later on the first
 * asymmetric plan, as a building that is subtly the wrong way round.
 *
 * So the shape is authored with **`y = −point.z`**, which the rotation negates
 * back to `+point.z`. One deliberate sign, stated once, explained here, with
 * `FOOTPRINT_FLAT_ROTATION` next to it so the two can never be applied apart.
 *
 * Every function below **creates** a geometry. Geometries hold GPU buffers that
 * React will not free, so each caller is responsible for disposing what it
 * makes — see the `useEffect` cleanups in the components that use these.
 */

import { BufferGeometry, ExtrudeGeometry, Shape, ShapeGeometry, Vector3 } from 'three'

import type { BuildingFootprint } from '../geometry/footprint'

/**
 * The rotation that lays a shape-plane geometry flat on the ground.
 *
 * −90° about X. Must be applied to anything built by this module, and must be
 * applied to *nothing else* — a second rotation elsewhere would double it.
 */
export const FOOTPRINT_FLAT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0]

/**
 * Turn a footprint polygon into a `THREE.Shape`.
 *
 * The ring is treated as implicitly closed — `Shape` closes the path itself
 * when it is triangulated — so the opening vertex is not repeated.
 *
 * Note the `-point.z`: see the plane discussion at the top of this file. It is
 * not a coordinate-system preference, it is the inverse of the rotation this
 * module's geometry is rendered with.
 */
export function createFootprintShape(footprint: BuildingFootprint): Shape {
  if (footprint.length < 3) {
    throw new Error(
      `[3D ULPIN] cannot build a shape from a ${footprint.length}-vertex footprint.`,
    )
  }

  const shape = new Shape()

  shape.moveTo(footprint[0].x, -footprint[0].z)
  for (let index = 1; index < footprint.length; index++) {
    shape.lineTo(footprint[index].x, -footprint[index].z)
  }
  shape.closePath()

  return shape
}

/**
 * A flat, filled slab of the footprint — the 2D cadastral polygon, in 3D.
 *
 * This is the object that makes the phase legible on screen: before anything is
 * generated, the viewer shows *the footprint from the GIS layer* lying on the
 * ground, and it is demonstrably the same ring the map draws. `ShapeGeometry`
 * triangulates an arbitrary polygon (earcut, internally), so an L-shaped plan
 * would render correctly here with no change — the rectangular assumption in
 * this project lives in the unit subdivision, not in the drawing of the plan.
 */
export function createFootprintPadGeometry(footprint: BuildingFootprint): ShapeGeometry {
  return new ShapeGeometry(createFootprintShape(footprint))
}

/**
 * The building's full shell: the footprint extruded to its total height.
 *
 * **This is the vertical extrusion, and it is one line of geometry.** A
 * cadastral plan plus a height is a volume; `ExtrudeGeometry` is the operation
 * that says so. The prototype uses the shell as the *envelope* — the volume the
 * building will occupy — and then fills that envelope with individually
 * identified property units. Showing the envelope first and the subdivision
 * second is the clearest way to explain what a 3D cadastre is: the same plan,
 * carried upward, then cut into ownable pieces.
 *
 * `bevelEnabled: false` because a bevel would round the walls by a few
 * centimetres and quietly falsify the geometry. `steps: 1` because a uniform
 * extrusion needs no intermediate rings — the floor divisions are property
 * boundaries, not mesh subdivisions.
 *
 * @param totalHeightM the extrusion distance in metres — `numberOfFloors ×
 *   floorHeight`, supplied by the caller because height is *not* a property of
 *   the footprint. That separation is the whole reason the two are different
 *   parameters and different modules.
 */
export function createBuildingShellGeometry(
  footprint: BuildingFootprint,
  totalHeightM: number,
): ExtrudeGeometry {
  return new ExtrudeGeometry(createFootprintShape(footprint), {
    depth: totalHeightM,
    bevelEnabled: false,
    steps: 1,
  })
}

/**
 * One floor plate: the footprint extruded to a slab a few centimetres thick.
 *
 * PHASE 9. The generation animation needs a middle term between "an empty
 * envelope" and "twenty property boxes" — something that says *the volume is
 * being divided into levels* before it says *the levels are divided into
 * properties*. A floor plate is that term, and it is also the thing an exploded
 * view separates: when the floors slide apart, what the eye follows is the
 * plates, not the apartments sitting on them.
 *
 * It is the same operation as the shell with a different depth, deliberately so.
 * A floor plate and a building envelope are both "this plan, carried upward by
 * some distance"; writing them as two calls to one function is the honest
 * account of that, and it means the sign convention and the rotation are settled
 * once for both.
 *
 * The slab is built from `0` to `thicknessM` in the shape plane, so — after
 * `FOOTPRINT_FLAT_ROTATION` — its underside sits at the group's own `y`. Place
 * the group at a floor's `baseY` and the plate rests exactly on that floor's
 * recorded elevation.
 *
 * @param thicknessM slab thickness in metres. Structural rather than cadastral:
 *   it exists so the plate reads as a solid from a low angle, and it is small
 *   enough not to be mistaken for occupiable space.
 */
export function createFloorSlabGeometry(
  footprint: BuildingFootprint,
  thicknessM: number,
): ExtrudeGeometry {
  return new ExtrudeGeometry(createFootprintShape(footprint), {
    depth: thicknessM,
    bevelEnabled: false,
    steps: 1,
  })
}

/**
 * The footprint's outline as a ring of world-space points.
 *
 * Used for the line that traces the plan on the ground. Built in **world**
 * coordinates rather than in the shape plane, so it is drawn *without*
 * `FOOTPRINT_FLAT_ROTATION` — hence `point.z` here rather than `-point.z`. The
 * two conventions sit side by side on purpose: this is the one place where
 * getting them the same way round would be the bug.
 *
 * The ring is **not** closed by repeating the first vertex, matching the
 * `BuildingFootprint` contract. It must therefore be drawn with a `lineLoop`,
 * which closes it; a plain `line` would leave one edge missing.
 *
 * @param elevationM height above ground to draw the loop at, in metres. A
 *   centimetre or two, so it does not z-fight with the ground plane.
 */
export function createFootprintOutlineGeometry(
  footprint: BuildingFootprint,
  elevationM: number,
): BufferGeometry {
  return new BufferGeometry().setFromPoints(
    footprint.map((point) => new Vector3(point.x, elevationM, point.z)),
  )
}
