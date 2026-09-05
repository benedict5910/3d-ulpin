/**
 * One shape the property inspector can render, whichever side of the ground
 * datum the selected volume is on.
 *
 * THE PROBLEM THIS SOLVES, AND THE ONE IT REFUSES TO SOLVE
 * An `ApartmentUnit` and an `UndergroundSpace` are different records — see the
 * header of `underground/undergroundLayout.ts` for why they are two types and
 * why merging them would break the four consumers that read `floorLevel` as "a
 * 1-based floor in the upward stack". But they are *inspected* identically: a
 * cadastral record panel asks the same eight questions of both, and a person
 * reading it is reading one register, not two.
 *
 * So the answer is **one inspector and one adapter**, not two inspectors. This
 * module is that adapter. It is pure data-shaping — no React, no JSX, no
 * decisions about presentation — and the panel that consumes it holds no
 * knowledge at all about which kind of record it is showing.
 *
 * The alternative, a `PropertyInspector` with two optional props and a fork
 * inside it, was rejected for the reason that fork always eventually pays: the
 * two branches drift, and one of them quietly stops showing the volume, or
 * shows the elevation to a different precision, and nobody notices because each
 * branch looks correct on its own.
 *
 * WHAT IS AND IS NOT DERIVED HERE
 * Every field is read off the record or computed from its bounds. Nothing is
 * re-derived from a *string*: the ownership chain is built from
 * `parentParcelId`, the level and the number as separate fields — never by
 * parsing the identifier those fields were used to build, which would invert
 * the real dependency.
 */

import { getUnitCenter, type ApartmentUnit } from '../scene/unitLayout'
import {
  getUndergroundSpaceCenter,
  type UndergroundSpace,
} from '../underground/undergroundLayout'

/** One rung of the ownership descent: a label and the value it narrows to. */
export interface HierarchyRung {
  readonly label: string
  readonly value: string
  /** Render in the monospace identifier face. Parcel identifiers only. */
  readonly mono?: boolean
}

/** The cadastral record of one 3D space, ready to be rendered as a panel. */
export interface SpaceRecord {
  /** The space's stable key — the same id the scene and the selection use. */
  readonly id: string
  /** The prototype 3D ULPIN. The terminus of the ownership chain. */
  readonly prototypeUlpin: string
  /**
   * The ownership descent, from parcel to this volume.
   *
   * Built here rather than in the component so that "what does a 3D ULPIN
   * derive from" is answered in one place for both kinds of space, and so the
   * component that draws the chain can stay a dumb list renderer.
   */
  readonly chain: readonly HierarchyRung[]
  /** `Residential`, `Parking Deck`, … — whatever the record calls its use. */
  readonly propertyType: string
  /** Floor area, square metres. */
  readonly areaSqM: number
  /** Enclosed volume, cubic metres. */
  readonly volumeCubicM: number

  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
  readonly zMin: number
  readonly zMax: number

  /** The centroid, `[x, y, z]` metres, from the same function the mesh uses. */
  readonly centroid: readonly [number, number, number]

  /**
   * Whether this volume lies below the ground datum.
   *
   * Read off the record's own marker, **not** inferred from a negative
   * elevation. A simulation can move a volume; it cannot change what kind of
   * record it is, and a panel that decided "underground" by looking at a sign
   * would relabel a property the moment a hypothetical encroachment pushed it
   * across zero.
   */
  readonly isUnderground: boolean
  /** The panel's heading: `Property Unit` or `Underground Property`. */
  readonly title: string
}

/** The cadastral record of one above-ground apartment unit. */
export function toSpaceRecord(unit: ApartmentUnit): SpaceRecord {
  return {
    id: unit.id,
    prototypeUlpin: unit.prototypeUlpin,
    chain: [
      { label: 'Parent parcel', value: unit.parentParcelId, mono: true },
      { label: 'Floor', value: `Floor ${unit.floorLevel}` },
      { label: 'Unit', value: unit.unitNumber },
    ],
    propertyType: unit.propertyType,
    areaSqM: unit.areaSqM,
    volumeCubicM: unit.volumeCubicM,
    xMin: unit.xMin,
    xMax: unit.xMax,
    yMin: unit.yMin,
    yMax: unit.yMax,
    zMin: unit.zMin,
    zMax: unit.zMax,
    centroid: getUnitCenter(unit),
    isUnderground: false,
    title: 'Property Unit',
  }
}

/**
 * The cadastral record of one underground space.
 *
 * The chain reads
 *
 *   Parent parcel → Basement 1 → Parking Deck · B1 → prototype 3D ULPIN
 *
 * which is the same descent as before the underground redesign, and the *same
 * shape* as the above-ground one: three narrowing rungs and an identifier at
 * the foot. The middle rung's label is `Level` rather than `Floor` and the last
 * `Space` rather than `Unit`, because those are what the register calls them
 * below the datum — but the structure of the claim, and the component that
 * draws it, do not change at all.
 *
 * The use is carried in the third rung alongside the number rather than being
 * left to the property-type row further down, because "Parking Deck" is the
 * thing a person actually identifies the space by, and a chain ending in a bare
 * `B1` would name the volume without saying what it is.
 *
 * `useLabel`, not `propertyType`, in both places: `Parking` is the cadastral
 * use the model records and `Parking Deck` is what a reader calls the thing.
 * The distinction is kept in the record (see `underground/undergroundLayout.ts`)
 * so the panel does not have to invent the prose.
 */
export function undergroundToSpaceRecord(space: UndergroundSpace): SpaceRecord {
  return {
    id: space.id,
    prototypeUlpin: space.prototypeUlpin,
    chain: [
      { label: 'Parent parcel', value: space.parentParcelId, mono: true },
      { label: 'Level', value: space.levelLabel },
      { label: 'Space', value: `${space.useLabel} · ${space.unitNumber}` },
    ],
    propertyType: space.useLabel,
    areaSqM: space.areaSqM,
    volumeCubicM: space.volumeCubicM,
    xMin: space.xMin,
    xMax: space.xMax,
    yMin: space.yMin,
    yMax: space.yMax,
    zMin: space.zMin,
    zMax: space.zMax,
    centroid: getUndergroundSpaceCenter(space),
    isUnderground: true,
    title: 'Underground Property',
  }
}

/**
 * Resolve one selected id to whichever record it names, on either side.
 *
 * **This is the whole of "one selection architecture".** `App` holds a single
 * `selectedUnitId: string | null` — exactly the state it held before this phase
 * — and asks this function what it points at. There is no second selection
 * state, no second clear-selection path, and no combination of the two that can
 * leave a unit and a space both selected.
 *
 * Above ground is tried first, arbitrarily but consistently: the two id spaces
 * are disjoint by construction (`unit-…` versus `underground-…`), so the order
 * decides nothing and only one branch can ever match.
 */
export function resolveSelectedRecord(
  units: readonly ApartmentUnit[],
  spaces: readonly UndergroundSpace[],
  selectedId: string | null,
): SpaceRecord | null {
  if (selectedId === null) return null

  const unit = units.find((candidate) => candidate.id === selectedId)
  if (unit !== undefined) return toSpaceRecord(unit)

  const space = spaces.find((candidate) => candidate.id === selectedId)
  if (space !== undefined) return undergroundToSpaceRecord(space)

  return null
}
