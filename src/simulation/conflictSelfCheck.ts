/**
 * A pure self-check for the conflict simulation.
 *
 * WHAT THIS IS GUARDING
 * The simulation exists to prove the validator works, so it has to be beyond
 * suspicion itself. Three properties, and they are the whole file:
 *
 * **The canonical record survives.** The override must never write to the array
 * it is given. Checked the same way as the exploded transform: snapshot, apply
 * at full strength, compare. If this ever fails, "Restore Valid Geometry" would
 * restore a model that had already been damaged — the worst possible outcome for
 * a demonstration about the integrity of a register.
 *
 * **Restoring is exact.** Not "close to" the original, not "equal to" it — the
 * same array, by reference. That is a stronger guarantee than a deep comparison
 * and it is free, because the simulation is a function that returns its input
 * when inactive.
 *
 * **The engine discovers the conflict; it is not told.** The check runs the same
 * `validateTopology` the interface runs, over the simulated array, and requires
 * it to come back `conflict` with exactly the intended pair and a computed
 * intersection volume. Nothing sets a flag anywhere.
 *
 * And one more, easy to overlook: the encroachment is a **translation**, so the
 * moved unit's area, volume and identifier must be unchanged. A simulation that
 * also resized the flat would be demonstrating two defects at once and muddying
 * which one the validator caught.
 */

import { DEMO_BUILDING_FOOTPRINT, DEMO_PARCEL } from '../data/demoParcel'
import {
  buildFloorLayouts,
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  getTotalUnits,
  getUnitsPerFloor,
} from '../scene/buildingConfig'
import { buildApartmentUnits, type ApartmentUnit } from '../scene/unitLayout'
import { getUnitStatus } from '../scene/unitStatus'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import {
  findOwnershipConflicts,
  validateTopology,
  type TopologyInput,
} from '../validation/validateTopology'
import {
  applyConflictSimulation,
  DEFAULT_ENCROACHMENT_M,
  describeScenario,
  findEncroachmentPair,
  PREFERRED_CONFLICT_FLOOR,
} from './conflictSimulation'

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/** Build a validation input over a given unit array. */
function inputFor(units: readonly ApartmentUnit[]): TopologyInput {
  const config = DEFAULT_BUILDING_CONFIG
  return {
    parcelBoundary: DEMO_PARCEL.parcelBoundaryMetric,
    footprint: DEMO_BUILDING_FOOTPRINT,
    units,
    floors: buildFloorLayouts(config),
    totalHeightM: getTotalHeight(config),
    expectedUnitsPerFloor: getUnitsPerFloor(config),
    expectedTotalUnits: getTotalUnits(config),
  }
}

