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
import {
  checkUnderground,
  type ValidatableBasementLevel,
  type ValidatableUndergroundUnit,
} from './undergroundRules'

/**
 * The below-ground validatable contracts, re-exported from the one module every
 * caller of the engine already imports.
 *
 * The rules that use them live in `undergroundRules.ts`, but nothing outside
 * this folder should have to know which file a given rule ended up in: a caller
 * assembling a `TopologyInput` names `validateTopology` and gets the types that
 * input is made of, exactly as it does for `ValidatableUnit` below.
 */
export type { ValidatableBasementLevel, ValidatableUndergroundUnit }

/** The minimum a unit must expose to be validated. Structural, not imported. */
export interface ValidatableUnit extends Box3D {
  readonly id: string
  readonly unitNumber: string
  readonly floorLevel: number
  readonly prototypeUlpin: string
  /**
   * The parcel this unit belongs to.
   *
   * Optional so that the fixtures in `validationSelfCheck.ts`, which construct
   * bare boxes to prove individual rules, keep compiling unchanged. When it is
   * absent the parcel-consistency rule simply has nothing to compare, which is
   * the correct behaviour for a fixture that is not about parcels.
   */
  readonly parentParcelId?: string
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

  /* ── Below the ground datum ──────────────────────────────────────────────
     All five are optional, and that is the whole compatibility story: a model
     with no basement passes exactly the input it passed before this phase, the
     underground rules return nothing, and the report gains no chips about an
     excavation that does not exist. Nothing above ground changed. */

  /** The underground volumes to validate, if the model has any. */
  readonly undergroundUnits?: readonly ValidatableUndergroundUnit[]
  /** The basement levels those volumes are supposed to occupy. */
  readonly basementLevels?: readonly ValidatableBasementLevel[]
  /**
   * **The excavation's own footprint**, in metres, Three.js axes.
   *
   * Since the underground redesign the basement is dug wider than the tower, so
   * it has a ring of its own and the below-ground containment rule is pointed
   * at that ring rather than at `footprint`. Optional, and it falls back to
   * `footprint` when a caller does not state one — which is the correct
   * behaviour for a model whose excavation genuinely does share the building's
   * plan, and which keeps every basement-free fixture compiling unchanged.
   */
  readonly basementFootprint?: Ring2D
  /**
   * The elevation treated as ground. Defaults to `0`.
   *
   * A parameter rather than a hard-coded zero so the rule is stated once, by
   * the caller that owns the datum, and every check compares against the same
   * value. See `underground/basementConfig.ts`.
   */
  readonly groundDatumY?: number
  /** How many spaces the basement configuration says should exist. */
  readonly expectedUndergroundSpaces?: number
  /**
   * The parcel every 3D space in this model is expected to belong to.
   *
   * When absent the parcel-consistency rule is skipped rather than guessed —
   * the engine reports what it can establish, never what it assumed.
   */
  readonly parentParcelId?: string
}

/** Format a number for a details record without implying survey precision. */
function m(value: number): string {
  return `${value.toFixed(2)} m`
}

/**
 * The identity of one 3D space, on either side of the ground datum.
 *
 * The narrow shape the register-wide rules — uniqueness and parcel consistency
 * — actually need. Both an above-ground unit and an underground space satisfy
 * it structurally, so those two rules sweep the whole model without either
 * knowing which kind of record it is looking at, and without a third type
 * existing for them to be converted into.
 */
interface SpaceIdentity {
  readonly id: string
  readonly prototypeUlpin: string
  readonly parentParcelId?: string
}

/** Every 3D space in the model, above ground and below it, in that order. */
function allSpaces(input: TopologyInput): readonly SpaceIdentity[] {
  return [...input.units, ...(input.undergroundUnits ?? [])]
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
  // EVERY 3D space in the model, on both sides of the datum. Uniqueness is a
  // property of the *register*, not of one storey of it: an underground space
  // and an apartment sharing an identifier would be exactly as broken as two
  // apartments sharing one, and a check that only swept the units above ground
  // would report "all unique" while the register held a collision. The two
  // encoders make a collision structurally impossible (`F` versus `B` — see
  // `ulpin/generateUlpin.ts`); this is the check that says so rather than the
  // thing preventing it.
  const spaces = allSpaces(input)
  const seen = new Map<string, string[]>()

  for (const space of spaces) {
    const existing = seen.get(space.prototypeUlpin)
    if (existing === undefined) seen.set(space.prototypeUlpin, [space.id])
    else existing.push(space.id)
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
          ? `${spaces.length} unique IDs`
          : `${duplicates.length} duplicate ID(s)`,
      message:
        duplicates.length === 0
          ? `${spaces.length} prototype 3D ULPIN values across every 3D space, all unique`
          : `${duplicates.length} identifier(s) assigned to more than one property`,
      affectedUnitIds: affected,
      details: {
        Identifiers: spaces.length,
        'Above ground': input.units.length,
        Underground: input.undergroundUnits?.length ?? 0,
        Distinct: seen.size,
        ...(duplicates.length > 0
          ? { Duplicated: duplicates.map(([value]) => value).join(', ') }
          : {}),
      },
    },
  ]
}

