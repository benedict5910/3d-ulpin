/**
 * The topology validation engine.
 *
 * **This is real spatial validation, not a green tick.** Every result below is
 * produced by measuring the model: rays are cast, edges are tested for crossing,
 * every pair of ownership volumes is intersected. A check can fail, and the
 * conflict simulation in the next subphase exists precisely to prove that it
 * does — by breaking the geometry and letting this engine find the break rather
 * than being told about it.
 *
 * WHAT IT IS POINTED AT, AND WHAT IT MUST NEVER BE POINTED AT
 * The engine validates **logical cadastral geometry**: the six bounds a property
 * record holds. It has no import path to `scene/explodedView.ts` or
 * `scene/floorIsolation.ts`, and that is deliberate rather than incidental — see
 * ARCHITECTURE §10.0. Exploded coordinates are a way of *drawing* the record,
 * and separating things on screen is exactly what makes overlaps disappear, so a
 * validator handed display positions would report a valid building as invalid and
 * an invalid one as fine. The module graph makes that mistake unavailable.
 *
 * It *is* pointed at whatever unit array it is given, which is how the
 * conflict simulation works: the simulation produces a modified array, the
 * engine is handed that array, and it discovers the overlap with no knowledge
 * that a simulation exists.
 *
 * WHAT IT DOES NOT DO
 * No repair, no suggestion, no auto-correction. It reports. A validator that
 * silently fixed what it found would make the record depend on the order things
 * were loaded in, which is the opposite of what a register is for.
 *
 * No React, no Three.js.
 */

import {
  getVolumeIntersection,
  isWithinVerticalRange,
  OVERLAP_EPSILON_M,
  type Box3D,
} from './aabb'
import {
  isPointInsideOrOnRing,
  isRingInsideRing,
  isSimpleRing,
  type Point2D,
  type Ring2D,
} from './geometry2d'
import {
  summariseResults,
  type TopologyReport,
  type ValidationResult,
} from './types'

/** The minimum a unit must expose to be validated. Structural, not imported. */
export interface ValidatableUnit extends Box3D {
  readonly id: string
  readonly unitNumber: string
  readonly floorLevel: number
  readonly prototypeUlpin: string
}

/** One floor's recorded vertical extent. */
export interface ValidatableFloor {
  readonly level: number
  readonly baseY: number
  readonly topY: number
}

/** Everything the engine needs. All of it logical geometry; none of it display. */
export interface TopologyInput {
  /** The cadastral parcel boundary, in metres, Three.js axes. */
  readonly parcelBoundary: Ring2D
  /** The building footprint, in metres, Three.js axes. */
  readonly footprint: Ring2D
  /** The property units to validate. */
  readonly units: readonly ValidatableUnit[]
  /** The floors the units are supposed to occupy. */
  readonly floors: readonly ValidatableFloor[]
  /** Total sanctioned height of the building, in metres. */
  readonly totalHeightM: number
  /** How many units the configuration says each floor should hold. */
  readonly expectedUnitsPerFloor: number
  /** How many units the configuration says the building should hold in total. */
  readonly expectedTotalUnits: number
}

/** Format a number for a details record without implying survey precision. */
function m(value: number): string {
  return `${value.toFixed(2)} m`
}

/* ── Rule 1: the building lies inside its parent parcel ──────────────────── */

/**
 * Is the building footprint contained by the cadastral parcel?
 *
 * Both tests from `isRingInsideRing`: every footprint corner inside the parcel
 * (or on its boundary — a building built to its plot line is legal), and no
 * footprint edge cutting through a parcel edge. Vertices alone would miss a
 * footprint that bulges out through a notch in a concave plot, which the demo
 * parcel — deliberately not a rectangle — is exactly the shape to have.
 *
 * The demo footprint is 18 × 14 m centred in a ~46 × 34 m plot, so this passes
 * with metres to spare. It is still worth computing rather than asserting,
 * because it is the check that would catch a footprint authored in the wrong
 * units or against the wrong origin — the two mistakes most likely to be made
 * when a second parcel is added.
 */
