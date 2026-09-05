/**
 * A pure self-check for the Phase 8 footprint-driven geometry.
 *
 * The project still has no test runner, and adding one is not Phase 8's job.
 * So the checks live as an ordinary pure function that returns results, plus a
 * thin dev-only runner that prints them — exactly the shape
 * `ulpin/ulpinSelfCheck.ts` established in Phase 6. `checkFootprintGeometry()`
 * takes no arguments, touches no globals, imports nothing but the model layer,
 * and returns data; the day Vitest arrives its body becomes a test file
 * unchanged.
 *
 * WHAT THIS IS ACTUALLY GUARDING
 * Phase 8 rewired where the building's horizontal geometry comes from. The
 * *point* of the phase was that the visible result should not change: the same
 * 18 × 14 m plan, the same 252 m², the same twenty units at 63 m² and 189 m³.
 * A refactor that quietly moved the geometry would look like a success and be a
 * failure, so the numbers Phases 3–7 produced are pinned here as **literals**.
 * A literal is the only kind of expectation that can fail: a value recomputed
 * the same way as the code under test agrees with any bug it contains.
 *
 * It is **not** a topology validator. Nothing here asks whether the footprint
 * lies inside the parcel, whether rings are simple, or whether units overlap.
 * That is Phase 9, and conflating the two would make this file the beginning of
 * an engine it is deliberately not.
 */

import { DEMO_BUILDING_FOOTPRINT, DEMO_PARCEL } from '../data/demoParcel'
import {
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  getTotalUnits,
} from '../scene/buildingConfig'
import { buildApartmentUnits } from '../scene/unitLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import {
  getFootprintCentroid,
  getFootprintMetrics,
  isAxisAlignedRectangle,
} from './footprint'

/**
 * Slack allowed on a metric comparison, in metres (or m² / m³ as applies).
 *
 * A tenth of a millimetre. The arithmetic here is exact in binary for these
 * inputs, so in practice every comparison lands on zero error; the tolerance
 * exists so that a future footprint authored with awkward decimals does not
 * fail on the last bit of a double.
 */
const EPSILON = 1e-4

/** Format a number for a result line without pretending to precision. */
function show(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4)
}

/** One numeric assertion, expressed as a `CheckResult`. */
function expectNumber(name: string, actual: number, expected: number): CheckResult {
  return {
    name,
    passed: Math.abs(actual - expected) <= EPSILON,
    expected: show(expected),
    actual: show(actual),
  }
}

/** One boolean assertion. */
function expectTrue(name: string, actual: boolean): CheckResult {
  return {
    name,
    passed: actual,
    expected: 'true',
    actual: String(actual),
  }
}

/**
 * Run every Phase 8 geometry check and return the results. Pure: no console,
 * no throw, no side effect of any kind.
 */
export function checkFootprintGeometry(): CheckResult[] {
  const footprint = DEMO_BUILDING_FOOTPRINT
  const config = DEFAULT_BUILDING_CONFIG
  const metrics = getFootprintMetrics(footprint)
  const centroid = getFootprintCentroid(footprint)
  const units = buildApartmentUnits(config, footprint)

  const results: CheckResult[] = [
    // ── The footprint polygon itself ─────────────────────────────────────
    expectNumber('footprint width (m)', metrics.widthM, 18),
    expectNumber('footprint depth (m)', metrics.depthM, 14),
    expectNumber('footprint area (m2)', metrics.areaSqM, 252),
    expectNumber('footprint centroid X (m)', centroid.x, 0),
    expectNumber('footprint centroid Z (m)', centroid.z, 0),
    expectNumber('footprint vertices', metrics.vertexCount, 4),
    expectTrue(
      'footprint is an axis-aligned rectangle (the prototype subdivision assumes it)',
      isAxisAlignedRectangle(footprint),
    ),

    // ── The vertical description, which the footprint says nothing about ──
    expectNumber('total height (m)', getTotalHeight(config), 15),
    expectNumber('floor height (m)', config.floorHeight, 3),
    expectNumber('floors', config.numberOfFloors, 5),

    // ── The generated property units ─────────────────────────────────────
    expectNumber('generated units', units.length, 20),
    expectNumber('units expected by config', getTotalUnits(config), 20),
  ]

  // Every unit must still be 9 x 7 x 3 m — 63 m2 of carpet, 189 m3 of volume.
  // Checked across all twenty rather than on a sample: a subdivision bug that
  // only affects the last column would sail past `units[0]`.
  const wrongArea = units.filter((unit) => Math.abs(unit.areaSqM - 63) > EPSILON)
  const wrongVolume = units.filter(
    (unit) => Math.abs(unit.volumeCubicM - 189) > EPSILON,
  )

  results.push(
    {
      name: 'every unit is 63 m2',
      passed: wrongArea.length === 0,
      expected: '20 of 20',
      actual: `${units.length - wrongArea.length} of ${units.length}`,
    },
    {
      name: 'every unit is 189 m3',
      passed: wrongVolume.length === 0,
      expected: '20 of 20',
      actual: `${units.length - wrongVolume.length} of ${units.length}`,
    },
  )

  // The units of one floor must tile the footprint's bounding box exactly —
  // no gap, no overlap, nothing left over. This is the check that would catch a
  // subdivision reading the wrong extent, which per-unit areas alone would not.
  const groundFloorArea = units
    .filter((unit) => unit.floorLevel === 1)
    .reduce((total, unit) => total + unit.areaSqM, 0)

  results.push(
    expectNumber('ground floor units tile the footprint (m2)', groundFloorArea, 252),
  )

  // Nothing may stand outside the surveyed plan.
  const outside = units.filter(
    (unit) =>
      unit.xMin < metrics.bounds.xMin - EPSILON ||
      unit.xMax > metrics.bounds.xMax + EPSILON ||
      unit.zMin < metrics.bounds.zMin - EPSILON ||
      unit.zMax > metrics.bounds.zMax + EPSILON,
  )

  results.push({
    name: 'no unit extends beyond the footprint bounds',
    passed: outside.length === 0,
    expected: 'none outside',
    actual:
      outside.length === 0
        ? 'none outside'
        : `${outside.length} outside: ${outside.map((unit) => unit.unitNumber).join(', ')}`,
  })

  // The whole point of the phase, stated as an assertion: the area the map
  // reports and the area the 3D pipeline measures are the same number, because
  // they are measurements of the same ring.
  results.push(
    expectNumber(
      'map footprint area equals model footprint area (m2)',
      DEMO_PARCEL.buildingFootprintAreaSqM,
      metrics.areaSqM,
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
export function runFootprintGeometrySelfCheck(): void {
  const results = checkFootprintGeometry()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] footprint geometry self-check passed (${results.length} checks) — 2D footprint drives the 3D model`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] footprint self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] footprint geometry self-check failed (${failures.length} of ${results.length}).`,
  )
}
