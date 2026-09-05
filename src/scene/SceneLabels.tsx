import { Html } from '@react-three/drei'

import type { FloorLayout } from './buildingConfig'
import {
  getFloorDisplayOffsetM,
  getUnitDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import type { FootprintMetrics } from '../geometry/footprint'
import { getUnitCenter, type ApartmentUnit } from './unitLayout'

/**
 * 3D labels — deliberately, restrictively few.
 *
 * THE RULE THIS FILE ENFORCES
 * A vertical cadastre with twenty units has twenty things that *could* be
 * labelled, five floors that could be labelled, and a footprint that could be
 * dimensioned. Doing any of that produces a scene where floating text is the
 * dominant visual element and the geometry — the actual subject — is what the
 * eye has to hunt for. Every planning tool that has ever looked amateurish
 * looked that way for this reason.
 *
 * So labels appear only where they answer a question the viewer is already
 * asking:
 *
 *   • **Floor labels (F1…F5)** appear *only in exploded view*. That is the one
 *     moment the strata are separated and unlabelled, and the one moment
 *     somebody needs to know which is which. Stacked, the floors are obviously
 *     in order and the labels would be noise.
 *
 *   • **The selected unit's label** appears only for the selected unit. It is
 *     the answer to "which box did I just click", asked at the moment the
 *     property inspector fills in on the other side of the screen — the two
 *     together are what tie a record to a volume.
 *
 * Nothing else is labelled. Not hovered units, not unselected units, not the
 * footprint, not the axes.
 *
 * WHY HTML AND NOT 3D TEXT
 * `<Html>` projects a DOM node to a 3D position. That means the labels are
 * styled by the same stylesheet as the rest of the interface, are crisp at every
 * zoom level, and inherit the project's typography instead of needing a font
 * atlas. `distanceFactor` scales them with perspective so they still read as
 * belonging to the scene rather than floating over it. They are
 * `pointer-events: none` throughout — a label must never intercept a click
 * meant for the unit underneath it, or an orbit drag.
 */

/** Perspective scaling for the labels. Larger = smaller text at a given range. */
const LABEL_DISTANCE_FACTOR = 26

/** How far outside the footprint's west edge the floor labels sit, in metres. */
const FLOOR_LABEL_OFFSET_M = 2.2

/** How far above the selected unit its label floats, in metres. */
const UNIT_LABEL_LIFT_M = 1.1

/** Below this the floors are essentially stacked and the labels stay away. */
const EXPLODED_LABEL_THRESHOLD = 0.08

/** Fallback plan centre. See the equivalent note in `Building.tsx`. */
const ORIGIN: PlanPoint = { x: 0, z: 0 }

interface SceneLabelsProps {
  /** The floors, from `buildFloorLayouts`. */
  floors: readonly FloorLayout[]
  /** The footprint measured once, by `App`. Places the floor labels. */
  footprintMetrics: FootprintMetrics
  /** The selected unit, or `null`. */
  selectedUnit: ApartmentUnit | null
  /**
   * How far each explosion has got. Gates the floor labels and offsets both.
   *
   * The unit label calls the same `getUnitDisplayOffsetM` as the mesh it names,
   * so it tracks its unit outward as the floor disperses instead of being left
   * hanging over the middle of the floor.
   */
  explodeAmounts: ExplodeAmounts
  /** Plan centre of each floor, keyed by 1-based floor level. */
  floorPlanCentres: ReadonlyMap<number, PlanPoint>
  /**
   * The 1-based floor the presenter has isolated, or `null`.
   *
   * A second reason to label floors, and a narrower one: when a layer has been
   * deliberately brought forward, naming *that* layer is useful even in the
   * stacked view. Naming the four ghosts around it is not, so only the isolated
   * floor gets a label in that case.
   */
  isolatedFloor: number | null
  /** Whether the building has settled. No labels during the transition. */
  isSettled: boolean
}

function SceneLabels({
  floors,
  footprintMetrics,
  selectedUnit,
  explodeAmounts,
  floorPlanCentres,
  isolatedFloor,
  isSettled,
}: SceneLabelsProps) {
  // Labels on a building that is still assembling itself would name things
  // before they exist. They wait.
  if (!isSettled) return null

  const explodedEnough = explodeAmounts.floors > EXPLODED_LABEL_THRESHOLD
  // Exploded: label every floor, because the strata are separated and
  // unlabelled. Isolated: label only the isolated one, because the rest are
  // context. Both: the explosion's rule wins, since every floor is legible.
  const labelledFloors = explodedEnough
    ? floors
    : isolatedFloor === null
      ? []
      : floors.filter((floor) => floor.level === isolatedFloor)

  const labelX = footprintMetrics.bounds.xMin - FLOOR_LABEL_OFFSET_M

  // The selected unit's label rides on the same offset as its mesh.
  const unitOffset =
    selectedUnit === null
      ? ([0, 0, 0] as const)
      : getUnitDisplayOffsetM(
          selectedUnit,
          floorPlanCentres.get(selectedUnit.floorLevel) ?? ORIGIN,
          explodeAmounts,
        )

  return (
    <group>
      {labelledFloors.map((floor) => (
          <Html
            key={floor.level}
            position={[
              labelX,
              floor.centerY + getFloorDisplayOffsetM(floor.index, explodeAmounts)[1],
              footprintMetrics.centroid.z,
            ]}
            center
            distanceFactor={LABEL_DISTANCE_FACTOR}
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none' }}
          >
            {/* Opacity follows the explosion, so the labels arrive with the gap
                that makes them necessary rather than popping in at a threshold. */}
            <span
              className={
                floor.level === isolatedFloor
                  ? 'scene-label scene-label-floor scene-label-isolated'
                  : 'scene-label scene-label-floor'
              }
              style={{
                opacity: explodedEnough
                  ? Math.min(1, explodeAmounts.floors * 1.6)
                  : 1,
              }}
            >
              F{floor.level}
            </span>
          </Html>
        ))}

      {selectedUnit && (
        <Html
          position={[
            getUnitCenter(selectedUnit)[0] + unitOffset[0],
            selectedUnit.yMax + UNIT_LABEL_LIFT_M + unitOffset[1],
            getUnitCenter(selectedUnit)[2] + unitOffset[2],
          ]}
          center
          distanceFactor={LABEL_DISTANCE_FACTOR}
          zIndexRange={[9, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="scene-label scene-label-unit">
            {selectedUnit.unitNumber}
            <span className="scene-label-sub">F{selectedUnit.floorLevel}</span>
          </span>
        </Html>
      )}
    </group>
  )
}

export default SceneLabels
