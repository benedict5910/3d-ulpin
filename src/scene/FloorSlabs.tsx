import { useEffect, useMemo } from 'react'
import { EdgesGeometry } from 'three'

import { getFloorDisplayOffsetM, type ExplodeAmounts } from './explodedView'
import { getFloorEmphasis } from './floorIsolation'
import type { FloorLayout } from './buildingConfig'
import type { BuildingFootprint } from '../geometry/footprint'
import { createFloorSlabGeometry, FOOTPRINT_FLAT_ROTATION } from './footprintGeometry'

/**
 * The floor plates: one thin slab of the footprint at each floor's own elevation.
 *
 * WHY PHASE 9 ADDED THEM, AND WHY PHASE 4 REMOVED SOMETHING SIMILAR
 * Phase 3 drew full-height floor slabs and Phase 4 deleted them, because they
 * filled the same volume as the property units and z-fought with them. These are
 * not those. A plate here is **12 cm thick and sits on the floor's `baseY`** —
 * it occupies the boundary between two floors rather than the space inside one,
 * so it never intersects a unit. That is the difference between a slab that
 * competes with the model and one that describes it.
 *
 * They earn their place twice:
 *
 *   • In the generation animation they are the middle term. The envelope says
 *     "this plan has a height"; the plates say "that height is divided into five
 *     levels"; the units then say "each level is divided into four properties".
 *     Without them the sequence jumps from one volume to twenty boxes and the
 *     *stratification* — the actual subject of a vertical cadastre — is never
 *     shown on its own.
 *
 *   • In the exploded view they are what the eye follows. Four floating boxes
 *     read as four boxes; four boxes sitting on a plate read as a floor.
 *
 * The offset they are drawn at is a **display** offset. See `explodedView.ts`:
 * `floor.baseY` is a cadastral fact and is never modified.
 */

/** Slab thickness in metres. Structural presence, not occupiable space. */
const SLAB_THICKNESS_M = 0.12

/** Cool grey, a shade darker than the units it carries. */
const SLAB_COLOR = '#43596b'
/** The plate's edge — the line that makes a level read as a level. */
const SLAB_EDGE_COLOR = '#8fa8bd'

interface FloorSlabsProps {
  /** The footprint polygon, in metres, Three.js axes. */
  footprint: BuildingFootprint
  /** The floors, from `buildFloorLayouts`. One plate per entry. */
  floors: readonly FloorLayout[]
  /**
   * Per-floor reveal, `0`–`1`, indexed by 0-based floor index.
   *
   * Comes from the generation timeline. A plate at `0` is not rendered at all
   * rather than rendered invisibly — twenty transparent triangles that
   * contribute nothing still cost a draw call and a sort.
   */
  reveal: readonly number[]
  /**
   * How far each explosion has got. Display only — see `explodedView.ts`.
   *
   * A plate reads only the vertical component: a floor plate *is* the floor, so
   * there is nothing on it to move apart. It stays whole while the units
   * standing on it disperse, which is exactly what makes the unit explosion
   * legible — the properties leave, and the layer they belong to stays put.
   */
  explodeAmounts: ExplodeAmounts
  /** The 1-based floor the presenter has isolated, or `null`. */
  isolatedFloor: number | null
  /** How far the ghosting transition has got, `0`–`1`. */
  isolationAmount: number
}

function FloorSlabs({
  footprint,
  floors,
  reveal,
  explodeAmounts,
  isolatedFloor,
  isolationAmount,
}: FloorSlabsProps) {
  // Every floor of this prototype has the same plan, so one geometry serves all
  // of them — five meshes, one buffer. If floors ever differ, this becomes a
  // geometry per distinct plan, not a geometry per floor.
  const slabGeometry = useMemo(
    () => createFloorSlabGeometry(footprint, SLAB_THICKNESS_M),
    [footprint],
  )
  const edgeGeometry = useMemo(() => new EdgesGeometry(slabGeometry), [slabGeometry])

  // Geometries hold GPU buffers; React will not free them for us.
  useEffect(() => () => slabGeometry.dispose(), [slabGeometry])
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry])

  return (
    <group>
      {floors.map((floor) => {
        const revealed = reveal[floor.index] ?? 0
        if (revealed <= 0) return null

        const [, offsetY] = getFloorDisplayOffsetM(floor.index, explodeAmounts)
        const y = floor.baseY + offsetY

        // The plate ghosts with its floor. Keeping the plates at full strength
        // while their units faded would leave five bright slabs framing one
        // isolated layer — the opposite of the intended emphasis.
        const emphasis = getFloorEmphasis(floor.level, isolatedFloor, isolationAmount)

        return (
          // The group carries the module's rotation, exactly like the shell —
          // see `footprintGeometry.ts` for why that rotation and the shape's
          // sign convention must travel together.
          <group key={floor.level} position={[0, y, 0]} rotation={FOOTPRINT_FLAT_ROTATION}>
            <mesh geometry={slabGeometry} castShadow={emphasis.castsShadow} receiveShadow>
              <meshStandardMaterial
                color={SLAB_COLOR}
                roughness={0.75}
                metalness={0.04}
                transparent={revealed < 1 || emphasis.fillScale < 1}
                opacity={revealed * emphasis.fillScale}
                depthWrite={emphasis.fillScale >= 1}
              />
            </mesh>

            <lineSegments geometry={edgeGeometry}>
              <lineBasicMaterial
                color={SLAB_EDGE_COLOR}
                transparent
                opacity={0.45 * revealed * emphasis.edgeScale}
              />
            </lineSegments>
          </group>
        )
      })}
    </group>
  )
}

export default FloorSlabs