function checkParcelContainment(input: TopologyInput): ValidationResult[] {
  const results: ValidationResult[] = []

  const parcelSimple = isSimpleRing(input.parcelBoundary)
  const footprintSimple = isSimpleRing(input.footprint)

  results.push({
    id: 'rings-simple',
    category: 'parcel-containment',
    status: parcelSimple && footprintSimple ? 'pass' : 'fail',
    chip: parcelSimple && footprintSimple ? 'Rings simple' : 'Ring self-intersects',
    message:
      parcelSimple && footprintSimple
        ? 'Parcel and footprint rings are simple — no self-intersection'
        : `Self-intersecting ring: ${!parcelSimple ? 'parcel' : ''}${!parcelSimple && !footprintSimple ? ' and ' : ''}${!footprintSimple ? 'footprint' : ''}`,
    affectedUnitIds: [],
    details: {
      'Parcel vertices': input.parcelBoundary.length,
      'Footprint vertices': input.footprint.length,
    },
  })

  const containment = isRingInsideRing(input.footprint, input.parcelBoundary)

  results.push({
    id: 'building-within-parcel',
    category: 'parcel-containment',
    status: containment.contained ? 'pass' : 'fail',
    chip: containment.contained ? 'Parcel valid' : 'Outside parcel',
    message: containment.contained
      ? 'Building footprint lies entirely within the parent parcel'
      : containment.edgesCross
        ? 'Building footprint crosses the parcel boundary'
        : `${containment.outsideVertexIndices.length} footprint vertex/vertices fall outside the parcel`,
    affectedUnitIds: [],
    details: {
      'Vertices outside': containment.outsideVertexIndices.length,
      'Edges crossing boundary': containment.edgesCross ? 'yes' : 'no',
    },
  })

  return results
}

/* ── Rule 2: every unit lies inside the building ─────────────────────────── */

/**
 * Is every property volume inside the building, horizontally and vertically?
 *
 * Two independent questions, reported as two results, because they fail for
 * different reasons and a presenter needs to know which:
 *
 * **Horizontally**, each unit's four plan corners must lie inside the footprint
 * polygon or on its boundary. Corners *on* the boundary are the normal case —
 * the units are cut from that footprint — which is why the containment test
 * tolerates the boundary rather than requiring strict interiority. See the note
 * in `geometry2d.ts`.
 *
 * **Vertically**, each unit must sit within `0 → totalHeight`. That catches a
 * basement authored as a negative elevation and a floor extending past the
 * sanctioned height, neither of which any horizontal test can see.
 */
function checkUnitContainment(input: TopologyInput): ValidationResult[] {
  const horizontallyOutside: ValidatableUnit[] = []
  const verticallyOutside: ValidatableUnit[] = []

  for (const unit of input.units) {
    const corners: Point2D[] = [
      { x: unit.xMin, z: unit.zMin },
      { x: unit.xMax, z: unit.zMin },
      { x: unit.xMax, z: unit.zMax },
      { x: unit.xMin, z: unit.zMax },
    ]

    if (!corners.every((corner) => isPointInsideOrOnRing(corner, input.footprint))) {
      horizontallyOutside.push(unit)
    }

    if (!isWithinVerticalRange(unit, 0, input.totalHeightM)) {
      verticallyOutside.push(unit)
    }
  }

  return [
    {
      id: 'units-within-footprint',
      category: 'unit-containment',
      status: horizontallyOutside.length === 0 ? 'pass' : 'fail',
      chip:
        horizontallyOutside.length === 0
          ? 'Geometry valid'
          : `${horizontallyOutside.length} outside plan`,
      message:
        horizontallyOutside.length === 0
          ? `All ${input.units.length} property volumes lie within the building footprint`
          : `${horizontallyOutside.length} property volume(s) extend beyond the building footprint`,
      affectedUnitIds: horizontallyOutside.map((unit) => unit.id),
      details: {
        'Units checked': input.units.length,
        'Outside footprint': horizontallyOutside.length,
        ...(horizontallyOutside.length > 0
          ? { Units: horizontallyOutside.map((unit) => unit.unitNumber).join(', ') }
          : {}),
      },
    },
    {
      id: 'units-within-height',
      category: 'unit-containment',
      status: verticallyOutside.length === 0 ? 'pass' : 'fail',
      chip:
        verticallyOutside.length === 0
          ? 'Heights valid'
          : `${verticallyOutside.length} outside height`,
      message:
        verticallyOutside.length === 0
          ? `All property volumes sit within 0 – ${input.totalHeightM.toFixed(0)} m above ground`
          : `${verticallyOutside.length} property volume(s) fall outside the building's vertical extent`,
      affectedUnitIds: verticallyOutside.map((unit) => unit.id),
      details: {
        'Permitted range': `0 – ${m(input.totalHeightM)}`,
        'Outside range': verticallyOutside.length,
      },
    },
  ]
}

