/**
 * Self-checks for the below-ground half of the model.
 *
 * WHAT THESE ARE FOR, AND WHAT THEY ARE NOT FOR
 * Every claim below is one an audience will be told out loud during the
 * demonstration — "the basement runs from minus three metres to zero", "there
 * are twenty-four spaces in total", "touching the datum is valid, crossing it
 * is not" — and every one of them is a number that could quietly stop being
 * true after an edit somewhere else. A claim a presenter makes on stage should
 * be a claim the software has already checked.
 *
 * They are **not** a test suite and they are not trying to be. There is no
 * runner, no framework and no new dependency: they are plain functions over the
 * same generators the application uses, invoked once at startup behind
 * `import.meta.env.DEV`, which is a compile-time constant — so the whole module
 * is removed from the production bundle.
 *
 * THE HALF THAT MATTERS MOST
 * Checks 7 and 8 are deliberately *negative*: they build a deliberately broken
 * basement and assert the validator **catches** it. A validator that only ever
 * sees valid models is indistinguishable from a function that returns "valid",
 * and the datum rule in particular — touching is fine, crossing is not — is one
 * a wrong epsilon or a flipped comparison would break in exactly the direction
 * nobody would notice. So it is checked from both sides.
 *
 * Pure: no console, no throw, no React, no Three.js. The runner at the foot is
 * the only thing that talks to the console.
 */

import { DEMO_BUILDING_FOOTPRINT, DEMO_PARCEL } from '../data/demoParcel'
import {
  buildFloorLayouts,
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  getTotalUnits,
  getUnitsPerFloor,
} from '../scene/buildingConfig'
import { buildApartmentUnits } from '../scene/unitLayout'
import { getBasementExplodedOffsetM } from '../scene/explodedView'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import { validateTopology } from '../validation/validateTopology'
import {
  buildBasementLevels,
  DEFAULT_BASEMENT_CONFIG,
  getTotalUndergroundSpaces,
  GROUND_DATUM_Y,
} from './basementConfig'
import { buildUndergroundSpaces } from './undergroundLayout'

/** Metre tolerance for a comparison of exactly-authored numbers. */
const EPSILON = 1e-9

/** Build one result. Local, so this module needs no assertion helper import. */
function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/**
 * Run every underground check and return the results.
 *
 * Everything is generated from the same configs and the same footprint the
 * application uses — no fixtures, no parallel model. A check that built its own
 * basement would be proving something about the check.
 */
