/**
 * A pure self-check for the generation timeline and the camera presets.
 *
 * The project still has no test runner, and adding one is not this phase's job.
 * So the checks live as an ordinary pure function that returns results, plus a
 * thin dev-only runner that prints them — the shape `ulpin/ulpinSelfCheck.ts`
 * established and `geometry/footprintSelfCheck.ts` followed. It takes no
 * arguments, touches no globals, imports nothing but pure modules, and returns
 * data; the day Vitest arrives its body becomes a test file unchanged.
 *
 * WHAT THIS IS ACTUALLY GUARDING
 * An animation is the hardest kind of code to be sure about by looking at it,
 * because the thing that is wrong is usually a *moment* rather than a line — a
 * frame in the middle where the building is briefly inside out, a unit that
 * finishes at 0.98 instead of 1, a floor that arrives before the one below it.
 * None of that is visible in a diff and most of it is hard to catch by eye at
 * sixty frames a second.
 *
 * Because the entire sequence is a pure function of one number, it can be
 * *sampled* instead. The checks below walk the timeline in two hundred steps and
 * assert the properties that must hold at every one of them:
 *
 *   • **The endpoints are exact.** At 0 the scene is purely 2D — no envelope, no
 *     plates, no units. At 1 everything is fully present and selection is live.
 *     Not "close to"; exactly, because the settled state is what the user spends
 *     all their time in and a 0.997 opacity is a permanently transparent
 *     building.
 *
 *   • **Nothing ever goes backwards.** Every reveal is monotonic. A value that
 *     dips reads as a flicker, which is precisely the defect the brief rules out.
 *
 *   • **The wave travels upward.** Floor *i* is always at least as far along as
 *     floor *i+1*. If that inverts, the building assembles from the top down and
 *     the whole "construction" reading is lost.
 *
 *   • **The envelope hands over rather than coexisting.** It is absent at both
 *     ends and present only in between.
 *
 *   • **Out-of-range input is clamped, not extrapolated.** A progress value of
 *     1.4 must produce the settled state, not a building 140 % of its height.
 *
 * The exploded-view transform is checked separately, in
 * `scene/explodedSelfCheck.ts` — it grew its own subject when it gained a second
 * axis of separation, and a file that checks two unrelated things is one whose
 * failures are harder to read.
 */

import {
  getPresetView,
  type CameraPresetContext,
  type CameraPresetId,
} from '../scene/cameraPresets'
import { DEMO_BUILDING_FOOTPRINT } from '../data/demoParcel'
import { getFootprintMetrics } from '../geometry/footprint'
import { DEFAULT_BUILDING_CONFIG, getTotalHeight } from '../scene/buildingConfig'
import { buildFloorPlanCentres, NO_EXPLOSION } from '../scene/explodedView'
import { buildApartmentUnits } from '../scene/unitLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import { getGenerationVisuals } from './generationTimeline'

/** Slack on a comparison of two eased values. */
const EPSILON = 1e-9

/** How finely the timeline is walked. 200 steps ≈ every 11 ms of the sequence. */
const SAMPLE_COUNT = 200

/** One boolean assertion. */
function expect(name: string, passed: boolean, expected: string, actual: string): CheckResult {
  return { name, passed, expected, actual }
}

/** One exact-value assertion. */
function expectValue(name: string, actual: number, expected: number): CheckResult {
  return {
    name,
    passed: Math.abs(actual - expected) <= EPSILON,
    expected: String(expected),
    actual: actual.toFixed(6),
  }
}

/** Evenly spaced samples across `[0, 1]`, inclusive of both ends. */
function samples(): number[] {
  const values: number[] = []
  for (let step = 0; step <= SAMPLE_COUNT; step++) {
    values.push(step / SAMPLE_COUNT)
  }
  return values
}