/* ── Rule 3: the floor hierarchy is coherent ─────────────────────────────── */

/**
 * Are the floors ordered, non-overlapping, above ground, and do the units agree?
 *
 * Four separate faults share one result because they share one cause — a broken
 * vertical model — and a status panel with four rows about floor elevations
 * would bury the two rows that matter. The `details` record names whichever
 * fault fired.
 *
 * The last of the four is the interesting one: **every unit's own `yMin`/`yMax`
 * must equal its assigned floor's**. In the current model a unit's vertical
 * bounds are *copied* from its floor, so this cannot fail by construction — and
 * that is exactly why it is worth checking. It is the assertion that the copy is
 * still a copy, and it is the check that would fire first if a later phase ever
 * let a unit's elevation be edited independently of its floor.
 */
function checkFloorHierarchy(input: TopologyInput): ValidationResult[] {
  const faults: string[] = []
  const affected = new Set<string>()

  const ordered = [...input.floors].sort((a, b) => a.level - b.level)

  for (let index = 0; index < ordered.length; index++) {
    const floor = ordered[index]

    if (floor.baseY < -OVERLAP_EPSILON_M) {
      faults.push(`floor ${floor.level} has a negative base elevation`)
    }
    if (floor.topY <= floor.baseY) {
      faults.push(`floor ${floor.level} has zero or inverted height`)
    }
    if (index > 0) {
      const below = ordered[index - 1]
      if (floor.baseY < below.topY - OVERLAP_EPSILON_M) {
        faults.push(`floor ${floor.level} starts below the top of floor ${below.level}`)
      }
    }
  }

  const byLevel = new Map(ordered.map((floor) => [floor.level, floor]))
  for (const unit of input.units) {
    const floor = byLevel.get(unit.floorLevel)
    if (floor === undefined) {
      faults.push(`unit ${unit.unitNumber} names floor ${unit.floorLevel}, which does not exist`)
      affected.add(unit.id)
      continue
    }
    if (
      Math.abs(unit.yMin - floor.baseY) > OVERLAP_EPSILON_M ||
      Math.abs(unit.yMax - floor.topY) > OVERLAP_EPSILON_M
    ) {
      faults.push(
        `unit ${unit.unitNumber} spans ${m(unit.yMin)}–${m(unit.yMax)} but floor ${floor.level} is ${m(floor.baseY)}–${m(floor.topY)}`,
      )
      affected.add(unit.id)
    }
  }

  return [
    {
      id: 'floor-hierarchy',
      category: 'floor-hierarchy',
      status: faults.length === 0 ? 'pass' : 'fail',
      chip: faults.length === 0 ? `${ordered.length} floors valid` : 'Floor fault',
      message:
        faults.length === 0
          ? `${ordered.length} floors stack correctly, each unit within its own floor`
          : `${faults.length} floor-hierarchy fault(s)`,
      affectedUnitIds: [...affected],
      details:
        faults.length === 0
          ? {
              Floors: ordered.length,
              Range: `${m(ordered[0]?.baseY ?? 0)} – ${m(ordered[ordered.length - 1]?.topY ?? 0)}`,
            }
          : { Faults: faults.slice(0, 4).join('; ') },
    },
  ]
}

