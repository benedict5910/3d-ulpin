import { useEffect, useMemo } from 'react'
import { EdgesGeometry } from 'three'

import type { BuildingFootprint } from '../geometry/footprint'
import {
  createBuildingShellGeometry,
  FOOTPRINT_FLAT_ROTATION,
} from './footprintGeometry'

/**
 * The building envelope: the footprint polygon extruded to its full height.
 *
 * **This mesh is the vertical extrusion, rendered.** It is the middle step of
 * the pipeline made visible — plan, then volume, then subdivision — and it is
 * what the viewer shows in the moment between "here is a plot with an outline on
 * it" and "here are twenty individually identified properties".
 *
 * PHASE 9: IT NOW GROWS, AND IT IS ABSENT BEFORE GENERATION.
 * Two changes, both in service of the same point.
 *
 * First, `heightFraction`. The envelope is drawn at a fraction of its full
 * height and rises to it over the first half of the transition. **That rise is
 * the extrusion, animated** — the literal picture of a 2D plan becoming a 3D
 * volume, which is the one claim the prototype most needs to make legible in a
 * room. It is implemented as a *scale on the extrusion axis*, not as a rebuilt
 * geometry: rebuilding an `ExtrudeGeometry` on every frame would allocate and
 * discard a GPU buffer sixty times a second and would put the re-triangulation
 * of the plan inside the render loop. Scaling costs one matrix.
 *
 * The scale lands on the *group*, which already carries `FOOTPRINT_FLAT_ROTATION`.
 * That rotation maps shape-local Z — the extrusion axis — onto world Y, so a
 * local `[1, 1, f]` scale is a world height scale, and the extrusion's own base
 * at local `z = 0` keeps the building standing on the ground rather than
 * shrinking toward its middle. It applies to the wireframe edges in the same
 * group at the same time, which is why they are inside it.
 *
 * Second, `presence` starts at **0**. Phase 8 drew the envelope before the user
 * pressed anything; it no longer does. The pre-generation scene is purely 2D —
 * see `FootprintPad.tsx` for why that matters more than it sounds.
 *
 * WHY IT IS TRANSLUCENT, AND WHY IT DISAPPEARS
 * The twenty property units fill exactly this volume. Drawing both solidly would
 * put an opaque box around every apartment and z-fight with the outer faces, so
 * the shell is drawn as glass and faded out as the units grow in. It is a
 * *stage* in the transformation, not a permanent part of the model. The
 * wireframe edges are kept a little stronger than the fill because an outlined
 * volume reads as a volume even at very low opacity.
 *
 * The geometry is built by `footprintGeometry.ts`, which owns the shape-plane
 * sign convention and the rotation that lays it down. This component chooses
 * only how it looks and how far up it has got.
 */

/** Cool slate, the same family as the units it will become. */
const SHELL_COLOR = '#6d8399'
/** The envelope's edges — brighter, so the volume stays legible when nearly clear. */
const SHELL_EDGE_COLOR = '#9db6cc'

/**
 * A floor under the height scale.
 *
 * A scale of exactly zero collapses the matrix and produces degenerate normals,
 * which some drivers report as a warning and all of them render as nothing
 * useful. A millimetre of building is invisible and well-defined.
 */
const MINIMUM_HEIGHT_FRACTION = 0.001

interface BuildingShellProps {
  /** The footprint polygon, in metres, Three.js axes. */
  footprint: BuildingFootprint
  /** Full extrusion distance in metres — `numberOfFloors × floorHeight`. */
  totalHeightM: number
  /**
   * How far the envelope has risen, `0`–`1` of `totalHeightM`.
   *
   * The animated extrusion. `1` means the envelope stands at its true height.
   */
  heightFraction: number
  /**
   * How strongly to draw the envelope: `0` in the source state, up to `1` while
   * the volume is being formed, back to `0` once the units have taken its place.
   */
  presence: number
}

function BuildingShell({
  footprint,
  totalHeightM,
  heightFraction,
  presence,
}: BuildingShellProps) {
  // Built once at *full* height. The animation scales it; it never rebuilds.
  const shellGeometry = useMemo(
    () => createBuildingShellGeometry(footprint, totalHeightM),
    [footprint, totalHeightM],
  )

  const edgeGeometry = useMemo(() => new EdgesGeometry(shellGeometry), [shellGeometry])

  // Geometries hold GPU buffers; React will not free them for us.
  useEffect(() => () => shellGeometry.dispose(), [shellGeometry])
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry])

  // Fully faded out — the source state and the settled state alike. Skip the
  // draw calls entirely rather than rendering transparent triangles that
  // contribute nothing.
  if (presence <= 0) {
    return null
  }

  const scaleZ = Math.max(MINIMUM_HEIGHT_FRACTION, heightFraction)

  return (
    // The scale is local-Z, which this rotation turns into world height. The two
    // must stay on the same element: separating them would silently scale the
    // building along north-south instead of upward.
    <group rotation={FOOTPRINT_FLAT_ROTATION} scale={[1, 1, scaleZ]}>
      <mesh geometry={shellGeometry}>
        <meshStandardMaterial
          color={SHELL_COLOR}
          transparent
          opacity={0.18 * presence}
          roughness={0.35}
          metalness={0.12}
          // Without this the front faces hide the back ones and the envelope
          // stops reading as a transparent volume.
          depthWrite={false}
        />
      </mesh>

      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          color={SHELL_EDGE_COLOR}
          transparent
          opacity={0.6 * presence}
        />
      </lineSegments>
    </group>
  )
}

export default BuildingShell
