/**
 * Topology rules for volumes **below** the ground datum.
 *
 * WHY THESE ARE RULES AND NOT A RENDERING CONCERN
 * A 2D cadastre cannot express a basement at all: projected onto the plan, the
 * parking level and the ground-floor apartments occupy the same polygon, and
 * the register has no way to say whether that is one property, two stacked
 * properties, or a dispute. The moment a model has a third axis, the question
 * becomes answerable — and answering it is arithmetic, not draughtsmanship.
 * These rules are that arithmetic.
 *
 * THE ONE DISTINCTION EVERYTHING HERE TURNS ON
 *
 *   touching at y = 0   VALID    — a basement ceiling and a ground-floor slab
 *                                  share a *surface*: overlap extent is exactly
 *                                  zero on Y, so no volume is claimed twice
 *   positive overlap    INVALID  — the two intervals genuinely interpenetrate
 *                                  and two records claim the same cubic metres
 *
 * It is enforced by `getVolumeIntersection`, which requires **all three** axis
 * extents to be strictly greater than the epsilon before it reports an
 * intersection. Nothing here re-implements that test; the whole module exists
 * to point it at the right pairs and to say what a failure means.
 *
 * Pure: no console, no throw, no React, no Three.js. Every function returns
 * `ValidationResult[]` for the engine to summarise.
 */

import {
  getVolumeIntersection,
  isWithinVerticalRange,
  OVERLAP_EPSILON_M,
  type Box3D,
} from './aabb'
import { isPointInsideOrOnRing, type Point2D, type Ring2D } from './geometry2d'
import type { ValidationResult } from './types'

/**
 * The minimum an underground volume must expose to be validated.
 *
 * Structural, not imported — the same discipline `ValidatableUnit` follows.
 * Both below-ground record types satisfy it, and a test fixture written by hand
 * does too, which is what lets the self-check feed the engine deliberately
 * broken models without constructing a whole cadastre.
 *
 * `unitNumber`, not `spaceNumber`: it is the same field an above-ground unit
 * carries, so the register-wide rules read one name on both sides of the datum
 * and a below-ground volume needs no adapter to be validated beside a flat.
 */
export interface ValidatableUndergroundUnit extends Box3D {
  readonly id: string
  readonly unitNumber: string
  readonly basementLevel: number
  readonly prototypeUlpin: string
  readonly parentParcelId: string
}

/** One basement level's recorded vertical extent. */
export interface ValidatableBasementLevel {
  readonly level: number
  readonly baseY: number
  readonly topY: number
}

/** Everything the underground rules need. All logical geometry; none display. */
export interface UndergroundInput {
  /** The building footprint, in metres, Three.js axes. The same ring as above. */
  readonly footprint: Ring2D
  /** The underground spaces to validate. */
  readonly spaces: readonly ValidatableUndergroundUnit[]
  /** The basement levels those spaces are supposed to occupy. */
  readonly levels: readonly ValidatableBasementLevel[]
  /** The above-ground volumes, for the cross-datum overlap sweep. */
  readonly aboveGround: readonly Box3D[]
  /** The elevation treated as ground. `0` in this model. */
  readonly groundDatumY: number
  /** How many spaces the configuration says the basement should hold. */
  readonly expectedSpaceCount: number
}

/** Format a number for a details record without implying survey precision. */
function m(value: number): string {
  return `${value.toFixed(2)} m`
}

/* ── Rule U1: the basement levels are coherent and below the datum ────────── */

/**
 * Are the basement levels ordered, non-overlapping, and entirely at or below
 * the ground datum?
 *
 * Four faults share one result, exactly as `checkFloorHierarchy` above ground
 * does, and for the same reason: they share one cause — a broken vertical model
 * — and four rows about basement elevations would bury the two that matter.
 *
 * The datum test is `topY <= groundDatumY + epsilon`, **not** `topY < 0`. A
 * topmost basement whose ceiling is exactly the datum is the normal, correct
 * case — it is what makes the basement meet the building rather than float
 * below it — so the boundary is inclusive here. It is the *volume* test in U4
 * that draws the line between touching and overlapping.
 */
