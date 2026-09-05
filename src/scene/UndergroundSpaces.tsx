import { useEffect, useMemo, useState } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import {
  getUndergroundSpaceCenter,
  type UndergroundSpace,
  type UndergroundSpaceType,
} from '../underground/undergroundLayout'
import type { DatumEmphasis } from '../underground/undergroundView'
import {
  buildBasementPlanCentres,
  getUndergroundDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import { getUnitStatus } from './unitStatus'

/**
 * The four underground property volumes, drawn below the ground datum.
 *
 * The below-ground sibling of `Building.tsx`, and deliberately built the same
 * way: one mesh per record, positioned from the record's own bounds, with a
 * shared edge geometry per distinct box size and the same
 * `stopPropagation`-on-hover discipline that stops a ray selecting every volume
 * it passes through.
 *
 * WHAT IT DOES NOT DO, AND WHY
 * It decides nothing. It does not know what a conflict is (it is handed
 * `conflictedUnitIds` by the engine), it does not decide whether it is
 * clickable (it is handed an emphasis from `underground/undergroundView.ts`),
 * and it does not compute where a space is drawn when the stack is exploded (it
 * calls the one shared `getUndergroundDisplayOffsetM`). It renders records.
 *
 * It also reuses `getUnitStatus` — the same conflict-outranks-selected-outranks-
 * hovered decision the units above ground use — rather than a second precedence
 * rule that could come to disagree with it. A disputed basement space and a
 * disputed apartment go red for the same reason, in the same order.
 */

/** Same visual shrink the units above use, so the two read as one model. */
const SPACE_VISUAL_GAP = 0.06

/** Fallback plan centre for a level with no measured extent. See `Building.tsx`. */
const ORIGIN: PlanPoint = { x: 0, z: 0 }

/**
 * A palette keyed by **use**, not by a checkerboard.
 *
 * Above ground the twenty units are all `Residential` and are distinguished by
 * a two-tone checker so that neighbours never share a shade. Down here the four
 * spaces have three genuinely different uses, so colour is spent on the fact
 * that actually differs — which is also what makes the property-type row in the
 * inspector verifiable by looking at the model.
 *
 * All three are darker and cooler than the slate above. That is the second job
 * the palette does: an audience should be able to tell which side of the datum
 * a volume is on without reading a label.
 */
const SPACE_COLORS: Readonly<Record<UndergroundSpaceType, string>> = {
  Parking: '#3d5468',
  Storage: '#4a4a63',
  Utility: '#3f5a54',
}

/** Selection appearance — the identical amber the units above ground use. */
const SELECTED_COLOR = '#d99b3f'
const SELECTED_EMISSIVE = '#6b4310'
const SELECTED_EMISSIVE_INTENSITY = 0.6
const SELECTION_OUTLINE_COLOR = '#f7d79b'

/** Hover, conflict: the same channels and the same precedence as above ground. */
const HOVER_EMISSIVE = '#22384d'
const HOVER_EMISSIVE_INTENSITY = 0.5
const IDLE_EMISSIVE = '#000000'
const CONFLICT_COLOR = '#c0453d'
const CONFLICT_EMISSIVE = '#5c1512'
const CONFLICT_EMISSIVE_INTENSITY = 0.75

/**
 * The edge colour underground: a warmer, brighter line than the units above.
 *
 * Under a ghosted ground plane the fill of a box loses most of its contrast, so
 * the edges are doing more of the work than they do above ground and they are
 * turned up accordingly. It is the same reasoning floor isolation uses when it
 * keeps edges at 0.55 while dropping fill to 0.18: what should survive a
 * translucent overlay is structure, drawn in line.
 */
const SPACE_EDGE_COLOR = '#b9c6d4'
const SPACE_EDGE_OPACITY = 0.42
const SELECTED_EDGE_OPACITY = 0.85
const CONFLICT_EDGE_COLOR = '#ff9b93'
const CONFLICT_EDGE_OPACITY = 0.9

/** A key that identifies a space's box size, for sharing edge geometry. */
function spaceSizeKey(space: UndergroundSpace): string {
  return `${space.width}:${space.height}:${space.depth}`
}

/**
 * A wireframe box on the selected space's **true** bounds.
 *
 * Identical in construction to `Building.tsx`'s `SelectionOutline`, including
 * the reason: the filled mesh is shrunk by `SPACE_VISUAL_GAP`, so a cage built
 * at full size sits proud of it and reads as a crisp edge rather than as
 * z-fighting. `EdgesGeometry` rather than a wireframe material, so the box's
 * twelve real edges are drawn and not each face's triangulation diagonal.
 */
function SelectionOutline({
  space,
  offset,
}: {
  space: UndergroundSpace
  /** The same display offset the space's own mesh was drawn with. */
  offset: readonly [number, number, number]
}) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(space.width, space.height, space.depth)
    const edges = new EdgesGeometry(box)
    box.dispose()
    return edges
  }, [space.width, space.height, space.depth])

  useEffect(() => () => geometry.dispose(), [geometry])

  const [centerX, centerY, centerZ] = getUndergroundSpaceCenter(space)

  return (
    <lineSegments
      position={[centerX + offset[0], centerY + offset[1], centerZ + offset[2]]}
      geometry={geometry}
      raycast={() => null}
    >
      <lineBasicMaterial color={SELECTION_OUTLINE_COLOR} />
    </lineSegments>
  )
}

