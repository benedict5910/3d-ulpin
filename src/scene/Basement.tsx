import { useEffect, useMemo, useState } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import {
  getUndergroundDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import {
  CONFLICT_COLOR,
  CONFLICT_EDGE_COLOR,
  CONFLICT_EDGE_OPACITY,
  CONFLICT_EMISSIVE,
  CONFLICT_EMISSIVE_INTENSITY,
  HOVER_EMISSIVE,
  HOVER_EMISSIVE_INTENSITY,
  IDLE_EMISSIVE,
  SELECTED_COLOR,
  SELECTED_EDGE_OPACITY,
  SELECTED_EMISSIVE,
  SELECTED_EMISSIVE_INTENSITY,
  SELECTION_OUTLINE_COLOR,
  UNIT_EDGE_COLOR,
  UNIT_EDGE_OPACITY,
} from './palette'
import { getBasementEmphasis } from './undergroundView'
import { getUnitStatus } from './unitStatus'
import {
  getUndergroundUnitCentre,
  type UndergroundUnit,
} from './basementLayout'

/**
 * The basement: below-ground property volumes, each independently identified and
 * selectable — the same thing `Building.tsx` draws, on the other side of the
 * ground datum.
 *
 * WHY A SECOND COMPONENT RATHER THAN A FLAG ON THE FIRST
 * The two render loops are close cousins and the temptation to merge them is
 * real. They are separate because what they iterate is separate: `Building` maps
 * `ApartmentUnit[]` and reads `floorLevel`, this maps `UndergroundUnit[]` and
 * reads `basementLevel`, and neither array contains a member of the other. A
 * single component over the union would have to narrow the tier on every access —
 * once for the offset, once for the shade, once for the reveal, once for the
 * label — which is four branches to keep in step rather than one boundary to
 * cross.
 *
 * What they genuinely share, they share by importing rather than by copying:
 *
 *   · `unitStatus.ts`        the conflict → selected → hovered → normal ordering
 *   · `palette.ts`           what each of those states resolves to
 *   · `explodedView.ts`      the normalised outward displacement
 *   · the six-bounds model, the epsilon, the validator
 *
 * So a selected parking bay is the same amber as a selected apartment, a disputed
 * basement volume is the same red as a disputed flat, and the priority between
 * them is decided in one file for both tiers.
 *
 * WHAT IS DIFFERENT, AND WHY IT IS ONLY THE RESTING COLOUR
 * The brief asked for restraint here and it is worth stating why. The obvious
 * treatment for "underground" is a distinct hue — violet, teal, something that
 * announces itself. It would be wrong. Colour in this scene is spent on *state*:
 * amber means selected, red means disputed, and everything else is quiet
 * precisely so those two can be loud. Giving the basement its own hue would spend
 * a third channel on a fact the geometry already states unambiguously — the
 * volumes are **below the ground plane**, which is the least ambiguous statement
 * a 3D view can make.
 *
 * So the basement is the resting palette, **desaturated and warmed a little**:
 * the same building material, out of the daylight. It reads as continuous with
 * the structure above it, which is the substantive claim — one parcel, one
 * column of property, the surface merely passing through the middle of it.
 *
 * Everything here is a function of props. No animation state, no timers.
 */

/** The cosmetic sliver shaved off each face, exactly as above ground. */
const SPACE_VISUAL_GAP = 0.06

/**
 * Two near-identical warm greys, alternated in a checkerboard so no volume
 * touches another of the same shade.
 *
 * Cooler and bluer would make the basement look like more building; warmer and
 * darker makes it read as *below* — the colour of a lit concrete undercroft
 * rather than of a facade. It is one step of saturation away from the slate above
 * and no steps of hue, which is the whole of the tier's visual identity.
 */
const SPACE_COLORS = ['#6b6a66', '#5c5b58'] as const

/** Below this a volume has not started appearing and is not drawn at all. */
const MINIMUM_REVEAL = 0.001

/** Fallback plan centre for a level with no recorded centre. */
const ORIGIN: PlanPoint = { x: 0, z: 0 }

interface BasementProps {
  /** The generated below-ground volumes to draw. */
  units: readonly UndergroundUnit[]
  /** Id of the currently selected volume, or `null`. Owned by `App`, shared with
   *  the surface building — one selection across both tiers. */
  selectedUnitId: string | null
  /** Report a click upward. The viewer decides whether it counts as a click. */
  onUnitClick: (unitId: string, event: ThreeEvent<MouseEvent>) => void
  /**
   * How far the basement has been revealed by the generation animation, `0`–`1`.
   *
   * A single scalar rather than a per-level array, because the demo excavation is
   * one level and because the basement is revealed **with the ground floor**
   * rather than on a schedule of its own: `App` passes floor 1's own reveal. That
   * is the honest pairing — the ground floor and the level it stands on are the
   * same moment in the transformation, and giving the basement its own stage
   * would be inventing a construction sequence the model does not describe.
   */
  reveal: number
  /** How far each explosion has got. Display offset only — see `explodedView.ts`. */
  explodeAmounts: ExplodeAmounts
  /** Plan centre of each basement level, keyed by 1-based level. Built by `App`. */
  levelPlanCentres: ReadonlyMap<number, PlanPoint>
  /** Whether volumes may be hovered and clicked at all. False mid-generation. */
  interactive: boolean
  /**
   * Ids the validation engine has flagged as being in conflict.
   *
   * The **same list** the surface building is given, straight from
   * `TopologyReport.conflictedUnitIds`. Because the engine now sweeps both tiers
   * in one pass, a basement volume that interpenetrated a ground-floor flat would
   * appear in this list and be painted red here with no code in this file knowing
   * that cross-tier conflicts are a category of thing.
   */
  conflictedUnitIds: readonly string[]
  /** How far the underground view has arrived, `0`–`1`. See `undergroundView.ts`. */
  undergroundAmount: number
}

/** A key identifying a volume's box size, for sharing edge geometry. */
function spaceSizeKey(unit: UndergroundUnit): string {
  return `${unit.width}:${unit.height}:${unit.depth}`
}

/**
 * A wireframe box on the selected volume's **true** bounds.
 *
 * The below-ground twin of `Building.tsx`'s `SelectionOutline`, kept local for
 * the same reason the render loops are separate: it takes an `UndergroundUnit`
 * and calls that type's own centre accessor. The twenty lines are duplicated; the
 * *decision* — that selection is shown by a cage at full size, in
 * `SELECTION_OUTLINE_COLOR` — is not, because both read it from `palette.ts`.
 */
function SelectionOutline({
  unit,
  offset,
}: {
  unit: UndergroundUnit
  offset: readonly [number, number, number]
}) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(unit.width, unit.height, unit.depth)
    const edges = new EdgesGeometry(box)
    box.dispose()
    return edges
  }, [unit.width, unit.height, unit.depth])

  useEffect(() => () => geometry.dispose(), [geometry])

  const [centreX, centreY, centreZ] = getUndergroundUnitCentre(unit)

  return (
    <lineSegments
      position={[centreX + offset[0], centreY + offset[1], centreZ + offset[2]]}
      geometry={geometry}
      raycast={() => null}
    >
      <lineBasicMaterial color={SELECTION_OUTLINE_COLOR} />
    </lineSegments>
  )
}