/* ── Rule 4: identifiers are unique ──────────────────────────────────────── */

/**
 * Is every prototype 3D ULPIN unique?
 *
 * The model layer already asserts this when it generates the units
 * (`assertUniqueIdentifiers`), and it throws rather than returning. This check
 * is not redundant with that: it runs over **whatever array it is handed**,
 * including one a simulation has modified, and it *reports* rather than throwing
 * — which is what a validation engine has to do. A duplicate identifier means two
 * records naming one property, and a register in that state must say so, not
 * crash.
 */
function checkIdentifierUniqueness(input: TopologyInput): ValidationResult[] {
  const seen = new Map<string, string[]>()

  for (const unit of input.units) {
    const existing = seen.get(unit.prototypeUlpin)
    if (existing === undefined) seen.set(unit.prototypeUlpin, [unit.id])
    else existing.push(unit.id)
  }

  const duplicates = [...seen.entries()].filter(([, ids]) => ids.length > 1)
  const affected = duplicates.flatMap(([, ids]) => ids)

  return [
    {
      id: 'identifier-uniqueness',
      category: 'identifier-uniqueness',
      status: duplicates.length === 0 ? 'pass' : 'fail',
      chip:
        duplicates.length === 0
          ? `${input.units.length} unique IDs`
          : `${duplicates.length} duplicate ID(s)`,
      message:
        duplicates.length === 0
          ? `${input.units.length} prototype 3D ULPIN values, all unique`
          : `${duplicates.length} identifier(s) assigned to more than one property`,
      affectedUnitIds: affected,
      details: {
        Identifiers: input.units.length,
        Distinct: seen.size,
        ...(duplicates.length > 0
          ? { Duplicated: duplicates.map(([value]) => value).join(', ') }
          : {}),
      },
    },
  ]
}

/* ── Rule 5: no two properties occupy the same volume ────────────────────── */

/** One discovered 3D ownership conflict. */
export interface OwnershipConflict {
  readonly unitA: ValidatableUnit
  readonly unitB: ValidatableUnit
  /** `x × y × z` of the intersection, in cubic metres. */
  readonly intersectionVolumeCubicM: number
  /** Per-axis overlap, in metres. */
  readonly extents: { readonly x: number; readonly y: number; readonly z: number }
  /**
   * **The disputed region itself**, as a box in metres — where the overlap is,
   * not merely how big it is.
   *
   * Straight off `getVolumeIntersection`; the engine does not recompute it and
   * neither does anything downstream. This is what lets the 3D scene draw the
   * contested volume as *the validator's own output* rather than as a renderer's
   * illustration of a number. See `aabb.ts`.
   */
  readonly bounds: Box3D
}

/**
 * Find every pair of ownership volumes that genuinely intersect.
 *
 * Exported separately from the check that reports it, because the conflict
 * *warning banner* needs the pair and the intersection volume, not a sentence
 * about them. One computation, two consumers, no second implementation.
 *
 * O(n²/2) — 190 comparisons for twenty units. A spatial index would be
 * asymptotically better and would be premature: the whole sweep is well under a
 * millisecond and it runs on a state change, not on a frame.
 */
export function findOwnershipConflicts(
  units: readonly ValidatableUnit[],
  epsilon: number = OVERLAP_EPSILON_M,
): OwnershipConflict[] {
  const conflicts: OwnershipConflict[] = []

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const intersection = getVolumeIntersection(units[i], units[j], epsilon)
      if (intersection === null) continue

      conflicts.push({
        unitA: units[i],
        unitB: units[j],
        intersectionVolumeCubicM: intersection.volumeCubicM,
        extents: intersection.extents,
        bounds: intersection.bounds,
      })
    }
  }

  return conflicts
}

