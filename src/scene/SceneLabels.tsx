import { Html } from '@react-three/drei'

import type { FloorLayout } from './buildingConfig'
import type { BasementLevelLayout } from './basementConfig'
import {
  getBasementExplodedOffsetM,
  getFloorDisplayOffsetM,
  getUndergroundDisplayOffsetM,
  getUnitDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import type { FootprintMetrics } from '../geometry/footprint'
import { getUnitCenter, type ApartmentUnit } from './unitLayout'
import {
  getUndergroundUnitCentre,
  type UndergroundUnit,
} from './basementLayout'
import {
  getUndergroundSpaceCenter,
  type UndergroundSpace,
} from '../underground/undergroundLayout'

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

/**
 * Below this the underground view has barely begun and the deck captions wait.
 *
 * The same idea as `EXPLODED_LABEL_THRESHOLD` and the same reason: a label
 * should arrive with the state that makes it necessary, not pop in the instant
 * a transition starts.
 */
const UNDERGROUND_LABEL_THRESHOLD = 0.08

/** How far above a deck's ceiling its caption floats, in metres. */
const DECK_LABEL_LIFT_M = 0.9

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

  /* ── Below ground (Phase 11) ─────────────────────────────────────────────── */

  /**
   * The basement levels, for the exploded-stack labels.
   *
   * They obey the same rule as the floor labels and for the same reason: a
   * basement level is labelled **only when the stack is separated**, because
   * that is the one moment a strip of boxes below the datum is ambiguous. Stacked,
   * it is obviously the level under the ground floor and `B1` would be noise.
   *
   * The pay-off is the exploded view's ladder reading top to bottom as
   * `F5 F4 F3 F2 F1` — the datum — `B1`, which is the full vertical stack with
   * its own legend.
   */
  basementLevels: readonly BasementLevelLayout[]
  /**
   * The selected **below-ground** volume, or `null`.
   *
   * A separate prop from `selectedUnit` rather than a union, because the label
   * reads a different pair of fields (`spaceCode` and `basementLevel`) and rides
   * on a different offset function. At most one of the two is ever non-null —
   * there is one selection — so the two blocks below are mutually exclusive in
   * practice without needing to say so.
   */
  selectedUndergroundUnit: UndergroundUnit | null
  /** Plan centre of each basement level, keyed by 1-based level. */
  basementPlanCentres: ReadonlyMap<number, PlanPoint>

  /**
   * The generated underground decks, for the `B1 · PARKING` captions.
   *
   * WHY THESE ARE LABELLED WHEN NOTHING ELSE UNSELECTED IS
   * The rule this file enforces is that a label appears only where it answers a
   * question the viewer is already asking. Underground, that question is asked
   * the moment the view goes below the datum: two identical grey slabs, one
   * above the other, with nothing on screen to say which is B1, which is B2, or
   * that either of them is parking. Above ground the geometry answers for
   * itself — a tower's floors are obviously in order. Below it, it does not.
   *
   * So the captions appear with the underground view (or with the explosion,
   * which separates the decks for the same reason) and are absent from the
   * ordinary above-ground view, where the volumes they name are buried and the
   * text would be floating over nothing.
   *
   * The caption text is `space.deckLabel` — a field of the record, composed at
   * the model layer. This component does not assemble it. See
   * `underground/undergroundLayout.ts`.
   */
  undergroundSpaces: readonly UndergroundSpace[]
  /** How far the underground transition has arrived, `0`–`1`. Gates the captions. */
  undergroundAmount: number
}

function SceneLabels({
  floors,
  footprintMetrics,
  selectedUnit,
  explodeAmounts,
  floorPlanCentres,
  isolatedFloor,
  isSettled,
  basementLevels,
  selectedUndergroundUnit,
  basementPlanCentres,
  undergroundSpaces,
  undergroundAmount,
}: SceneLabelsProps) {
  // Labels on a building that is still assembling itself would name things
  // before they exist. They wait.
  if (!isSettled) return null

  const explodedEnough = explodeAmounts.floors > EXPLODED_LABEL_THRESHOLD
  // Either state makes the decks worth naming: the underground view brings them
  // into the frame, the explosion pulls them apart. One opacity for both, so the
  // captions never flicker when a presenter uses the two together.
  const deckVisibility = Math.max(undergroundAmount, explodeAmounts.floors)
  const decksLabelled = deckVisibility > UNDERGROUND_LABEL_THRESHOLD
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

  // And the below-ground selection rides on its own — the same call
  // `Basement.tsx` places the mesh with, so the label cannot end up over where
  // the volume would have been.
  const undergroundOffset =
    selectedUndergroundUnit === null
      ? ([0, 0, 0] as const)
      : getUndergroundDisplayOffsetM(
          selectedUndergroundUnit,
          basementPlanCentres.get(selectedUndergroundUnit.basementLevel) ?? ORIGIN,
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

      {/* Basement levels, on the same west line as the floors so the whole stack
          reads as one column of labels through the datum rather than two lists
          that happen to be near each other. */}
      {explodedEnough &&
        basementLevels.map((level) => (
          <Html
            key={`b${level.level}`}
            position={[
              labelX,
              level.centerY + getBasementExplodedOffsetM(level.index, explodeAmounts.floors),
              footprintMetrics.centroid.z,
            ]}
            center
            distanceFactor={LABEL_DISTANCE_FACTOR}
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="scene-label scene-label-floor scene-label-basement"
              style={{ opacity: Math.min(1, explodeAmounts.floors * 1.6) }}
            >
              B{level.level}
            </span>
          </Html>
        ))}

      {/* The deck captions: `B1 · PARKING`, `B2 · PARKING`, each floating just
          above its own ceiling and riding the same display offset as the mesh
          it names, so an exploded deck takes its caption down with it. */}
      {decksLabelled &&
        undergroundSpaces.map((space) => {
          const [centreX, , centreZ] = getUndergroundSpaceCenter(space)
          const offset = getUndergroundDisplayOffsetM(
            space,
            basementPlanCentres.get(space.basementLevel) ?? ORIGIN,
            explodeAmounts,
          )

          return (
            <Html
              key={space.id}
              position={[
                centreX + offset[0],
                space.yMax - DECK_LABEL_LIFT_M + offset[1],
                centreZ + offset[2],
              ]}
              center
              distanceFactor={LABEL_DISTANCE_FACTOR}
              zIndexRange={[8, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <span
                className="scene-label scene-label-basement"
                style={{ opacity: Math.min(1, deckVisibility * 1.6) }}
              >
                {space.deckLabel}
              </span>
            </Html>
          )
        })}

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

      {selectedUndergroundUnit && (
        <Html
          position={[
            getUndergroundUnitCentre(selectedUndergroundUnit)[0] + undergroundOffset[0],
            // Above the volume's own ceiling, exactly as the apartment label sits
            // above its unit's. For an unexploded basement that puts it at the
            // ground datum, which is where a marker for a below-ground space
            // belongs: on the surface above it, like a manhole cover.
            selectedUndergroundUnit.yMax + UNIT_LABEL_LIFT_M + undergroundOffset[1],
            getUndergroundUnitCentre(selectedUndergroundUnit)[2] + undergroundOffset[2],
          ]}
          center
          distanceFactor={LABEL_DISTANCE_FACTOR}
          zIndexRange={[9, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="scene-label scene-label-unit scene-label-space">
            {selectedUndergroundUnit.spaceCode}
            <span className="scene-label-sub">B{selectedUndergroundUnit.basementLevel}</span>
          </span>
        </Html>
      )}
    </group>
  )
}

export default SceneLabels
