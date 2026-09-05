import { useEffect, useMemo, useState } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import {
  getUnitDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import { getFloorEmphasis } from './floorIsolation'
import { getUnitCenter, type ApartmentUnit } from './unitLayout'
import { getUnitStatus } from './unitStatus'
import {
  getConflictEmphasis,
  type ConflictFocus,
} from '../simulation/conflictPresentation'

/**
 * The building: a stack of floors, each subdivided into independent property
 * units, each individually selectable.
 *
 * Nothing here is hand-placed and nothing here is generated. The units arrive as
 * a prop, built once by `App`, so the inspector and the geometry are looking at
 * literally the same records rather than at two arrays that agree today. This
 * file is a pure renderer of that array.
 *
 * PHASE 9 GAVE IT THREE THINGS, ALL OF THEM PRESENTATION.
 *
 *   1. **A floor-by-floor reveal.** Each unit's visibility comes from its own
 *      floor's entry in `floorReveal`, so the building fills in bottom-up as a
 *      wave rather than fading in as a block. A unit grows *from its own floor
 *      slab upward* — scaled on Y with its base pinned to `yMin` — which is what
 *      makes the reveal read as construction rather than as a dissolve.
 *
 *   2. **An exploded-view offset.** Added to the drawn position and to nothing
 *      else. Subphase A extended it to all three axes: floors separate upward,
 *      and each unit slides outward from the middle of its own floor so the four
 *      properties on a level read as four owned volumes rather than one slab
 *      with lines on it. See `explodedView.ts` — the six bounds are cadastral
 *      facts and this component does not modify them, it only chooses where to
 *      put a mesh.
 *
 *   3. **Edge definition.** One `EdgesGeometry` per distinct unit size, shared
 *      across every unit of that size — twenty line meshes, one buffer. Crisp
 *      boundaries between properties is not decoration in a cadastral drawing;
 *      it is the drawing's subject.
 *
 * Everything above is a function of props. There is no animation state in this
 * file and no timer, which is what stops a reset mid-transition from leaving
 * half a building behind.
 */

/**
 * A purely cosmetic sliver shaved off every face of each unit box, in metres,
 * so the joints between neighbouring apartments read as dark lines instead of
 * seams that z-fight.
 *
 * It is applied to the *geometry size only*, symmetrically, so the mesh centre
 * stays at the true centre of the unit's bounds. Unit 301 still occupies
 * exactly 6–9 m vertically in the model even though its visible box is a few
 * centimetres smaller. The logical metre-based model is untouched; only the
 * pixels differ.
 */
const UNIT_VISUAL_GAP = 0.06

/**
 * Two near-identical shades of the same slate blue, alternated in a 3D
 * checkerboard so that no unit touches another of the same shade — not
 * side-to-side, not front-to-back, not floor-to-floor.
 *
 * The variation is deliberately restrained. Colour is a channel this project
 * needs for *state*: the resting palette stays quiet precisely so the selection
 * colour can mean something.
 */
const UNIT_COLORS = ['#5b7286', '#4d6376'] as const

/**
 * Selection appearance: a warm amber against the cold slate of everything else.
 *
 * Amber is chosen for the reason surveying and CAD tools tend to choose it — it
 * is the one hue that is unmistakably *not* part of a neutral building palette,
 * so a single amber box in a field of slate reads instantly without turning the
 * model into a colour chart. One colour is spent on one meaning: selected.
 */
const SELECTED_COLOR = '#d99b3f'
/** A gentle self-lit component, so a selected unit still reads in shadow. */
const SELECTED_EMISSIVE = '#6b4310'
const SELECTED_EMISSIVE_INTENSITY = 0.6
/** Wireframe cage drawn around the selected unit's true bounds. */
const SELECTION_OUTLINE_COLOR = '#f7d79b'

/**
 * Hover appearance: the resting colour, lifted by a faint cool glow.
 *
 * Deliberately weaker than selection, and in a different *kind* of channel —
 * hover brightens, selection changes hue and adds an outline. Hovering a unit
 * while another is selected can never make the hovered one look selected.
 */
const HOVER_EMISSIVE = '#22384d'
const HOVER_EMISSIVE_INTENSITY = 0.5

/** No emissive contribution at rest. */
const IDLE_EMISSIVE = '#000000'

/**
 * Conflict appearance: red, and it outranks everything.
 *
 * The ordering — conflict, then selected, then hovered, then normal — and the
 * reasoning behind it live in `unitStatus.ts`, which is also where the decision
 * is *made*. This file holds the colours the decision resolves to and nothing
 * else. Before Subphase E the same nested ternary appeared four times here, once
 * per material property, which is four chances for a unit's fill to say
 * "disputed" while its edges say "selected".
 */
const CONFLICT_COLOR = '#c0453d'
const CONFLICT_EMISSIVE = '#5c1512'
const CONFLICT_EMISSIVE_INTENSITY = 0.75

/** The quiet edge on every unit. Present, never loud. */
const UNIT_EDGE_COLOR = '#93a9bd'
const UNIT_EDGE_OPACITY = 0.24
/** The selected unit's edges are the same line, turned up. */
const SELECTED_EDGE_OPACITY = 0.75
/** A disputed unit's edges are brighter still, and red. */
const CONFLICT_EDGE_COLOR = '#ff9b93'
const CONFLICT_EDGE_OPACITY = 0.9

/** Below this a unit has not started appearing and is not drawn at all. */
const MINIMUM_REVEAL = 0.001

/**
 * Fallback plan centre for a floor with no recorded centre.
 *
 * Unreachable in practice — the centres are built from the same units array
 * being rendered — but a `Map.get` returns `undefined` and the alternative to a
 * named constant is a fresh object literal inside the render loop, twenty times
 * a frame.
 */
const ORIGIN: PlanPoint = { x: 0, z: 0 }

interface BuildingProps {
  /** The generated property units to draw — the display record. */
  units: readonly ApartmentUnit[]
  /** Id of the currently selected unit, or `null`. Owned by `App`. */
  selectedUnitId: string | null
  /**
   * Called when a unit mesh is clicked. The raw pointer event is passed along
   * because the decision of whether a click *counts* (as opposed to being the
   * tail end of an orbit drag) is made by the viewer, which is also what owns
   * the camera controls. This component reports "unit X was clicked"; it does
   * not decide what that means.
   */
  onUnitClick: (unitId: string, event: ThreeEvent<MouseEvent>) => void
  /**
   * Per-floor reveal, `0`–`1`, indexed by 0-based floor index.
   *
   * From the generation timeline. A unit reads its own floor's entry, which is
   * how a five-floor building animates as five steps with no per-unit state.
   */
  floorReveal: readonly number[]
  /** How far each explosion has got. Display offset only. */
  explodeAmounts: ExplodeAmounts
  /**
   * Plan centre of each floor, keyed by 1-based floor level.
   *
   * Built once by `App` from the units themselves. A unit's outward direction is
   * derived from where it sits relative to this point, which is why it is passed
   * in rather than recomputed per mesh: twenty units would otherwise re-measure
   * their floor twenty times, on every frame of the explosion.
   */
  floorPlanCentres: ReadonlyMap<number, PlanPoint>
  /**
   * Whether units may be hovered and clicked.
   *
   * False for every frame of the generation transition. A click on a
   * half-grown box would open a record for a property the animation has not
   * finished drawing — correct data, wrong moment, and indistinguishable from a
   * bug to anyone watching.
   *
   * Floor isolation narrows this further, per floor — see `isolatedFloor`.
   */
  interactive: boolean
  /**
   * The 1-based floor the presenter has isolated, or `null`.
   *
   * Isolation is *appearance and targeting*; the exploded view is *position*.
   * Neither reads the other, so all their combinations are defined — see
   * `floorIsolation.ts` for the priority rule and why it is stated rather than
   * discovered.
   */
  isolatedFloor: number | null
  /** How far the ghosting transition has got, `0`–`1`. */
  isolationAmount: number
  /**
   * Ids of units the validation engine has flagged as being in conflict.
   *
   * Comes straight from `TopologyReport.conflictedUnitIds` — the renderer does
   * not decide what a conflict is and has no way to invent one. That is what
   * ties the red boxes on screen to the engine's finding by *data* rather than
   * by a second hard-coded list that could drift out of step with it.
   */
  conflictedUnitIds: readonly string[]
  /**
   * The staged conflict, or `null` when none is being presented.
   *
   * Used here for exactly one thing: deciding which units are the *subject* of
   * the conflict and which are context. The renderer does not read the
   * intersection, the ghost or the displacement from it — those are drawn by
   * `ConflictOverlay`, outside this component, precisely so that nothing which
   * iterates the property units can reach geometry that is not a property.
   */
  conflictFocus: ConflictFocus | null
  /**
   * How far the conflict focus has arrived, `0`–`1`.
   *
   * A third independent reason a unit might be drawn less than solidly, and it
   * composes with the other two by multiplication rather than by overriding
   * them — the same rule floor isolation and the exploded view already follow.
   * At `0` this component renders exactly what it rendered before Phase 10.
   */
  conflictFocusAmount: number
}

/** A key that identifies a unit's box size, for sharing edge geometry. */
function unitSizeKey(unit: ApartmentUnit): string {
  return `${unit.width}:${unit.height}:${unit.depth}`
}

/**
 * A wireframe box drawn on the selected unit's **true** bounds.
 *
 * The filled mesh is shrunk by `UNIT_VISUAL_GAP`, so this cage — built at full
 * size — sits a few centimetres proud of it and reads as a crisp edge rather
 * than as z-fighting. It is also the part of the highlight that survives a
 * dark, oblique or backlit view of the model, where a colour change alone can
 * be ambiguous.
 *
 * `EdgesGeometry` keeps only the twelve real edges of the box; a `wireframe`
 * material would additionally draw each face's triangulation diagonal, which
 * looks like a rendering fault rather than a selection.
 */
function SelectionOutline({
  unit,
  offset,
}: {
  unit: ApartmentUnit
  /** The same display offset the unit's own mesh was drawn with. */
  offset: readonly [number, number, number]
}) {
  const geometry = useMemo(() => {
    const box = new BoxGeometry(unit.width, unit.height, unit.depth)
    const edges = new EdgesGeometry(box)
    // The box was only scaffolding for the edge extraction.
    box.dispose()
    return edges
  }, [unit.width, unit.height, unit.depth])

  // Geometries hold GPU buffers; React will not free them for us.
  useEffect(() => () => geometry.dispose(), [geometry])

  const [centerX, centerY, centerZ] = getUnitCenter(unit)

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

function Building({
  units,
  selectedUnitId,
  onUnitClick,
  floorReveal,
  explodeAmounts,
  floorPlanCentres,
  interactive,
  isolatedFloor,
  isolationAmount,
  conflictedUnitIds,
  conflictFocus,
  conflictFocusAmount,
}: BuildingProps) {
  /**
   * Which unit the pointer is over, if any.
   *
   * Local, not lifted: hover is a transient property of *this* viewport and
   * nothing outside the 3D scene reacts to it. Selection is lifted because the
   * inspector — an HTML sibling of the canvas — depends on it. The rule is that
   * state rises only as far as its readers, and no further.
   */
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null)

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  )

  /** The flagged ids as a set, so the per-unit test is O(1) rather than O(n). */
  const conflicted = useMemo(
    () => new Set(conflictedUnitIds),
    [conflictedUnitIds],
  )

  /**
   * One edge geometry per distinct unit size, not one per unit.
   *
   * Under the prototype's uniform grid that is a single buffer shared by all
   * twenty boxes. Keyed by size rather than assuming uniformity, so a building
   * with mixed unit sizes gets one buffer per size instead of silently drawing
   * the wrong cage.
   */
  const edgeGeometries = useMemo(() => {
    const geometries = new Map<string, EdgesGeometry>()

    for (const unit of units) {
      const key = unitSizeKey(unit)
      if (geometries.has(key)) continue

      const box = new BoxGeometry(
        unit.width - UNIT_VISUAL_GAP,
        unit.height - UNIT_VISUAL_GAP,
        unit.depth - UNIT_VISUAL_GAP,
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

  /**
   * Turn the OS cursor into a pointer while a unit is under the mouse.
   *
   * A WebGL canvas is a single DOM element, so the browser has no idea that
   * parts of it are "clickable"; the affordance has to be driven by hand from
   * the raycast result. The cleanup resets the cursor if the component unmounts
   * — or interactivity is withdrawn — while something is hovered, which the
   * pointer-out event would otherwise never get a chance to do.
   */
  useEffect(() => {
    if (hoveredUnitId === null || !interactive) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hoveredUnitId, interactive])

  return (
    <group>
      {units.map((unit) => {
        const floorIndex = unit.floorLevel - 1
        const reveal = floorReveal[floorIndex] ?? 1
        if (reveal <= MINIMUM_REVEAL) return null

        // The one shared display offset — the same call the selection cage, the
        // label and the camera preset make, so the four can never disagree about
        // where this property is drawn.
        const [offsetX, offsetY, offsetZ] = getUnitDisplayOffsetM(
          unit,
          floorPlanCentres.get(unit.floorLevel) ?? ORIGIN,
          explodeAmounts,
        )

        // A box's origin is its centre, so the centre — not a corner — is what
        // gets positioned. During the reveal the box is scaled on Y, so the
        // centre is placed to keep the *base* pinned to the unit's own `yMin`:
        // the property grows up out of its floor rather than expanding about its
        // middle. At reveal 1 this reduces exactly to the true centre.
        const [centerX, , centerZ] = getUnitCenter(unit)
        const visibleHeight = unit.height - UNIT_VISUAL_GAP
        const centerY =
          unit.yMin + UNIT_VISUAL_GAP / 2 + (visibleHeight * reveal) / 2 + offsetY

        // floorLevel is 1-based, so subtract 1 to get the stack index; adding it
        // to the grid coordinates flips the shade on every axis, including up.
        const shade = (unit.column + unit.row + floorIndex) % 2

        // How strongly this unit's floor is drawn, and whether it is a target.
        // Multiplies with everything else rather than overriding it.
        const emphasis = getFloorEmphasis(unit.floorLevel, isolatedFloor, isolationAmount)
        // And how strongly it is drawn given what the conflict is about. The two
        // multiply: isolating the conflict's floor ghosts the other four, and
        // focusing the conflict fades the two innocent units on *this* floor,
        // with neither mechanism aware of the other.
        const conflictEmphasis = getConflictEmphasis(
          unit.id,
          conflictFocus,
          conflictFocusAmount,
        )
        const fillScale = emphasis.fillScale * conflictEmphasis.fillScale
        const edgeScale = emphasis.edgeScale * conflictEmphasis.edgeScale
        const isTargetable = interactive && emphasis.interactive

        // One decision, made in one place. See `unitStatus.ts`.
        const status = getUnitStatus(unit.id, {
          conflictedUnitIds: conflicted,
          selectedUnitId,
          hoveredUnitId,
          isTargetable,
        })
        const isConflicted = status === 'conflict'
        const isSelected = status === 'selected'
        const isHovered = status === 'hovered'
        // A disputed unit the user has selected stays red, but must still show
        // which one it is — the cage answers a different question from the fill.
        const showsCage = unit.id === selectedUnitId

        const isSettled = reveal >= 1
        // Fade in over the first part of the growth, so a unit is never a
        // hard-edged sliver; by the time it has any real height it is opaque.
        const opacity = Math.min(1, reveal * 1.8)
        // Isolation scales what the reveal produced; the two are independent
        // reasons a unit might be less than solid, and they compose.
        const fillOpacity = opacity * fillScale
        const isFullySolid = isSettled && fillScale >= 1

        return (
          <mesh
            key={unit.id}
            name={unit.id}
            position={[centerX + offsetX, centerY, centerZ + offsetZ]}
            scale={[1, reveal, 1]}
            castShadow={emphasis.castsShadow}
            receiveShadow
            onClick={(event) => onUnitClick(unit.id, event)}
            onPointerOver={(event) => {
              // The ray passes through this box and keeps hitting the ones
              // behind it. Without this, every unit along the ray would think
              // it was hovered.
              event.stopPropagation()
              if (!isTargetable) return
              setHoveredUnitId(unit.id)
            }}
            onPointerOut={() => {
              // Only clear if we are still the hovered one: moving between two
              // adjacent units can deliver the new unit's `over` before this
              // unit's `out`, and an unconditional clear would erase it.
              setHoveredUnitId((current) => (current === unit.id ? null : current))
            }}
          >
            <boxGeometry
              args={[unit.width - UNIT_VISUAL_GAP, visibleHeight, unit.depth - UNIT_VISUAL_GAP]}
            />
            <meshStandardMaterial
              color={
                isConflicted
                  ? CONFLICT_COLOR
                  : isSelected
                    ? SELECTED_COLOR
                    : UNIT_COLORS[shade]
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
              roughness={0.55}
              metalness={0.08}
              // Transparent while this floor is still arriving *or* while it is
              // ghosted. With nothing isolated and the reveal finished the
              // material is opaque again and the rendering is exactly what
              // Phases 4–9 produced: no sorting, no depth-write compromise.
              transparent={!isFullySolid}
              opacity={fillOpacity}
              // A ghost that writes depth hides whatever is behind it, which
              // defeats the point of ghosting. Solid units still write. During
              // conflict focus this is also what lets the disputed volume be
              // seen *through* the faded properties around it.
              depthWrite={fillScale >= 1}
            />

            {/* Edge definition. A child of the mesh, so it inherits the same
                position and the same growth scale for free. `raycast` is
                disabled: a line has its own generous hit threshold and would
                otherwise add phantom hits around every unit. */}
            <lineSegments
              geometry={edgeGeometries.get(unitSizeKey(unit))}
              raycast={() => null}
            >
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
                  edgeScale
                }
              />
            </lineSegments>
          </mesh>
        )
      })}

      {/* The selection cage sits at the unit's true bounds, so it is only drawn
          once that unit has finished arriving — a cage around a half-grown box
          would describe a property that is not there yet. */}
      {selectedUnit && (floorReveal[selectedUnit.floorLevel - 1] ?? 1) >= 1 && (
        <SelectionOutline
          unit={selectedUnit}
          offset={getUnitDisplayOffsetM(
            selectedUnit,
            floorPlanCentres.get(selectedUnit.floorLevel) ?? ORIGIN,
            explodeAmounts,
          )}
        />
      )}
    </group>
  )
}

export default Building