/* ── Rule 7: every 3D space belongs to the same parent parcel ─────────────── */

/**
 * Do all the model's volumes — above ground and below it — name one parcel?
 *
 * The claim the whole prototype rests on is that a tower and the excavation
 * under it are **subdivisions of one piece of land**. That is what makes a 3D
 * ULPIN a *derivation* of a parcel identifier rather than a new namespace, and
 * it is what the ownership hierarchy in the inspector draws as a descent. If
 * two spaces ever named different parcels the descent would be a fiction, so
 * the register checks it rather than assuming it.
 *
 * Skipped entirely when the caller does not state an expected parcel: the
 * engine reports what it can establish and never what it inferred.
 */
function checkParcelConsistency(input: TopologyInput): ValidationResult[] {
  const expected = input.parentParcelId
  if (expected === undefined) return []

  const spaces = allSpaces(input)
  const mismatched = spaces.filter(
    (space) =>
      space.parentParcelId !== undefined && space.parentParcelId !== expected,
  )
  const unstated = spaces.filter((space) => space.parentParcelId === undefined)

  return [
    {
      id: 'parcel-consistency',
      category: 'parcel-consistency',
      status: mismatched.length === 0 ? 'pass' : 'fail',
      chip: mismatched.length === 0 ? 'One parcel' : `${mismatched.length} off-parcel`,
      message:
        mismatched.length === 0
          ? `All ${spaces.length} 3D spaces belong to parent parcel ${expected}`
          : `${mismatched.length} 3D space(s) name a parcel other than ${expected}`,
      affectedUnitIds: mismatched.map((space) => space.id),
      details: {
        'Parent parcel': expected,
        'Spaces checked': spaces.length - unstated.length,
        'Above ground': input.units.length,
        Underground: input.undergroundUnits?.length ?? 0,
        ...(mismatched.length > 0
          ? { Mismatched: mismatched.map((space) => space.id).join(', ') }
          : {}),
      },
    },
  ]
}

/* ── Rule 5: no two properties occupy the same volume ────────────────────── */

/**
 * The minimum a volume must expose to take part in the overlap sweep.
 *
 * Narrower than `ValidatableUnit` on purpose: the sweep needs six bounds, an id
 * and a number to print, and nothing else. Widening it to this shape is what
 * lets **one** sweep cover the whole register — apartments and basement decks
 * in one array — without an above-ground type being forced onto a below-ground
 * record, and without a second sweep that could come to disagree with the
 * first. Both `ValidatableUnit` and `ValidatableUndergroundUnit` satisfy it
 * structurally; neither had to change.
 */
export interface ValidatableVolume extends Box3D {
  readonly id: string
  readonly unitNumber: string
}

/**
 * One discovered 3D ownership conflict.
 *
 * Generic over the volume type, so a caller that swept a homogeneous array gets
 * its own record type back rather than the narrowed one. `findOwnershipConflicts(units)`
 * yields `OwnershipConflict<ValidatableUnit>` — floors and identifiers intact,
 * which is what the conflict panel reads — while the register-wide sweep inside
 * the engine yields the common shape, because a parking deck genuinely has no
 * floor. One function, two honest return types, no cast at either call site.
 */
export interface OwnershipConflict<
  TVolume extends ValidatableVolume = ValidatableVolume,
