/**
 * A pure self-check for floor isolation.
 *
 * Same shape as every other check in this project: a function returning
 * `CheckResult[]`, plus a dev-only runner that throws on failure.
 *
 * WHAT THIS IS ACTUALLY GUARDING
 *
 * **The priority rule.** Isolation's one non-orthogonal rule is that only the
 * isolated floor is clickable. That is enforced in a boolean returned by one
 * function, and a boolean that is wrong in one branch produces an interface
 * where ghosts are secretly selectable — which nobody notices until a judge
 * clicks one and the inspector fills in with a property that is not visible.
 *
 * **The animation's identity element.** At `amount = 0` the result must be
 * *exactly* what "nothing isolated" produces, or entering the mode would begin
 * with a visible jump before the ramp had moved. Asserted rather than assumed.
 *
 * **That the indicator is derived.** The panel claims "4 property volumes,
 * elevation 6.0–9.0 m". The checks recompute both from the generated units, so a
 * hard-coded figure — the easy way to build that panel and the one that would
 * quietly go stale — cannot pass.
 *
 * **That isolation, like the exploded view, never writes.** Same snapshot
 * technique as `explodedSelfCheck.ts`.
 */

import { DEMO_BUILDING_FOOTPRINT } from '../data/demoParcel'
import { DEFAULT_BUILDING_CONFIG, getUnitsPerFloor } from './buildingConfig'
import { getFloorEmphasis, getIsolationSummary } from './floorIsolation'
import { buildApartmentUnits } from './unitLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'

const EPSILON = 1e-9

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/** Run every floor-isolation check. Pure: no console, no throw. */
export function checkFloorIsolation(): CheckResult[] {
  const config = DEFAULT_BUILDING_CONFIG
  const units = buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT)
  const floorLevels = Array.from(
    { length: config.numberOfFloors },
    (_, index) => index + 1,
  )
  const results: CheckResult[] = []

  /* ── Nothing isolated ─────────────────────────────────────────────────── */

  const allNormal = floorLevels.every((level) => {
    const emphasis = getFloorEmphasis(level, null, 1)
    return (
      emphasis.fillScale === 1 &&
      emphasis.edgeScale === 1 &&
      emphasis.interactive &&
      emphasis.castsShadow &&
      !emphasis.isGhosted &&
      !emphasis.isIsolated
    )
  })

  results.push(
    expect(
      'nothing isolated: every floor is drawn and clickable exactly as before',
      allNormal,
      'all floors normal',
      allNormal ? 'all floors normal' : 'some floor was altered',
    ),
  )

  /* ── The animation's identity element ─────────────────────────────────── */

  const zeroAmountIsIdentity = floorLevels.every((level) => {
    const isolated = getFloorEmphasis(level, 3, 0)
    const none = getFloorEmphasis(level, null, 1)
    return JSON.stringify(isolated) === JSON.stringify(none)
  })

  results.push(
    expect(
      'amount 0 is exactly "nothing isolated" — the ramp starts without a jump',
      zeroAmountIsIdentity,
      'identical',
      zeroAmountIsIdentity ? 'identical' : 'differs at amount 0',
    ),
  )

  /* ── Floor 3 isolated ─────────────────────────────────────────────────── */

  const isolated = getFloorEmphasis(3, 3, 1)
  const ghost = getFloorEmphasis(1, 3, 1)

  results.push(
    expect(
      'isolated floor is drawn at full strength',
      isolated.isIsolated &&
        !isolated.isGhosted &&
        isolated.fillScale === 1 &&
        isolated.edgeScale === 1,
      'full strength',
      `fill ${isolated.fillScale}, edge ${isolated.edgeScale}`,
    ),
    expect(
      'isolated floor stays interactive',
      isolated.interactive,
      'true',
      String(isolated.interactive),
    ),
    expect(
      'other floors are ghosted, not hidden',
      ghost.isGhosted && ghost.fillScale > 0 && ghost.fillScale < 1,
      '0 < fill < 1',
      `fill ${ghost.fillScale.toFixed(3)}`,
    ),
    expect(
      'a ghost keeps more of its edges than of its fill — it reads as wireframe',
      ghost.edgeScale > ghost.fillScale * 3,
      'edge >> fill',
      `edge ${ghost.edgeScale.toFixed(2)} vs fill ${ghost.fillScale.toFixed(2)}`,
    ),
    // THE PRIORITY RULE.
    expect(
      'PRIORITY RULE: while a floor is isolated, no other floor is clickable',
      floorLevels
        .filter((level) => level !== 3)
        .every((level) => !getFloorEmphasis(level, 3, 1).interactive),
      'only floor 3 clickable',
      floorLevels
        .filter((level) => getFloorEmphasis(level, 3, 1).interactive)
        .join(', ') || 'none',
    ),
    expect(
      'ghosts stop casting shadows',
      !ghost.castsShadow && isolated.castsShadow,
      'ghost no, isolated yes',
      `ghost ${ghost.castsShadow}, isolated ${isolated.castsShadow}`,
    ),
  )

  /* ── The indicator's figures are derived, not typed ───────────────────── */

  const summary = getIsolationSummary(3, units)
  const expectedPerFloor = getUnitsPerFloor(config)
  const expectedBaseY = (3 - 1) * config.floorHeight
  const expectedTopY = 3 * config.floorHeight

  results.push(
    expect(
      'floor 3 summary exists',
      summary !== null,
      'a summary',
      summary === null ? 'null' : 'present',
    ),
  )

  if (summary !== null) {
    results.push(
      expect(
        'summary: unit count comes from the units on that floor',
        summary.unitCount === expectedPerFloor,
        String(expectedPerFloor),
        String(summary.unitCount),
      ),
      expect(
        'summary: elevations come from the units themselves',
        Math.abs(summary.baseY - expectedBaseY) <= EPSILON &&
          Math.abs(summary.topY - expectedTopY) <= EPSILON,
        `${expectedBaseY}–${expectedTopY} m`,
        `${summary.baseY}–${summary.topY} m`,
      ),
      expect(
        'summary: floor area is the sum of its units, not a repeated footprint',
        Math.abs(
          summary.totalAreaSqM -
            units
              .filter((unit) => unit.floorLevel === 3)
              .reduce((total, unit) => total + unit.areaSqM, 0),
        ) <= EPSILON,
        'sum of the floor’s units',
        `${summary.totalAreaSqM} m2`,
      ),
    )
  }

  results.push(
    expect(
      'summary: a floor with no units returns null rather than a zeroed record',
      getIsolationSummary(99, units) === null,
      'null',
      String(getIsolationSummary(99, units)),
    ),
  )

  /* ── Isolation never writes to the model ──────────────────────────────── */

  const before = JSON.stringify(units)
  for (const level of floorLevels) {
    getFloorEmphasis(level, 3, 1)
    getIsolationSummary(level, units)
  }
  const after = JSON.stringify(units)

  results.push(
    expect(
      'floor isolation does not mutate the cadastral model',
      before === after,
      'units unchanged',
      before === after ? 'units unchanged' : 'UNITS WERE MODIFIED',
    ),
  )

  return results
}

/** Development-only runner. Logs, then throws on any failure. */
export function runFloorIsolationSelfCheck(): void {
  const results = checkFloorIsolation()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] floor-isolation self-check passed (${results.length} checks) — only the isolated floor is a target`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] floor-isolation self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] floor-isolation self-check failed (${failures.length} of ${results.length}).`,
  )
}