export function checkBasementLevels(input: UndergroundInput): ValidationResult[] {
  const faults: string[] = []
  // Descending: level 1 is the topmost, level 2 lies beneath it.
  const ordered = [...input.levels].sort((a, b) => a.level - b.level)

  for (let index = 0; index < ordered.length; index++) {
    const level = ordered[index]

    if (level.topY > input.groundDatumY + OVERLAP_EPSILON_M) {
      faults.push(
        `basement ${level.level} rises above the ground datum (top ${m(level.topY)})`,
      )
    }
    if (level.baseY >= level.topY) {
      faults.push(`basement ${level.level} has zero or inverted depth`)
    }
    if (index > 0) {
      const above = ordered[index - 1]
      // Descending stack: this level's ceiling must not push up into the one
      // above it. Equality — ceiling exactly at the floor above — is correct.
      if (level.topY > above.baseY + OVERLAP_EPSILON_M) {
        faults.push(
          `basement ${level.level} rises into basement ${above.level}`,
        )
      }
    }
  }

  const deepest = ordered[ordered.length - 1]
  const shallowest = ordered[0]

  return [
    {
      id: 'basement-levels',
      category: 'underground-containment',
      status: faults.length === 0 ? 'pass' : 'fail',
      chip:
        faults.length === 0
          ? `${ordered.length} basement level${ordered.length === 1 ? '' : 's'}`
          : 'Basement fault',
      message:
        faults.length === 0
          ? `${ordered.length} basement level(s) stack downward from the ground datum without gaps or overlap`
          : `${faults.length} basement-level fault(s)`,
      affectedUnitIds: [],
      details:
        faults.length === 0
          ? {
              Levels: ordered.length,
              'Ground datum': m(input.groundDatumY),
              Interval: `${m(deepest?.baseY ?? 0)} → ${m(shallowest?.topY ?? 0)}`,
            }
          : { Faults: faults.slice(0, 4).join('; ') },
    },
  ]
}

/* ── Rule U2: every space lies under the building, horizontally ───────────── */

/**
 * Is every underground volume within the building footprint in plan?
 *
 * The identical test the above-ground units get, against the identical ring —
 * which is the point. The excavation is sanctioned under the building's own
 * plan, so a basement that extended past it would be claiming subsurface rights
 * outside the footprint, and that is exactly the kind of encroachment a 3D
 * register exists to catch. Corners *on* the boundary are the normal case: the
 * spaces are cut from that footprint.
 */
export function checkUndergroundContainment(
  input: UndergroundInput,
): ValidationResult[] {
  const outside: ValidatableUndergroundUnit[] = []

  for (const space of input.spaces) {
    const corners: Point2D[] = [
      { x: space.xMin, z: space.zMin },
      { x: space.xMax, z: space.zMin },
      { x: space.xMax, z: space.zMax },
      { x: space.xMin, z: space.zMax },
    ]

    if (!corners.every((corner) => isPointInsideOrOnRing(corner, input.footprint))) {
      outside.push(space)
    }
  }

  return [
    {
      id: 'underground-within-footprint',
      category: 'underground-containment',
      status: outside.length === 0 ? 'pass' : 'fail',
      chip: outside.length === 0 ? 'Sub-plan valid' : `${outside.length} outside plan`,
      message:
        outside.length === 0
          ? `All ${input.spaces.length} underground volumes lie within the building footprint in plan`
          : `${outside.length} underground volume(s) extend beyond the building footprint`,
      affectedUnitIds: outside.map((space) => space.id),
      details: {
        'Spaces checked': input.spaces.length,
        'Outside footprint': outside.length,
        ...(outside.length > 0
          ? { Spaces: outside.map((space) => space.unitNumber).join(', ') }
          : {}),
      },
    },
  ]
}

/* ── Rule U3: every space sits inside its own level, below the datum ──────── */

/**
 * Does each space occupy exactly the vertical interval its level records, and
 * is that interval entirely at or below the datum?
 *
 * Two questions in one result because they are two halves of one claim. The
 * first — a space's `yMin`/`yMax` equal its level's — cannot fail by
 * construction today, because the generator copies them, and that is exactly
 * why it is worth checking: it is the assertion that the copy is still a copy,
 * and it is the check that fires first if a later phase lets an elevation be
 * edited independently of its level.
 *
 * The second is the datum rule stated as arithmetic: `yMax <= 0`. A space whose
 * ceiling is exactly zero passes; one that pokes a centimetre above it does not.
 */