/** Run every Phase 9 presentation check. Pure: no console, no throw. */
export function checkGenerationTimeline(): CheckResult[] {
  const config = DEFAULT_BUILDING_CONFIG
  const floorCount = config.numberOfFloors
  const results: CheckResult[] = []

  /* ── The two endpoints, exactly ───────────────────────────────────────── */

  const source = getGenerationVisuals(0, floorCount)
  const settled = getGenerationVisuals(1, floorCount)

  results.push(
    expect('source stage is "source"', source.stage === 'source', 'source', source.stage),
    expectValue('source: envelope absent', source.shellPresence, 0),
    expectValue('source: envelope has no height', source.shellHeightFraction, 0),
    expectValue('source: footprint at full emphasis', source.footprintEmphasis, 1),
    expect(
      'source: no floor plate is revealed',
      source.floorReveal.every((value) => value === 0),
      'all 0',
      source.floorReveal.map((value) => value.toFixed(2)).join(', '),
    ),
    expect(
      'source: no unit is revealed',
      source.unitReveal.every((value) => value === 0),
      'all 0',
      source.unitReveal.map((value) => value.toFixed(2)).join(', '),
    ),
    expect(
      'source: units are not selectable',
      !source.unitsInteractive,
      'false',
      String(source.unitsInteractive),
    ),

    expect('settled stage is "ready"', settled.stage === 'ready', 'ready', settled.stage),
    expectValue('settled: envelope gone', settled.shellPresence, 0),
    expectValue('settled: envelope at full height', settled.shellHeightFraction, 1),
    expect(
      'settled: every floor plate fully revealed',
      settled.floorReveal.every((value) => value === 1),
      'all 1',
      settled.floorReveal.map((value) => value.toFixed(4)).join(', '),
    ),
    expect(
      'settled: every unit fully revealed',
      settled.unitReveal.every((value) => value === 1),
      'all 1',
      settled.unitReveal.map((value) => value.toFixed(4)).join(', '),
    ),
    expect(
      'settled: units are selectable',
      settled.unitsInteractive && settled.isSettled,
      'true',
      String(settled.unitsInteractive && settled.isSettled),
    ),
    expect(
      'settled: one reveal entry per floor',
      settled.unitReveal.length === floorCount && settled.floorReveal.length === floorCount,
      String(floorCount),
      `${settled.floorReveal.length} / ${settled.unitReveal.length}`,
    ),
  )

  /* ── Properties that must hold at every sampled instant ───────────────── */

  const walk = samples().map((progress) => getGenerationVisuals(progress, floorCount))

  let heightWentBackwards = 0
  let revealWentBackwards = 0
  let waveInverted = 0
  let shellOutOfRange = 0

  for (let index = 1; index < walk.length; index++) {
    const previous = walk[index - 1]
    const current = walk[index]

    if (current.shellHeightFraction < previous.shellHeightFraction - EPSILON) {
      heightWentBackwards++
    }

    for (let floor = 0; floor < floorCount; floor++) {
      if (current.floorReveal[floor] < previous.floorReveal[floor] - EPSILON) {
        revealWentBackwards++
      }
      if (current.unitReveal[floor] < previous.unitReveal[floor] - EPSILON) {
        revealWentBackwards++
      }
    }
  }

  for (const frame of walk) {
    // Bottom-up: a lower floor is never behind a higher one.
    for (let floor = 1; floor < floorCount; floor++) {
      if (frame.floorReveal[floor] > frame.floorReveal[floor - 1] + EPSILON) waveInverted++
      if (frame.unitReveal[floor] > frame.unitReveal[floor - 1] + EPSILON) waveInverted++
    }

    if (frame.shellPresence < -EPSILON || frame.shellPresence > 1 + EPSILON) {
      shellOutOfRange++
    }
  }

  const shellEverVisible = walk.some((frame) => frame.shellPresence > 0.5)

  results.push(
    expect(
      'envelope height never decreases',
      heightWentBackwards === 0,
      '0 reversals',
      `${heightWentBackwards} reversals`,
    ),
    expect(
      'no floor or unit reveal ever decreases',
      revealWentBackwards === 0,
      '0 reversals',
      `${revealWentBackwards} reversals`,
    ),
    expect(
      'the build wave travels bottom-up',
      waveInverted === 0,
      '0 inversions',
      `${waveInverted} inversions`,
    ),
    expect(
      'envelope presence stays within [0, 1]',
      shellOutOfRange === 0,
      '0 excursions',
      `${shellOutOfRange} excursions`,
    ),
    expect(
      'the envelope is actually shown mid-transition',
      shellEverVisible,
      'true',
      String(shellEverVisible),
    ),
  )

  /* ── Clamping, and determinism ────────────────────────────────────────── */

  const below = getGenerationVisuals(-0.5, floorCount)
  const above = getGenerationVisuals(1.7, floorCount)

  results.push(
    expect(
      'progress below 0 clamps to the source state',
      below.stage === 'source' && below.shellPresence === 0,
      'source state',
      `${below.stage}, shell ${below.shellPresence}`,
    ),
    expect(
      'progress above 1 clamps to the settled state',
      above.stage === 'ready' && above.shellHeightFraction === 1,
      'settled state',
      `${above.stage}, height ${above.shellHeightFraction}`,
    ),
    expect(
      'the same progress always produces the same visuals',
      JSON.stringify(getGenerationVisuals(0.63, floorCount)) ===
        JSON.stringify(getGenerationVisuals(0.63, floorCount)),
      'identical',
      'compared',
    ),
  )

  /* ── Camera presets ───────────────────────────────────────────────────── */

  // The exploded-view transform has its own self-check as of Subphase A —
  // see `scene/explodedSelfCheck.ts`. It moved out of this file when the
  // transform gained a second axis: the checks it needs are about derived
  // directions and about the model *not* being written to, which is a different
  // subject from whether a timeline is monotonic.
  const units = buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT)
  const floorThree = units.find((unit) => unit.unitNumber === '301')

  const metrics = getFootprintMetrics(DEMO_BUILDING_FOOTPRINT)
  const totalHeightM = getTotalHeight(config)
  const baseContext: CameraPresetContext = {
    footprintMetrics: metrics,
    totalHeightM,
    floorCount,
    selectedUnit: null,
    // Unexploded: these checks are about the presets' own arithmetic, not about
    // how they follow a visualisation transform. The exploded case is covered in
    // `scene/explodedSelfCheck.ts`.
    explodeAmounts: NO_EXPLOSION,
    floorPlanCentres: buildFloorPlanCentres(units),
    // Nothing isolated: the `floor` preset has its own coverage in
    // `scene/floorIsolationSelfCheck.ts`, and these checks are about the
    // presets' own arithmetic.
    isolatedFloor: null,
    // And no conflict staged: the `conflict` preset's framing is checked where
    // the framing is derived, in `simulation/conflictPresentationSelfCheck.ts`.
    // What is asserted here is the *fallback* — a preset that needs a subject it
    // has not been given must still return a finite view rather than NaN, which
    // is why `conflict` joins the list below.
    conflictFraming: null,
  }

  const presets: CameraPresetId[] = [
    'parcel',
    'building',
    'top',
    'unit',
    'floor',
    'conflict',
  ]
  const nonFinite = presets.filter((preset) => {
    const view = getPresetView(preset, baseContext)
    return ![...view.position, ...view.target].every(Number.isFinite)
  })

  const topView = getPresetView('top', baseContext)
  const unitViewWithoutSelection = getPresetView('unit', baseContext)
  const buildingView = getPresetView('building', baseContext)
  const selectedContext: CameraPresetContext = { ...baseContext, selectedUnit: floorThree ?? null }
  const unitView = getPresetView('unit', selectedContext)

  results.push(
    expect(
      'every preset returns finite coordinates',
      nonFinite.length === 0,
      'all finite',
      nonFinite.length === 0 ? 'all finite' : nonFinite.join(', '),
    ),
    expect(
      'top view sits above the building',
      topView.position[1] > totalHeightM,
      `> ${totalHeightM} m`,
      `${topView.position[1].toFixed(1)} m`,
    ),
    expect(
      'unit view falls back to the building view when nothing is selected',
      JSON.stringify(unitViewWithoutSelection) === JSON.stringify(buildingView),
      'identical to building view',
      'compared',
    ),
    expect(
      'unit view targets the selected unit',
      floorThree !== undefined &&
        Math.abs(unitView.target[1] - (floorThree.yMin + floorThree.yMax) / 2) <= EPSILON,
      'unit centre elevation',
      `${unitView.target[1].toFixed(3)} m`,
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
export function runGenerationSelfCheck(): void {
  const results = checkGenerationTimeline()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] generation timeline self-check passed (${results.length} checks) — the 2D → 3D sequence is monotonic, bottom-up and exact at both ends`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] generation self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] generation timeline self-check failed (${failures.length} of ${results.length}).`,
  )
}