function Basement({
  units,
  selectedUnitId,
  onUnitClick,
  reveal,
  explodeAmounts,
  levelPlanCentres,
  interactive,
  conflictedUnitIds,
  undergroundAmount,
}: BasementProps) {
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  )

  const conflicted = useMemo(() => new Set(conflictedUnitIds), [conflictedUnitIds])

  /** One edge geometry per distinct volume size, not one per volume. */
  const edgeGeometries = useMemo(() => {
    const geometries = new Map<string, EdgesGeometry>()

    for (const unit of units) {
      const key = spaceSizeKey(unit)
      if (geometries.has(key)) continue

      const box = new BoxGeometry(
        unit.width - SPACE_VISUAL_GAP,
        unit.height - SPACE_VISUAL_GAP,
        unit.depth - SPACE_VISUAL_GAP,
      )
      geometries.set(key, new EdgesGeometry(box))
      box.dispose()
    }

    return geometries
  }, [units])

  useEffect(
    () => () => {
      for (const geometry of edgeGeometries.values()) geometry.dispose()
    },
    [edgeGeometries],
  )

  useEffect(() => {
    if (hoveredUnitId === null || !interactive) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hoveredUnitId, interactive])

  if (reveal <= MINIMUM_REVEAL) return null

  // Constant today — the basement is not dimmed when the underground view is off,
  // it is hidden **by the ground**, which is what hides a real basement. The call
  // is made anyway so both tiers are placed by the same shaped code and a future
  // "dim the deeper levels" decision has an obvious home.
  const tierEmphasis = getBasementEmphasis(undergroundAmount)

  return (
    <group>
      {units.map((unit) => {
        const [offsetX, offsetY, offsetZ] = getUndergroundDisplayOffsetM(
          unit,
          levelPlanCentres.get(unit.basementLevel) ?? ORIGIN,
          explodeAmounts,
        )

        // The box grows **upward from its own floor** — from `yMin`, which is
        // −3 m — exactly as an apartment grows from its slab. Below ground that
        // reads as excavation being lined rather than as a box materialising, and
        // it is the same arithmetic: at reveal 1 it reduces to the true centre.
        const [centreX, , centreZ] = getUndergroundUnitCentre(unit)
        const visibleHeight = unit.height - SPACE_VISUAL_GAP
        const centreY =
          unit.yMin + SPACE_VISUAL_GAP / 2 + (visibleHeight * reveal) / 2 + offsetY

        // Checkerboard across the level, and across levels if there is more than
        // one, so no two adjacent volumes share a shade.
        const shade = (unit.column + unit.row + unit.levelIndex) % 2

        const isTargetable = interactive && tierEmphasis.interactive

        // The same decision function the surface building calls, with the same
        // priority ordering. See `unitStatus.ts`.
        const status = getUnitStatus(unit.id, {
          conflictedUnitIds: conflicted,
          selectedUnitId,
          hoveredUnitId,
          isTargetable,
        })
        const isConflicted = status === 'conflict'
        const isSelected = status === 'selected'
        const isHovered = status === 'hovered'
        const showsCage = unit.id === selectedUnitId

        const isSettled = reveal >= 1
        const opacity = Math.min(1, reveal * 1.8)
        const fillOpacity = opacity * tierEmphasis.fillScale
        const isFullySolid = isSettled && tierEmphasis.fillScale >= 1

        return (
          <mesh
            key={unit.id}
            name={unit.id}
            position={[centreX + offsetX, centreY, centreZ + offsetZ]}
            scale={[1, reveal, 1]}
            // The basement never casts: it sits below the only shadow-casting
            // light's ground plane, so its shadow would fall nowhere meaningful.
            castShadow={false}
            receiveShadow
            onClick={(event) => onUnitClick(unit.id, event)}
            onPointerOver={(event) => {
              event.stopPropagation()
              if (!isTargetable) return
              setHoveredUnitId(unit.id)
            }}
            onPointerOut={() => {
              setHoveredUnitId((current) => (current === unit.id ? null : current))
            }}
          >
            <boxGeometry
              args={[
                unit.width - SPACE_VISUAL_GAP,
                visibleHeight,
                unit.depth - SPACE_VISUAL_GAP,
              ]}
            />
            <meshStandardMaterial
              color={
                isConflicted
                  ? CONFLICT_COLOR
                  : isSelected
                    ? SELECTED_COLOR
                    : SPACE_COLORS[shade]
              }
              emissive={
                isConflicted
                  ? CONFLICT_EMISSIVE
                  : isSelected
                    ? SELECTED_EMISSIVE
                    : isHovered
                      ? HOVER_EMISSIVE
                      : IDLE_EMISSIVE
              }
              emissiveIntensity={
                isConflicted
                  ? CONFLICT_EMISSIVE_INTENSITY
                  : isSelected
                    ? SELECTED_EMISSIVE_INTENSITY
                    : isHovered
                      ? HOVER_EMISSIVE_INTENSITY
                      : 0
              }
              // Rougher and less metallic than the facade above: this is concrete
              // in artificial light, not a clad elevation in the sun.
              roughness={0.82}
              metalness={0.03}
              transparent={!isFullySolid}
              opacity={fillOpacity}
              depthWrite={tierEmphasis.fillScale >= 1}
            />

            <lineSegments geometry={edgeGeometries.get(spaceSizeKey(unit))} raycast={() => null}>
              <lineBasicMaterial
                color={isConflicted ? CONFLICT_EDGE_COLOR : UNIT_EDGE_COLOR}
                transparent
                opacity={
                  (isConflicted
                    ? CONFLICT_EDGE_OPACITY
                    : showsCage
                      ? SELECTED_EDGE_OPACITY
                      : UNIT_EDGE_OPACITY) *
                  opacity *
                  tierEmphasis.edgeScale
                }
              />
            </lineSegments>
          </mesh>
        )
      })}

      {selectedUnit && reveal >= 1 && (
        <SelectionOutline
          unit={selectedUnit}
          offset={getUndergroundDisplayOffsetM(
            selectedUnit,
            levelPlanCentres.get(selectedUnit.basementLevel) ?? ORIGIN,
            explodeAmounts,
          )}
        />
      )}
    </group>
  )
}

export default Basement
