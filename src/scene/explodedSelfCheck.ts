/**
 * A pure self-check for the exploded-view transform.
 *
 * The project still has no test runner, and adding one is not this subphase's
 * job. So the checks live as an ordinary pure function that returns results,
 * plus a thin dev-only runner that prints them — the shape
 * `ulpin/ulpinSelfCheck.ts` established and every later phase has followed.
 *
 * WHAT THIS IS ACTUALLY GUARDING
 * Two different things, and the second is the important one.
 *
 * **That the offsets are right.** The horizontal direction is *derived* from
 * where a unit sits on its floor rather than tabulated per unit, which is the
 * correct design and also the one that fails silently: a sign error would move
 * every unit inward instead of outward, and on a symmetric 2 × 2 grid the
 * result is still symmetric and still looks deliberate. So the checks assert the
 * direction against the geometry it claims to be derived from, unit by unit.
 *
 * **That the transform is a transform.** The whole architectural claim of the
 * exploded view is that it *reads* the cadastral model and never writes to it.
 * That is a property of the code rather than of any single value, so it is
 * checked the only way such a property can be: take a deep snapshot of the
 * units, run every offset function over them at full explosion, and assert the
 * units are byte-identical afterwards. If someone ever "optimises" one of these
 * functions into an in-place mutation, this is what catches it.
 */