export function checkUnderground(): CheckResult[] {
  const results: CheckResult[] = []

  const config = DEFAULT_BUILDING_CONFIG
  const basementConfig = DEFAULT_BASEMENT_CONFIG
  const footprint = DEMO_BUILDING_FOOTPRINT

  const floors = buildFloorLayouts(config)
  const units = buildApartmentUnits(config, footprint, floors)

  const levels = buildBasementLevels(basementConfig)
  const spaces = buildUndergroundSpaces(basementConfig, footprint, levels)

  /* ── 1–2. The canonical interval: −3.0 m → 0.0 m ─────────────────────── */

  const yMin = Math.min(...spaces.map((space) => space.yMin))
  const yMax = Math.max(...spaces.map((space) => space.yMax))

  results.push(
    expect(
      'basement floor sits at −3 m',
      Math.abs(yMin - -3) <= EPSILON,
      '-3 m',
      `${yMin} m`,
    ),
    expect(
      'basement ceiling sits exactly on the ground datum',
      Math.abs(yMax - GROUND_DATUM_Y) <= EPSILON,
      `${GROUND_DATUM_Y} m`,
      `${yMax} m`,
    ),
  )

  /* ── 3–4. The counts, derived rather than asserted ───────────────────── */

  results.push(
    expect(
      'four underground spaces are generated',
      spaces.length === 4 && spaces.length === getTotalUndergroundSpaces(basementConfig),
      '4',
      `${spaces.length}`,
    ),
    expect(
      'twenty-four 3D spaces in total',
      units.length + spaces.length === 24,
      '24',
      `${units.length} + ${spaces.length} = ${units.length + spaces.length}`,
    ),
  )

  /* ── 5. Identifiers are unique — across the datum, not merely below it ── */

  const allIdentifiers = [
    ...units.map((unit) => unit.prototypeUlpin),
    ...spaces.map((space) => space.prototypeUlpin),
  ]
  const distinct = new Set(allIdentifiers)

  results.push(
    expect(
      'every prototype 3D ULPIN is unique across both sides of the datum',
      distinct.size === allIdentifiers.length,
      `${allIdentifiers.length} distinct`,
      `${distinct.size} distinct`,
    ),
    expect(
      'underground identifiers use the basement prefix',
      spaces.every((space) => /-B\d{2}-U\d{2}$/.test(space.prototypeUlpin)),
      'all match -Bnn-Unn',
      spaces[0]?.prototypeUlpin ?? '(none)',
    ),
  )

  /* ── 6. The valid model validates, on both sides ─────────────────────── */

  const validInput = {
    parcelBoundary: DEMO_PARCEL.parcelBoundaryMetric,
    footprint,
    units,
    floors,
    totalHeightM: getTotalHeight(config),
    expectedUnitsPerFloor: getUnitsPerFloor(config),
    expectedTotalUnits: getTotalUnits(config),
    undergroundUnits: spaces,
    basementLevels: levels,
    groundDatumY: GROUND_DATUM_Y,
    expectedUndergroundSpaces: getTotalUndergroundSpaces(basementConfig),
    parentParcelId: DEMO_PARCEL.parcelId,
  }

  const validReport = validateTopology(validInput)

  results.push(
    expect(
      'the generated model with its basement validates cleanly',
      validReport.status === 'valid',
      'valid',
      `${validReport.status} (${validReport.failCount} fail, ${validReport.warningCount} warn)`,
    ),
    expect(
      'no underground volume overlaps another',
      validReport.results.find((result) => result.id === 'underground-overlap')
        ?.status === 'pass',
      'pass',
      validReport.results.find((result) => result.id === 'underground-overlap')
        ?.status ?? '(missing)',
    ),
    expect(
      'touching the ground datum is NOT reported as an overlap',
      validReport.results.find((result) => result.id === 'surface-adjacency')
        ?.status === 'pass',
      'pass',
      validReport.results.find((result) => result.id === 'surface-adjacency')
        ?.status ?? '(missing)',
    ),
    expect(
      'every 3D space belongs to the one parent parcel',
      validReport.results.find((result) => result.id === 'parcel-consistency')
        ?.status === 'pass',
      'pass',
      validReport.results.find((result) => result.id === 'parcel-consistency')
        ?.status ?? '(missing)',
    ),
  )

  /* ── 7. The datum rule, from the failing side ────────────────────────── */

  // One space raised ten centimetres above the datum, so it genuinely
  // interpenetrates the ground-floor units rather than touching them. Ten
  // centimetres is far above OVERLAP_EPSILON_M and far below anything that
  // would look wrong on screen — which is precisely the kind of error a
  // register has to catch and a picture will not.
  const raised = spaces.map((space, index) =>
    index === 0 ? { ...space, yMax: space.yMax + 0.1 } : space,
  )

  const raisedReport = validateTopology({
    ...validInput,
    undergroundUnits: raised,
  })

  results.push(
    expect(
      'a basement raised 0.1 m above the datum IS reported as a conflict',
      raisedReport.status === 'conflict',
      'conflict',
      raisedReport.status,
    ),
    expect(
      'and the crossing is attributed to the raised space',
      raisedReport.conflictedUnitIds.includes(spaces[0].id),
      spaces[0].id,
      raisedReport.conflictedUnitIds.join(', ') || '(none)',
    ),
  )

  /* ── 8. Horizontal containment, from the failing side ────────────────── */

  // One space pushed forty metres east — well outside a plot of this size.
  const displaced = spaces.map((space, index) =>
    index === 1
      ? { ...space, xMin: space.xMin + 40, xMax: space.xMax + 40 }
      : space,
  )

  const displacedReport = validateTopology({
    ...validInput,
    undergroundUnits: displaced,
  })

  results.push(
    expect(
      'an underground space outside the footprint IS reported',
      displacedReport.results.find(
        (result) => result.id === 'underground-within-footprint',
      )?.status === 'fail',
      'fail',
      displacedReport.results.find(
        (result) => result.id === 'underground-within-footprint',
      )?.status ?? '(missing)',
    ),
  )

  /* ── 9. Selected metadata matches the canonical geometry ─────────────── */

  // The check that the panel and the model cannot drift: a space's reported
  // area and volume must be its own bounds, not a second calculation.
  const sample = spaces[0]
  const derivedArea = (sample.xMax - sample.xMin) * (sample.zMax - sample.zMin)
  const derivedVolume = derivedArea * (sample.yMax - sample.yMin)

  results.push(
    expect(
      'a space’s recorded area and volume agree with its own bounds',
      Math.abs(sample.areaSqM - derivedArea) <= EPSILON &&
        Math.abs(sample.volumeCubicM - derivedVolume) <= EPSILON,
      `${derivedArea} m², ${derivedVolume} m³`,
      `${sample.areaSqM} m², ${sample.volumeCubicM} m³`,
    ),
    expect(
      'a space’s elevation agrees with the level it names',
      spaces.every((space) => {
        const level = levels.find((entry) => entry.level === space.basementLevel)
        return (
          level !== undefined &&
          Math.abs(space.yMin - level.baseY) <= EPSILON &&
          Math.abs(space.yMax - level.topY) <= EPSILON
        )
      }),
      'every space spans its own level',
      'compared',
    ),
  )

  /* ── 10. The downward explosion is a display transform and nothing more ── */

  const beforeExplosion = spaces.map((space) => `${space.yMin}:${space.yMax}`).join('|')
  const offsetStacked = getBasementExplodedOffsetM(0, 0)
  const offsetApart = getBasementExplodedOffsetM(0, 1)
  const afterExplosion = spaces.map((space) => `${space.yMin}:${space.yMax}`).join('|')

  results.push(
    expect(
      'the downward offset is zero when the stack is together',
      offsetStacked === 0,
      '0 m',
      `${offsetStacked} m`,
    ),
    expect(
      'the basement separates downward, not upward',
      offsetApart < 0,
      '< 0 m',
      `${offsetApart} m`,
    ),
    expect(
      'exploding downward does not touch a single recorded elevation',
      beforeExplosion === afterExplosion,
      'canonical bounds unchanged',
      beforeExplosion === afterExplosion ? 'unchanged' : 'MUTATED',
    ),
  )

  return results
}

/**
 * Development-only runner: execute the checks and report them in the console.
 *
 * A failure is logged with `console.error` **and rethrown**, so it cannot be
 * scrolled past — the same contract every other self-check in this project
 * follows. Guarded by `import.meta.env.DEV` at the call site, so it is dropped
 * from the production bundle entirely.
 */
export function runUndergroundSelfCheck(): void {
  const results = checkUnderground()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] underground self-check passed (${results.length} checks) — basement −3.0 → 0.0 m, 4 spaces, 24 total, datum enforced`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] underground self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] underground self-check failed (${failures.length} of ${results.length}).`,
  )
}