export function checkUndergroundInterval(
  input: UndergroundInput,
): ValidationResult[] {
  const byLevel = new Map(input.levels.map((level) => [level.level, level]))
  const faults: string[] = []
  const affected = new Set<string>()

  for (const space of input.spaces) {
    const level = byLevel.get(space.basementLevel)

    if (level === undefined) {
      faults.push(
        `space ${space.unitNumber} names basement ${space.basementLevel}, which does not exist`,
      )
      affected.add(space.id)
      continue
    }

    if (
      Math.abs(space.yMin - level.baseY) > OVERLAP_EPSILON_M ||
      Math.abs(space.yMax - level.topY) > OVERLAP_EPSILON_M
    ) {
      faults.push(
        `space ${space.unitNumber} spans ${m(space.yMin)}–${m(space.yMax)} but basement ${level.level} is ${m(level.baseY)}–${m(level.topY)}`,
      )
      affected.add(space.id)
    }

    // Below or exactly at the datum. `isWithinVerticalRange` is the same
    // epsilon-tolerant interval test the above-ground height check uses, with
    // the floor and ceiling that describe the excavation rather than the tower.
    const lowest = Math.min(...input.levels.map((entry) => entry.baseY))
    if (!isWithinVerticalRange(space, lowest, input.groundDatumY)) {
      faults.push(
        `space ${space.unitNumber} falls outside ${m(lowest)} – ${m(input.groundDatumY)}`,
      )
      affected.add(space.id)
    }
  }

  const lowestElevation =
    input.levels.length === 0
      ? input.groundDatumY
      : Math.min(...input.levels.map((level) => level.baseY))

  return [
    {
      id: 'underground-within-level',
      category: 'underground-containment',
      status: faults.length === 0 ? 'pass' : 'fail',
      chip: faults.length === 0 ? 'Depths valid' : `${affected.size} depth fault`,
      message:
        faults.length === 0
          ? `All underground volumes sit within ${lowestElevation.toFixed(1)} – ${input.groundDatumY.toFixed(1)} m, each inside its own level`
          : `${faults.length} underground vertical fault(s)`,
      affectedUnitIds: [...affected],
      details:
        faults.length === 0
          ? {
              'Permitted range': `${m(lowestElevation)} – ${m(input.groundDatumY)}`,
              'Spaces checked': input.spaces.length,
              'Ground datum': m(input.groundDatumY),
            }
          : { Faults: faults.slice(0, 4).join('; ') },
    },
  ]
}

/* ── Rule U4: nothing claims the same volume twice, on either side ────────── */

/**
 * Do any two underground volumes intersect, and does any underground volume
 * intersect an above-ground one?
 *
 * **Two results, one category**, because they are two genuinely different
 * failures that a presenter needs told apart. The first is an ordinary
 * same-layer dispute. The second is the one a 2D cadastre is structurally
 * incapable of seeing: two records whose plans coincide exactly and whose
 * *elevations* are what separate them. If the second ever fires, the answer to
 * "who owns this ground" depends on the third axis — which is the entire
 * argument for a 3D register.
 *
 * The cross-datum sweep is `spaces × aboveGround`, so it also covers the case
 * the model is built to hit: the basement ceiling at y = 0 and the ground-floor
 * slab at y = 0. Those share a plane and no volume, `getVolumeIntersection`
 * returns `null` for every such pair, and the check passes — which is the
 * demonstration that "touching is valid" is enforced rather than asserted.
 *
 * O(n²/2) within the basement and O(n × m) across it: 6 and 80 comparisons for
 * this model. A spatial index would be asymptotically better and premature.
 */