/** Run every conflict-simulation check. Pure: no console, no throw. */
export function checkConflictSimulation(): CheckResult[] {
  const config = DEFAULT_BUILDING_CONFIG
  const canonical = buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT)
  const results: CheckResult[] = []

  /* ── The pair is derived, and it is a genuine shared wall ─────────────── */

  const pair = findEncroachmentPair(canonical)

  results.push(
    expect(
      'an encroachment pair is found',
      pair !== null,
      'a pair',
      pair === null ? 'null' : `${pair.owner.unitNumber}/${pair.encroacher.unitNumber}`,
    ),
  )

  if (pair === null) return results

  results.push(
    expect(
      'the pair is on the preferred floor',
      pair.floorLevel === PREFERRED_CONFLICT_FLOOR,
      `floor ${PREFERRED_CONFLICT_FLOOR}`,
      `floor ${pair.floorLevel}`,
    ),
    expect(
      'the pair are on the same floor as each other',
      pair.owner.floorLevel === pair.encroacher.floorLevel,
      'same floor',
      `${pair.owner.floorLevel} / ${pair.encroacher.floorLevel}`,
    ),
    // The pair must NOT already be in conflict — they share a wall, which is
    // legal. If this failed, the "before" state of the demo would already be
    // invalid and the whole demonstration would be meaningless.
    expect(
      'the pair are legal neighbours before the simulation',
      findOwnershipConflicts([pair.owner, pair.encroacher] as ApartmentUnit[])
        .length === 0,
      '0 conflicts',
      String(
        findOwnershipConflicts([pair.owner, pair.encroacher] as ApartmentUnit[]).length,
      ),
    ),
    expect(
      'the direction is a unit sign',
      pair.direction === 1 || pair.direction === -1,
      '+1 or -1',
      String(pair.direction),
    ),
  )

  /* ── Applying the override ────────────────────────────────────────────── */

  const before = JSON.stringify(canonical)
  const simulated = applyConflictSimulation(canonical, pair, true)
  const after = JSON.stringify(canonical)

  results.push(
    expect(
      'THE ARCHITECTURAL CHECK: the canonical record is not written to',
      before === after,
      'canonical unchanged',
      before === after ? 'canonical unchanged' : 'CANONICAL WAS MODIFIED',
    ),
    expect(
      'the simulated array is a different array',
      simulated !== canonical,
      'new array',
      simulated === canonical ? 'same array' : 'new array',
    ),
    expect(
      'exactly one unit differs from the canonical record',
      simulated.filter((unit, index) => unit !== canonical[index]).length === 1,
      '1 unit',
      String(simulated.filter((unit, index) => unit !== canonical[index]).length),
    ),
  )

  /* ── The moved unit is translated, not resized ────────────────────────── */

  const movedBefore = canonical.find((unit) => unit.id === pair.encroacher.id)
  const movedAfter = simulated.find((unit) => unit.id === pair.encroacher.id)

  if (movedBefore !== undefined && movedAfter !== undefined) {
    const widthKept = movedAfter.xMax - movedAfter.xMin === movedBefore.xMax - movedBefore.xMin
    const depthKept = movedAfter.zMax - movedAfter.zMin === movedBefore.zMax - movedBefore.zMin

    results.push(
      expect(
        'the encroaching unit is translated, not resized',
        widthKept && depthKept,
        'extents preserved',
        `width kept ${widthKept}, depth kept ${depthKept}`,
      ),
      expect(
        'the encroaching unit keeps its area, volume and identifier',
        movedAfter.areaSqM === movedBefore.areaSqM &&
          movedAfter.volumeCubicM === movedBefore.volumeCubicM &&
          movedAfter.prototypeUlpin === movedBefore.prototypeUlpin,
        'unchanged',
        `${movedAfter.areaSqM} m2 / ${movedAfter.volumeCubicM} m3 / ${movedAfter.prototypeUlpin}`,
      ),
      expect(
        'the encroaching unit stays on its own floor',
        movedAfter.yMin === movedBefore.yMin && movedAfter.yMax === movedBefore.yMax,
        'elevation unchanged',
        `${movedAfter.yMin}–${movedAfter.yMax} m`,
      ),
    )
  }

  /* ── The engine discovers it ──────────────────────────────────────────── */

  const validReport = validateTopology(inputFor(canonical))
  const conflictReport = validateTopology(inputFor(simulated))
  const conflicts = findOwnershipConflicts(simulated)

  // Expected intersection: the encroachment distance along the shared axis, the
  // full extent on the other horizontal axis, the full floor height.
  const other =
    pair.axis === 'x'
      ? pair.encroacher.zMax - pair.encroacher.zMin
      : pair.encroacher.xMax - pair.encroacher.xMin
  const height = pair.encroacher.yMax - pair.encroacher.yMin
  const expectedVolume = DEFAULT_ENCROACHMENT_M * other * height

  results.push(
    expect(
      'before: the canonical model validates as VALID',
      validReport.status === 'valid',
      'valid',
      validReport.status,
    ),
    expect(
      'after: the simulated model validates as CONFLICT',
      conflictReport.status === 'conflict',
      'conflict',
      conflictReport.status,
    ),
    expect(
      'the engine finds exactly one conflicting pair',
      conflicts.length === 1,
      '1 pair',
      `${conflicts.length} pairs`,
    ),
    expect(
      'the engine names the intended pair',
      conflicts.length === 1 &&
        [conflicts[0].unitA.id, conflicts[0].unitB.id].sort().join('/') ===
          [pair.owner.id, pair.encroacher.id].sort().join('/'),
      [pair.owner.unitNumber, pair.encroacher.unitNumber].sort().join('/'),
      conflicts.length === 1
        ? [conflicts[0].unitA.unitNumber, conflicts[0].unitB.unitNumber].sort().join('/')
        : 'n/a',
    ),
    expect(
      'the intersection volume is computed from the geometry',
      conflicts.length === 1 &&
        Math.abs(conflicts[0].intersectionVolumeCubicM - expectedVolume) < 1e-6,
      `${expectedVolume} m3`,
      conflicts.length === 1
        ? `${conflicts[0].intersectionVolumeCubicM.toFixed(3)} m3`
        : 'n/a',
    ),
    expect(
      'both disputed units are flagged in the report',
      conflictReport.conflictedUnitIds.includes(pair.owner.id) &&
        conflictReport.conflictedUnitIds.includes(pair.encroacher.id),
      'both flagged',
      conflictReport.conflictedUnitIds.join(', '),
    ),
    // Everything *else* must still be fine — the simulation must not
    // accidentally break containment, the floor hierarchy or the identifiers,
    // or the demonstration would be about the wrong rule.
    expect(
      'only the overlap rule is violated — nothing else breaks',
      conflictReport.failCount === 1 &&
        conflictReport.results.find((r) => r.status === 'fail')?.category ===
          'ownership-overlap',
      '1 failure, ownership-overlap',
      `${conflictReport.failCount} failure(s): ${conflictReport.results
        .filter((r) => r.status === 'fail')
        .map((r) => r.category)
        .join(', ')}`,
    ),
  )

  /* ── Restoring ────────────────────────────────────────────────────────── */

  const restored = applyConflictSimulation(canonical, pair, false)

  results.push(
    expect(
      'restoring returns the canonical array by reference, not a copy',
      restored === canonical,
      'same array',
      restored === canonical ? 'same array' : 'a copy',
    ),
    expect(
      'the restored model validates as VALID again',
      validateTopology(inputFor(restored)).status === 'valid',
      'valid',
      validateTopology(inputFor(restored)).status,
    ),
    expect(
      'the restored model has zero conflicts',
      findOwnershipConflicts(restored).length === 0,
      '0 conflicts',
      String(findOwnershipConflicts(restored).length),
    ),
    expect(
      'a null pair is a no-op even when active',
      applyConflictSimulation(canonical, null, true) === canonical,
      'same array',
      applyConflictSimulation(canonical, null, true) === canonical
        ? 'same array'
        : 'a copy',
    ),
  )

  /* ── The semantic status hierarchy ────────────────────────────────────── */

  // The ordering that matters: a disputed unit stays disputed when selected.
  // If this inverts, clicking a red box to read its record turns the evidence
  // off — the exact failure the hierarchy exists to prevent.
  const flagged = new Set(conflictReport.conflictedUnitIds)
  const disputedId = pair.encroacher.id
  const cleanId =
    canonical.find(
      (unit) => unit.id !== pair.owner.id && unit.id !== pair.encroacher.id,
    )?.id ?? ''

  results.push(
    expect(
      'STATUS: a disputed unit reads as conflict',
      getUnitStatus(disputedId, {
        conflictedUnitIds: flagged,
        selectedUnitId: null,
        hoveredUnitId: null,
        isTargetable: true,
      }) === 'conflict',
      'conflict',
      getUnitStatus(disputedId, {
        conflictedUnitIds: flagged,
        selectedUnitId: null,
        hoveredUnitId: null,
        isTargetable: true,
      }),
    ),
    expect(
      'STATUS: conflict outranks selection — selecting a dispute does not hide it',
      getUnitStatus(disputedId, {
        conflictedUnitIds: flagged,
        selectedUnitId: disputedId,
        hoveredUnitId: disputedId,
        isTargetable: true,
      }) === 'conflict',
      'conflict',
      getUnitStatus(disputedId, {
        conflictedUnitIds: flagged,
        selectedUnitId: disputedId,
        hoveredUnitId: disputedId,
        isTargetable: true,
      }),
    ),
    expect(
      'STATUS: selection outranks hover',
      getUnitStatus(cleanId, {
        conflictedUnitIds: flagged,
        selectedUnitId: cleanId,
        hoveredUnitId: cleanId,
        isTargetable: true,
      }) === 'selected',
      'selected',
      getUnitStatus(cleanId, {
        conflictedUnitIds: flagged,
        selectedUnitId: cleanId,
        hoveredUnitId: cleanId,
        isTargetable: true,
      }),
    ),
    expect(
      'STATUS: an untargetable unit shows no hover feedback',
      getUnitStatus(cleanId, {
        conflictedUnitIds: flagged,
        selectedUnitId: null,
        hoveredUnitId: cleanId,
        isTargetable: false,
      }) === 'normal',
      'normal',
      getUnitStatus(cleanId, {
        conflictedUnitIds: flagged,
        selectedUnitId: null,
        hoveredUnitId: cleanId,
        isTargetable: false,
      }),
    ),
    expect(
      'STATUS: with a clean report no unit is in conflict',
      canonical.every(
        (unit) =>
          getUnitStatus(unit.id, {
            conflictedUnitIds: new Set(validReport.conflictedUnitIds),
            selectedUnitId: null,
            hoveredUnitId: null,
            isTargetable: true,
          }) === 'normal',
      ),
      'all normal',
      'checked all 20',
    ),
  )

  /* ── The scenario describes what actually happens ─────────────────────── */

  const scenario = describeScenario(pair)

  results.push(
    expect(
      'the scenario names the units the simulation actually moves',
      scenario !== null &&
        scenario.ownerNumber === pair.owner.unitNumber &&
        scenario.encroacherNumber === pair.encroacher.unitNumber &&
        scenario.floorLevel === pair.floorLevel,
      `${pair.owner.unitNumber} / ${pair.encroacher.unitNumber} on floor ${pair.floorLevel}`,
      scenario === null
        ? 'null'
        : `${scenario.ownerNumber} / ${scenario.encroacherNumber} on floor ${scenario.floorLevel}`,
    ),
  )

  return results
}

/** Development-only runner. Logs, then throws on any failure. */
export function runConflictSimulationSelfCheck(): void {
  const results = checkConflictSimulation()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] conflict-simulation self-check passed (${results.length} checks) — the engine discovers the conflict, and restoring is exact`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] conflict-simulation self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] conflict-simulation self-check failed (${failures.length} of ${results.length}).`,
  )
}
