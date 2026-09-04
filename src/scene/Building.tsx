import { useEffect, useMemo, useState } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

import { getUnitCenter, type ApartmentUnit } from './unitLayout'

/**
 * The building: a stack of floors, each subdivided into independent property
 * units — and, since Phase 5, each unit individually selectable.
 *
 * Nothing here is hand-placed, and as of Phase 5 nothing here is *generated*
 * either. The units arrive as a prop. Before, this component called
 * `buildApartmentUnits` itself and so did the summary panel, which meant two
 * structurally identical arrays with different object identities. That was
 * harmless while everything was read-only, but selection makes identity matter:
 * the inspector must be able to display *the unit the user clicked*, not a
 * lookalike. So the array is now built once, above, and handed to whoever needs
 * it. This file is a pure renderer of that array.
 *
 * Phase 4 replaced the Phase 3 full-floor slabs. Those slabs are **gone**, not
 * hidden: the units now fill the same volume, and rendering both would mean an
 * opaque box sitting inside every apartment, z-fighting with it and making the
 * subdivision impossible to see. The visible structure between floors now comes
 * from the gap below, not from a separate slab mesh.
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
 * needs for *state*, and Phase 5 is where that debt is called in: the resting
 * palette stays quiet precisely so the two colours below can mean something.
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
const SELECTED_EMISSIVE_INTENSITY = 0.55
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

interface BuildingProps {
  /** The single generated array of property units, built once by the app. */
  units: ApartmentUnit[]
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
function SelectionOutline({ unit }: { unit: ApartmentUnit }) {
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
    <lineSegments position={[centerX, centerY, centerZ]} geometry={geometry}>
      <lineBasicMaterial color={SELECTION_OUTLINE_COLOR} />
    </lineSegments>
  )
}

function Building({ units, selectedUnitId, onUnitClick }: BuildingProps) {
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

  /**
   * Turn the OS cursor into a pointer while a unit is under the mouse.
   *
   * A WebGL canvas is a single DOM element, so the browser has no idea that
   * parts of it are "clickable"; the affordance has to be driven by hand from
   * the raycast result. The cleanup resets the cursor if the component
   * unmounts while something is hovered, which the pointer-out event would
   * otherwise never get a chance to do.
   */
  useEffect(() => {
    if (hoveredUnitId === null) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = ''
    }
  }, [hoveredUnitId])

  return (
    <group>
      {units.map((unit) => {
        // A box's origin is its centre, so the centre — not a corner — is what
        // gets positioned. It is computed from the unit's bounds, never stored.
        const [centerX, centerY, centerZ] = getUnitCenter(unit)

        // floorLevel is 1-based, so subtract 1 to get the stack index; adding it
        // to the grid coordinates flips the shade on every axis, including up.
        const shade = (unit.column + unit.row + (unit.floorLevel - 1)) % 2

        const isSelected = unit.id === selectedUnitId
        // Selection wins outright: a selected unit never shows hover styling.
        const isHovered = !isSelected && unit.id === hoveredUnitId

        return (
          <mesh
            key={unit.id}
            name={unit.id}
            position={[centerX, centerY, centerZ]}
            castShadow
            receiveShadow
            onClick={(event) => onUnitClick(unit.id, event)}
            onPointerOver={(event) => {
              // The ray passes through this box and keeps hitting the ones
              // behind it. Without this, every unit along the ray would think
              // it was hovered.
              event.stopPropagation()
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
              args={[
                unit.width - UNIT_VISUAL_GAP,
                unit.height - UNIT_VISUAL_GAP,
                unit.depth - UNIT_VISUAL_GAP,
              ]}
            />
            <meshStandardMaterial
              color={isSelected ? SELECTED_COLOR : UNIT_COLORS[shade]}
              emissive={
                isSelected
                  ? SELECTED_EMISSIVE
                  : isHovered
                    ? HOVER_EMISSIVE
                    : IDLE_EMISSIVE
              }
              emissiveIntensity={
                isSelected
                  ? SELECTED_EMISSIVE_INTENSITY
                  : isHovered
                    ? HOVER_EMISSIVE_INTENSITY
                    : 0
              }
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}

      {selectedUnit && <SelectionOutline unit={selectedUnit} />}
    </group>
  )
}

export default Building