import { DEMO_BUILDING_FOOTPRINT } from '../data/demoParcel'
import { DEFAULT_BUILDING_CONFIG } from './buildingConfig'
import {
  buildFloorPlanCentres,
  EXPLODED_FLOOR_GAP_M,
  EXPLODED_UNIT_DISTANCE_M,
  getExplodedOffsetM,
  getPlanCentre,
  getUnitDisplayOffsetM,
  getUnitPlanOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import { buildApartmentUnits } from './unitLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'

/** Slack on a metric comparison, in metres. */
const EPSILON = 1e-9

/** Fully exploded, both axes. */
const FULL: ExplodeAmounts = { floors: 1, units: 1 }
/** The resting state. */
const NONE: ExplodeAmounts = { floors: 0, units: 0 }

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

function expectValue(name: string, actual: number, expected: number): CheckResult {
  return {
    name,
    passed: Math.abs(actual - expected) <= EPSILON,
    expected: expected.toFixed(4),
    actual: actual.toFixed(4),
  }
}

/** Run every exploded-view check. Pure: no console, no throw, no side effect. */
export function checkExplodedView(): CheckResult[] {
  const config = DEFAULT_BUILDING_CONFIG
  const units = buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT)
  const floorCentres = buildFloorPlanCentres(units)
  const results: CheckResult[] = []

  /* ── The vertical separation ──────────────────────────────────────────── */

  results.push(
    expectValue('vertical: ground floor never moves', getExplodedOffsetM(0, 1), 0),
    expectValue('vertical: amount 0 offsets nothing', getExplodedOffsetM(4, 0), 0),
    expectValue(
      'vertical: floor 5 rises 4 gaps',
      getExplodedOffsetM(4, 1),
      4 * EXPLODED_FLOOR_GAP_M,
    ),
    expect(
      'vertical: each floor is lifted further than the one below',
      [1, 2, 3, 4].every(
        (floor) => getExplodedOffsetM(floor, 1) > getExplodedOffsetM(floor - 1, 1),
      ),
      'strictly increasing',
      [0, 1, 2, 3, 4].map((floor) => getExplodedOffsetM(floor, 1).toFixed(1)).join(', '),
    ),
  )

  /* ── The floor plan centre ────────────────────────────────────────────── */

  const floorThreeCentre = floorCentres.get(3)
  results.push(
    expect(
      'plan centre: every floor has one',
      floorCentres.size === config.numberOfFloors,
      String(config.numberOfFloors),
      String(floorCentres.size),
    ),
    expect(
      'plan centre: floor 3 is at the origin (the demo footprint is centred there)',
      floorThreeCentre !== undefined &&
        Math.abs(floorThreeCentre.x) <= EPSILON &&
        Math.abs(floorThreeCentre.z) <= EPSILON,
      '(0, 0)',
      floorThreeCentre === undefined
        ? 'missing'
        : `(${floorThreeCentre.x}, ${floorThreeCentre.z})`,
    ),
    expect(
      'plan centre: an empty group returns the origin rather than NaN',
      getPlanCentre([]).x === 0 && getPlanCentre([]).z === 0,
      '(0, 0)',
      `(${getPlanCentre([]).x}, ${getPlanCentre([]).z})`,
    ),
  )

  /* ── The horizontal separation ────────────────────────────────────────── */

  // Every unit must move exactly EXPLODED_UNIT_DISTANCE_M — that is what
  // normalising the direction buys, and it is the property that would break
  // first if the normalisation were dropped.
  const wrongDistance = units.filter((unit) => {
    const centre = floorCentres.get(unit.floorLevel)
    if (centre === undefined) return true
    const offset = getUnitPlanOffsetM(unit, centre, 1)
    return Math.abs(Math.hypot(offset.x, offset.z) - EXPLODED_UNIT_DISTANCE_M) > EPSILON
  })

  // The direction must agree in sign with the unit's own position on its floor.
  // This is the check a mirrored or negated direction fails, and a symmetric
  // grid would otherwise hide.
  const wrongDirection = units.filter((unit) => {
    const centre = floorCentres.get(unit.floorLevel)
    if (centre === undefined) return true
    const offset = getUnitPlanOffsetM(unit, centre, 1)
    const unitCentreX = (unit.xMin + unit.xMax) / 2
    const unitCentreZ = (unit.zMin + unit.zMax) / 2
    return (
      Math.sign(offset.x) !== Math.sign(unitCentreX - centre.x) ||
      Math.sign(offset.z) !== Math.sign(unitCentreZ - centre.z)
    )
  })

  results.push(
    expect(
      'horizontal: every unit moves exactly the explosion distance',
      wrongDistance.length === 0,
      `${units.length} of ${units.length}`,
      `${units.length - wrongDistance.length} of ${units.length}`,
    ),
    expect(
      'horizontal: every unit moves outward, away from its floor centre',
      wrongDirection.length === 0,
      'all outward',
      wrongDirection.length === 0
        ? 'all outward'
        : `${wrongDirection.length} wrong: ${wrongDirection.map((u) => u.unitNumber).join(', ')}`,
    ),
  )

  // Diagonally opposite units must move in exactly opposite directions, so the
  // floor opens symmetrically rather than drifting as a whole.
  const unit301 = units.find((unit) => unit.unitNumber === '301')
  const unit304 = units.find((unit) => unit.unitNumber === '304')
  const centre3 = floorCentres.get(3)

  if (unit301 !== undefined && unit304 !== undefined && centre3 !== undefined) {
    const a = getUnitPlanOffsetM(unit301, centre3, 1)
    const b = getUnitPlanOffsetM(unit304, centre3, 1)
    results.push(
      expect(
        'horizontal: opposite units (301 / 304) move in opposite directions',
        Math.abs(a.x + b.x) <= EPSILON && Math.abs(a.z + b.z) <= EPSILON,
        'offsets sum to (0, 0)',
        `(${(a.x + b.x).toFixed(6)}, ${(a.z + b.z).toFixed(6)})`,
      ),
    )
  } else {
    results.push(
      expect('horizontal: units 301 and 304 exist', false, 'both present', 'missing'),
    )
  }

  // A unit sitting exactly on its floor's centre has no outward direction. It
  // must not move, and must not produce NaN from a division by zero.
  const centred = { xMin: -1, xMax: 1, zMin: -1, zMax: 1, floorLevel: 1 }
  const centredOffset = getUnitPlanOffsetM(centred, { x: 0, z: 0 } as PlanPoint, 1)
  results.push(
    expect(
      'horizontal: a unit on the floor centre does not move (and is not NaN)',
      centredOffset.x === 0 && centredOffset.z === 0,
      '(0, 0)',
      `(${centredOffset.x}, ${centredOffset.z})`,
    ),
  )

  /* ── The combined display offset ──────────────────────────────────────── */

  const allZeroAtRest = units.every((unit) => {
    const centre = floorCentres.get(unit.floorLevel) ?? { x: 0, z: 0 }
    const [x, y, z] = getUnitDisplayOffsetM(unit, centre, NONE)
    return x === 0 && y === 0 && z === 0
  })

  results.push(
    expect(
      'combined: no explosion means no offset at all',
      allZeroAtRest,
      'all (0, 0, 0)',
      allZeroAtRest ? 'all (0, 0, 0)' : 'some non-zero',
    ),
  )

  if (unit301 !== undefined && centre3 !== undefined) {
    const [, y] = getUnitDisplayOffsetM(unit301, centre3, FULL)
    results.push(
      expectValue(
        'combined: unit 301 is lifted by its floor, not by its own index',
        y,
        2 * EXPLODED_FLOOR_GAP_M,
      ),
    )
  }

  /* ── THE ARCHITECTURAL CHECK: the transform never writes ──────────────── */

  const before = JSON.stringify(units)
  for (const unit of units) {
    const centre = floorCentres.get(unit.floorLevel) ?? { x: 0, z: 0 }
    getUnitDisplayOffsetM(unit, centre, FULL)
    getUnitPlanOffsetM(unit, centre, 1)
    getExplodedOffsetM(unit.floorLevel - 1, 1)
  }
  const after = JSON.stringify(units)

  results.push(
    expect(
      'the exploded transform does not mutate the cadastral model',
      before === after,
      'units unchanged',
      before === after ? 'units unchanged' : 'UNITS WERE MODIFIED',
    ),
  )

  // Stated again against the one record the interface quotes most often, so a
  // failure names something a human recognises rather than a hash mismatch.
  const stillCorrect =
    unit301 !== undefined &&
    unit301.yMin === 6 &&
    unit301.yMax === 9 &&
    unit301.areaSqM === 63 &&
    unit301.volumeCubicM === 189

  results.push(
    expect(
      'unit 301 still reports 6–9 m, 63 m2, 189 m3 after a full explosion',
      stillCorrect,
      '6–9 m, 63 m2, 189 m3',
      unit301 === undefined
        ? 'missing'
        : `${unit301.yMin}–${unit301.yMax} m, ${unit301.areaSqM} m2, ${unit301.volumeCubicM} m3`,
    ),
  )

  return results
}

/**
 * Development-only runner: execute the checks and report them in the console.
 *
 * A failure is logged with `console.error` *and* rethrown, so it cannot be
 * scrolled past. Guarded by `import.meta.env.DEV` at the call site so it is
 * dropped from the production bundle entirely.
 */
export function runExplodedViewSelfCheck(): void {
  const results = checkExplodedView()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] exploded-view self-check passed (${results.length} checks) — offsets derived, model untouched`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] exploded-view self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] exploded-view self-check failed (${failures.length} of ${results.length}).`,
  )
}