export function checkUndergroundOverlap(
  input: UndergroundInput,
): ValidationResult[] {
  const withinIds = new Set<string>()
  const withinPairs: string[] = []
  let withinVolume = 0

  for (let i = 0; i < input.spaces.length; i++) {
    for (let j = i + 1; j < input.spaces.length; j++) {
      const intersection = getVolumeIntersection(input.spaces[i], input.spaces[j])
      if (intersection === null) continue

      withinIds.add(input.spaces[i].id)
      withinIds.add(input.spaces[j].id)
      withinPairs.push(
        `${input.spaces[i].unitNumber} ∩ ${input.spaces[j].unitNumber}`,
      )
      withinVolume += intersection.volumeCubicM
    }
  }

  const crossIds = new Set<string>()
  let crossCount = 0
  let crossVolume = 0

  for (const space of input.spaces) {
    for (const above of input.aboveGround) {
      const intersection = getVolumeIntersection(space, above)
      if (intersection === null) continue

      crossIds.add(space.id)
      crossCount += 1
      crossVolume += intersection.volumeCubicM
    }
  }

  const withinPairCount = (input.spaces.length * (input.spaces.length - 1)) / 2

  return [
    {
      id: 'underground-overlap',
      category: 'underground-overlap',
      status: withinPairs.length === 0 ? 'pass' : 'fail',
      chip:
        withinPairs.length === 0
          ? 'No sub-conflicts'
          : `${withinPairs.length} sub-conflict${withinPairs.length === 1 ? '' : 's'}`,
      message:
        withinPairs.length === 0
          ? 'No two underground volumes intersect — shared walls and slabs only'
          : `${withinPairs.length} ownership conflict(s) between underground volumes`,
      affectedUnitIds: [...withinIds],
      details:
        withinPairs.length === 0
          ? { 'Pairs tested': withinPairCount, 'Intersecting pairs': 0 }
          : {
              'Pairs tested': withinPairCount,
              'Intersecting pairs': withinPairs.length,
              'Disputed volume': `${withinVolume.toFixed(1)} m³`,
              Pairs: withinPairs.join(', '),
            },
    },
    {
      // Its own category, not more `underground-overlap` results. The rule
      // above asks whether two below-ground volumes dispute each other; this
      // one asks whether the record respects the surface — contact at the datum
      // is the correct, expected relationship, and interpenetration is the
      // fault that only exists because the model has a third axis. A presenter
      // needs the two told apart, and the status bar gives each its own chip.
      id: 'surface-adjacency',
      category: 'surface-adjacency',
      status: crossCount === 0 ? 'pass' : 'fail',
      chip: crossCount === 0 ? 'Datum respected' : `${crossCount} datum breach`,
      message:
        crossCount === 0
          ? `No above-ground volume intersects an underground one — contact at the ${input.groundDatumY.toFixed(0)} m datum only`
          : `${crossCount} above-ground volume(s) interpenetrate the underground record`,
      affectedUnitIds: [...crossIds],
      details:
        crossCount === 0
          ? {
              'Pairs tested': input.spaces.length * input.aboveGround.length,
              'Intersecting pairs': 0,
              Rule: 'contact at the datum is valid; interpenetration is not',
            }
          : {
              'Pairs tested': input.spaces.length * input.aboveGround.length,
              'Intersecting pairs': crossCount,
              'Disputed volume': `${crossVolume.toFixed(1)} m³`,
            },
    },
  ]
}

/* ── Rule U5: the excavation matches the configuration ────────────────────── */

/**
 * Does the generated basement contain what the configuration asks for?
 *
 * A `warning` rather than a `fail`, matching `checkStructureCount` above
 * ground and for the same reason: a basement with three spaces instead of four
 * is not *spatially impossible*, it is a generator and a configuration
 * disagreeing. That is a bug worth surfacing loudly and not the same class of
 * thing as two people owning the same air.
 *
 * The expected figure is a parameter derived by the caller from the basement
 * config, never a literal — so a two-level basement keeps passing where a
 * hard-coded `4` would start failing on a correct model.
 */
export function checkUndergroundCount(
  input: UndergroundInput,
): ValidationResult[] {
  const matches = input.spaces.length === input.expectedSpaceCount

  return [
    {
      id: 'underground-count',
      category: 'underground-containment',
      status: matches ? 'pass' : 'warning',
      chip: matches
        ? `${input.spaces.length} sub-spaces`
        : `${input.spaces.length}/${input.expectedSpaceCount} sub-spaces`,
      message: matches
        ? `${input.spaces.length} underground volumes across ${input.levels.length} basement level(s), as configured`
        : 'Generated basement differs from the configuration',
      affectedUnitIds: [],
      details: {
        'Spaces generated': input.spaces.length,
        'Spaces expected': input.expectedSpaceCount,
        Levels: input.levels.length,
      },
    },
  ]
}

/**
 * Run every underground rule over one model.
 *
 * Returns an empty array when there is no basement, so a model without one
 * produces exactly the report it produced before this module existed — no
 * passing chips about an excavation that is not there.
 */
export function checkUnderground(input: UndergroundInput): ValidationResult[] {
  if (input.spaces.length === 0 && input.levels.length === 0) return []

  return [
    ...checkBasementLevels(input),
    ...checkUndergroundContainment(input),
    ...checkUndergroundInterval(input),
    ...checkUndergroundOverlap(input),
    ...checkUndergroundCount(input),
  ]
}