function checkOwnershipOverlap(input: TopologyInput): ValidationResult[] {
  const conflicts = findOwnershipConflicts(input.units)
  const affected = conflicts.flatMap((conflict) => [conflict.unitA.id, conflict.unitB.id])

  const totalVolume = conflicts.reduce(
    (sum, conflict) => sum + conflict.intersectionVolumeCubicM,
    0,
  )

  return [
    {
      id: 'ownership-overlap',
      category: 'ownership-overlap',
      status: conflicts.length === 0 ? 'pass' : 'fail',
      chip:
        conflicts.length === 0
          ? 'No conflicts'
          : `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}`,
      message:
        conflicts.length === 0
          ? 'No two property volumes intersect — shared walls and slabs only'
          : `${conflicts.length} spatial ownership conflict(s) detected`,
      affectedUnitIds: [...new Set(affected)],
      details:
        conflicts.length === 0
          ? {
              'Pairs tested': (input.units.length * (input.units.length - 1)) / 2,
              'Intersecting pairs': 0,
            }
          : {
              'Pairs tested': (input.units.length * (input.units.length - 1)) / 2,
              'Intersecting pairs': conflicts.length,
              'Disputed volume': `${totalVolume.toFixed(1)} m³`,
              Pairs: conflicts
                .map((c) => `${c.unitA.unitNumber} ∩ ${c.unitB.unitNumber}`)
                .join(', '),
            },
    },
  ]
}

/* ── Rule 6: the structure matches the configuration ─────────────────────── */

/**
 * Does the generated structure match what the configuration asks for?
 *
 * The expected figures are **parameters**, derived by the caller from the
 * building config — not literals. That is the difference between a check that
 * validates the model and one that validates the demo: change the config to
 * eight floors of six units and this keeps working, where a hard-coded `20`
 * would start failing on a correct building.
 *
 * A count mismatch is a `warning` rather than a `fail`, and the distinction is
 * considered: a building with nineteen units is not *spatially impossible*, it
 * is a building whose generator and whose configuration disagree. That is a bug
 * worth surfacing loudly and not the same class of thing as two people owning
 * the same air, which is what the headline `CONFLICT` is reserved for.
 */
function checkStructureCount(input: TopologyInput): ValidationResult[] {
  const perFloor = new Map<number, number>()
  for (const unit of input.units) {
    perFloor.set(unit.floorLevel, (perFloor.get(unit.floorLevel) ?? 0) + 1)
  }

  const wrongFloors = [...perFloor.entries()].filter(
    ([, count]) => count !== input.expectedUnitsPerFloor,
  )
  const countMatches =
    input.units.length === input.expectedTotalUnits && wrongFloors.length === 0

  return [
    {
      id: 'structure-count',
      category: 'structure-count',
      status: countMatches ? 'pass' : 'warning',
      chip: countMatches
        ? `${input.units.length} units`
        : `${input.units.length}/${input.expectedTotalUnits} units`,
      message: countMatches
        ? `${input.units.length} property volumes across ${input.floors.length} floors, as configured`
        : `Generated structure differs from the configuration`,
      affectedUnitIds: [],
      details: {
        'Units generated': input.units.length,
        'Units expected': input.expectedTotalUnits,
        'Per floor': input.expectedUnitsPerFloor,
        Floors: input.floors.length,
        ...(wrongFloors.length > 0
          ? {
              Mismatched: wrongFloors
                .map(([level, count]) => `F${level}: ${count}`)
                .join(', '),
            }
          : {}),
      },
    },
  ]
}

/* ── The engine ──────────────────────────────────────────────────────────── */

/**
 * Validate a cadastral model and report what is true about it.
 *
 * Pure: no console, no throw, no side effect. Every rule runs — there is no
 * short-circuit on the first failure — because a presenter looking at a broken
 * record wants the whole picture, and because "we stopped checking after the
 * first problem" is not a thing a register should ever say.
 *
 * The rules run in the order a person would ask them: is the plot right, is the
 * building on it, are the floors coherent, are the properties inside, are they
 * uniquely named, do any of them collide.
 */
export function validateTopology(input: TopologyInput): TopologyReport {
  return summariseResults([
    ...checkParcelContainment(input),
    ...checkFloorHierarchy(input),
    ...checkUnitContainment(input),
    ...checkIdentifierUniqueness(input),
    ...checkOwnershipOverlap(input),
    ...checkStructureCount(input),
  ])
}