> {
  readonly unitA: TVolume
  readonly unitB: TVolume
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
export function findOwnershipConflicts<TVolume extends ValidatableVolume>(
  units: readonly TVolume[],
  epsilon: number = OVERLAP_EPSILON_M,
): OwnershipConflict<TVolume>[] {
  const conflicts: OwnershipConflict<TVolume>[] = []

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

/**
 * Every ownership volume in the model, above the datum and below it.
 *
 * The array the overlap sweep runs over. **It is the whole register, not the
 * tower**, and that is a deliberate correction: a rule called "no two
 * properties occupy the same volume" that only looked at twenty apartments was
 * answering a narrower question than its name, and would have reported "no
 * conflicts" on a model where a parking deck had risen through the ground-floor
 * slab. The below-ground rules in `undergroundRules.ts` catch that case too,
 * and say more precisely what it means — but they are a second opinion on it,
 * not the only one, and the register-wide rule has to be able to fail on it.
 */
function allVolumes(input: TopologyInput): readonly ValidatableVolume[] {
  return [...input.units, ...(input.undergroundUnits ?? [])]
}

function checkOwnershipOverlap(input: TopologyInput): ValidationResult[] {
  const volumes = allVolumes(input)
  const conflicts = findOwnershipConflicts(volumes)
  const affected = conflicts.flatMap((conflict) => [conflict.unitA.id, conflict.unitB.id])

  const totalVolume = conflicts.reduce(
    (sum, conflict) => sum + conflict.intersectionVolumeCubicM,
    0,
  )

  // C(n, 2) over every 3D space: 190 for the tower alone, 231 once the two
  // parking decks join it. Derived from the array's length, never stated.
  const pairsTested = (volumes.length * (volumes.length - 1)) / 2

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
          ? 'No two property volumes intersect — shared walls, slabs and the datum only'
          : `${conflicts.length} spatial ownership conflict(s) detected`,
      affectedUnitIds: [...new Set(affected)],
      details:
        conflicts.length === 0
          ? {
              'Pairs tested': pairsTested,
              'Intersecting pairs': 0,
              'Above ground': input.units.length,
              Underground: input.undergroundUnits?.length ?? 0,
            }
          : {
              'Pairs tested': pairsTested,
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
 *
 * It counts **the whole register**, above the datum and below it. It used to
 * count only the tower, which meant the one figure a presenter reads off the
 * status bar — "how many properties does this record hold" — silently excluded
 * the basement. `checkUndergroundCount` still reports the excavation on its
 * own, because "the basement is short a deck" and "the building is short a
 * flat" are different findings; this rule is the sum of them.
 */
function checkStructureCount(input: TopologyInput): ValidationResult[] {
  const perFloor = new Map<number, number>()
  for (const unit of input.units) {
    perFloor.set(unit.floorLevel, (perFloor.get(unit.floorLevel) ?? 0) + 1)
  }

  const wrongFloors = [...perFloor.entries()].filter(
    ([, count]) => count !== input.expectedUnitsPerFloor,
  )
  // The below-ground half of the same question. Expected from the caller's own
  // basement config when it states one; otherwise from the array itself, which
  // makes the comparison vacuously true rather than inventing a target.
  const undergroundCount = input.undergroundUnits?.length ?? 0
  const expectedUnderground = input.expectedUndergroundSpaces ?? undergroundCount

  const countMatches =
    input.units.length === input.expectedTotalUnits &&
    undergroundCount === expectedUnderground &&
    wrongFloors.length === 0

  // **The register's total, derived by addition — never stated.** 20 above the
  // datum plus 2 below it is 22, and the moment that 22 is typed anywhere it
  // becomes a claim the software makes about itself rather than a measurement
  // of what it produced. The chip reads "3D spaces" rather than "units" because
  // that is what it now counts: a parking deck is not a unit.
  const totalSpaces = input.units.length + undergroundCount
  const expectedTotalSpaces = input.expectedTotalUnits + expectedUnderground

  return [
    {
      id: 'structure-count',
      category: 'structure-count',
      status: countMatches ? 'pass' : 'warning',
      chip: countMatches
        ? `${totalSpaces} 3D spaces`
        : `${totalSpaces}/${expectedTotalSpaces} 3D spaces`,
      message: countMatches
        ? `${totalSpaces} 3D spaces — ${input.units.length} across ${input.floors.length} floors, ${undergroundCount} below the datum, as configured`
        : `Generated structure differs from the configuration`,
      affectedUnitIds: [],
      details: {
        'Units generated': input.units.length,
        'Units expected': input.expectedTotalUnits,
        'Per floor': input.expectedUnitsPerFloor,
        Floors: input.floors.length,
        Underground: undergroundCount,
        'Underground expected': expectedUnderground,
        'Total 3D spaces': totalSpaces,
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
 * building on it, are the floors coherent, are the properties inside, what lies
 * below the datum, are they all uniquely named and on one parcel, do any of
 * them collide.
 *
 * THE UNDERGROUND RULES ARE THE SAME ENGINE, NOT A SECOND ONE.
 * They are declared in `undergroundRules.ts` for readability, they return the
 * same `ValidationResult` shape, they are summarised by the same
 * `summariseResults`, and their `affectedUnitIds` flow into the same
 * `conflictedUnitIds` the scene paints from. There is one validator, and the
 * status bar cannot end up disagreeing with itself about which half of a model
 * it is describing. When a model has no basement they contribute nothing.
 */
export function validateTopology(input: TopologyInput): TopologyReport {
  const groundDatumY = input.groundDatumY ?? 0

  return summariseResults([
    ...checkParcelContainment(input),
    ...checkFloorHierarchy(input),
    ...checkUnitContainment(input),
    ...checkUnderground({
      // The excavation's own ring when the caller states one, the building's
      // otherwise. Never a silent mix of the two: one value, chosen here.
      basementFootprint: input.basementFootprint ?? input.footprint,
      parcelBoundary: input.parcelBoundary,
      spaces: input.undergroundUnits ?? [],
      levels: input.basementLevels ?? [],
      // The above-ground volumes, so the cross-datum sweep is over the same
      // records the ownership rule above just tested against each other — a
      // simulated encroachment is visible to both.
      aboveGround: input.units,
      groundDatumY,
      expectedSpaceCount:
        input.expectedUndergroundSpaces ?? (input.undergroundUnits?.length ?? 0),
    }),
    ...checkIdentifierUniqueness(input),
    ...checkParcelConsistency(input),
    ...checkOwnershipOverlap(input),
    ...checkStructureCount(input),
  ])
}