interface UndergroundSpacesProps {
  /** The generated underground records. Read, never written. */
  spaces: readonly UndergroundSpace[]
  /** The id of the selected space, or `null`. The same id space as the units. */
  selectedUnitId: string | null
  /** Report a click. `App` decides what selection means, exactly as above ground. */
  onSpaceClick: (spaceId: string, event: ThreeEvent<MouseEvent>) => void
  /**
   * How strongly to draw these volumes and whether they are targets.
   *
   * From `underground/undergroundView.ts`. Passed in rather than derived here
   * so the renderer holds no opinion about when the basement matters.
   */
  emphasis: DatumEmphasis
  /**
   * Whether the generated model has settled.
   *
   * `false` for every frame of the generation transition, exactly as above
   * ground: the basement appears with the cadastre it belongs to, not before
   * it, and cannot be clicked while it is arriving.
   */
  revealed: boolean
  /** How far the two explosions have got. Display offset only. */
  explodeAmounts: ExplodeAmounts
  /** Ids the validation engine has flagged. Straight from the report. */
  conflictedUnitIds: readonly string[]
}

function UndergroundSpaces({
  spaces,
  selectedUnitId,
  onSpaceClick,
  emphasis,
  revealed,
  explodeAmounts,
  conflictedUnitIds,
}: UndergroundSpacesProps) {
  /** Which space the pointer is over. Local: nothing outside the canvas reacts. */
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null)

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedUnitId) ?? null,
    [spaces, selectedUnitId],
  )

  const conflicted = useMemo(() => new Set(conflictedUnitIds), [conflictedUnitIds])

  /**
   * The plan centre of each basement level, for the unit-level explosion.
   *
   * Measured from the volumes themselves by the same shared helper the floors
   * above use, so a volume disperses away from the middle of *its own level*
   * rather than from a constant. Display input only — see `explodedView.ts`.
   */
  const levelPlanCentres = useMemo(() => buildBasementPlanCentres(spaces), [spaces])

  /** One edge geometry per distinct size, not one per space. */
  const edgeGeometries = useMemo(() => {
    const geometries = new Map<string, EdgesGeometry>()

    for (const space of spaces) {
      const key = spaceSizeKey(space)
      if (geometries.has(key)) continue

      const box = new BoxGeometry(
        space.width - SPACE_VISUAL_GAP,
        space.height - SPACE_VISUAL_GAP,
        space.depth - SPACE_VISUAL_GAP,
      )
      geometries.set(key, new EdgesGeometry(box))
      box.dispose()
    }

    return geometries
  }, [spaces])

  useEffect(
    () => () => {
      for (const geometry of edgeGeometries.values()) geometry.dispose()
    },
    [edgeGeometries],
  )

  const isTargetable = revealed && emphasis.interactive

  /** Pointer affordance, and the cleanup that runs if targeting is withdrawn. */
  useEffect(() => {
    if (hoveredSpaceId === null || !isTargetable) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hoveredSpaceId, isTargetable])

  // Nothing below the datum until the cadastre above it exists. The basement is
  // part of the same generated record, so it arrives with it.
  if (!revealed) return null

  return (
    <group name="underground">
      {spaces.map((space) => {
        // The one shared display offset — the same call the selection cage and
        // the camera preset make, so the three cannot disagree about where this
        // volume is drawn. Downward, and visualisation only.
        const [offsetX, offsetY, offsetZ] = getUndergroundDisplayOffsetM(
          space,
          levelPlanCentres.get(space.basementLevel) ?? ORIGIN,
          explodeAmounts,
        )

        const [centerX, centerY, centerZ] = getUndergroundSpaceCenter(space)

        // The same decision function the units above ground use. See
        // `unitStatus.ts` for the precedence and why it lives in one place.
        const status = getUnitStatus(space.id, {
          conflictedUnitIds: conflicted,
          selectedUnitId,
          hoveredUnitId: hoveredSpaceId,
          isTargetable,
        })
        const isConflicted = status === 'conflict'
        const isSelected = status === 'selected'
        const isHovered = status === 'hovered'
        const showsCage = space.id === selectedUnitId

        const fillOpacity = emphasis.fillScale
        const isFullySolid = fillOpacity >= 1

        return (
          <mesh
            key={space.id}
            name={space.id}
            position={[centerX + offsetX, centerY + offsetY, centerZ + offsetZ]}
            castShadow={emphasis.castsShadow}
            receiveShadow
            onClick={(event: ThreeEvent<MouseEvent>) => onSpaceClick(space.id, event)}
            onPointerOver={(event: ThreeEvent<PointerEvent>) => {
              // The ray keeps going through this box and hitting the ones
              // behind it; without this every space along it would think it was
              // hovered.
              event.stopPropagation()
              if (!isTargetable) return
              setHoveredSpaceId(space.id)
            }}
            onPointerOut={() => {
              // Only clear if we are still the hovered one — moving between two
              // adjacent spaces can deliver the new `over` before this `out`.
              setHoveredSpaceId((current) => (current === space.id ? null : current))
            }}
          >
            <boxGeometry
              args={[
                space.width - SPACE_VISUAL_GAP,
                space.height - SPACE_VISUAL_GAP,
                space.depth - SPACE_VISUAL_GAP,
              ]}
            />
            <meshStandardMaterial
              color={
                isConflicted
                  ? CONFLICT_COLOR
                  : isSelected
                    ? SELECTED_COLOR
                    : SPACE_COLORS[space.propertyType]
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
              roughness={0.62}
              metalness={0.06}
              transparent={!isFullySolid}
              opacity={fillOpacity}
              // A translucent volume that writes depth hides what is behind it,
              // which is the whole point of drawing it translucently.
              depthWrite={isFullySolid}
            />

            <lineSegments
              geometry={edgeGeometries.get(spaceSizeKey(space))}
              raycast={() => null}
            >
              <lineBasicMaterial
                color={isConflicted ? CONFLICT_EDGE_COLOR : SPACE_EDGE_COLOR}
                transparent
                opacity={
                  (isConflicted
                    ? CONFLICT_EDGE_OPACITY
                    : showsCage
                      ? SELECTED_EDGE_OPACITY
                      : SPACE_EDGE_OPACITY) * emphasis.edgeScale
                }
              />
            </lineSegments>
          </mesh>
        )
      })}

      {selectedSpace && (
        <SelectionOutline
          space={selectedSpace}
          offset={getUndergroundDisplayOffsetM(
            selectedSpace,
            levelPlanCentres.get(selectedSpace.basementLevel) ?? ORIGIN,
            explodeAmounts,
          )}
        />
      )}
    </group>
  )
}

export default UndergroundSpaces
