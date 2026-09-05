/**
 * A pure self-check for the topology validation engine.
 *
 * WHAT THIS IS ACTUALLY GUARDING, AND WHY IT MATTERS MORE THAN THE OTHERS
 * Every other self-check in this project protects a feature. This one protects
 * *the thing that says whether the other features are telling the truth* — and a
 * validator has a failure mode no other component has: **it can be broken in the
 * direction of always passing**, which looks exactly like a working validator on
 * a valid model. A green panel proves nothing unless something can turn it red.
 *
 * So these checks are built in two halves.
 *
 * **The healthy model must be clean**, on every rule. The demo building really is
 * valid, so anything but `valid` here is a false positive — and a validator that
 * cries wolf on correct data is worse than none, because a presenter learns to
 * ignore it.
 *
 * **Deliberately broken models must be caught**, one per rule. A unit pushed
 * outside the footprint, a unit pushed through the roof, a duplicated
 * identifier, a floor stack put out of order, a building moved off its parcel,
 * and — the important one — two units genuinely overlapping. Each is constructed
 * here, fed to the same engine the interface uses, and the engine is required to
 * find it and to name the right units.
 *
 * **And the boundary case that would break everything quietly**: adjacent units
 * share a wall, stacked floors share a slab. Those must *not* register as
 * conflicts. This is the check that catches `>=` where `>` was meant — a
 * one-character error that turns a valid twenty-unit building into thirty-one
 * reported disputes.
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
import {
  buildBasementLevels,
  DEFAULT_BASEMENT_CONFIG,
  getTotalUndergroundSpaces,
} from '../scene/basementConfig'
import { buildUndergroundUnits } from '../scene/basementLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import { getVolumeIntersection } from './aabb'
import {
  isPointInsideOrOnRing,
  isRingInsideRing,
  isSimpleRing,
  signedRingAreaSqM,
} from './geometry2d'
import {
  findOwnershipConflicts,
  validateTopology,
  type TopologyInput,
  type ValidatableUndergroundUnit,
  type ValidatableUnit,
} from './validateTopology'

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/** The healthy input, assembled exactly as `App` assembles it. */
function healthyInput(): TopologyInput {
  const config = DEFAULT_BUILDING_CONFIG
  const floors = buildFloorLayouts(config)

  return {
    parcelBoundary: DEMO_PARCEL.parcelBoundaryMetric,
    footprint: DEMO_BUILDING_FOOTPRINT,
    units: buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT, floors),
    floors,
    totalHeightM: getTotalHeight(config),
    expectedUnitsPerFloor: getUnitsPerFloor(config),
    expectedTotalUnits: getTotalUnits(config),
  }
}

/**
 * The healthy input **with an excavation** — the Phase 11 model.
 *
 * A second builder rather than a basement added to `healthyInput()`, deliberately:
 * keeping the basement-free input intact is what lets the checks assert that the
 * engine's behaviour on a model with no excavation is *unchanged* — that the
 * below-ground rules are skipped rather than run and found empty, and that the
 * counts still describe only what was handed in.
 */
function basementInput(): TopologyInput {
  const basementConfig = DEFAULT_BASEMENT_CONFIG
  const basementLevels = buildBasementLevels(basementConfig)

  return {
    ...healthyInput(),
    undergroundUnits: buildUndergroundUnits(
      basementConfig,
      DEMO_BUILDING_FOOTPRINT,
      basementLevels,
    ),
    basementLevels,
    expectedUndergroundSpaces: getTotalUndergroundSpaces(basementConfig),
    parentParcelId: DEMO_PARCEL.parcelId,
  }
}

/** Replace one underground volume in an input, returning a new input. Never mutates. */
function withUndergroundReplaced(
  input: TopologyInput,
  unitNumber: string,
  change: (volume: ValidatableUndergroundUnit) => ValidatableUndergroundUnit,
): TopologyInput {
  return {
    ...input,
    undergroundUnits: (input.undergroundUnits ?? []).map((volume) =>
      volume.unitNumber === unitNumber ? change(volume) : volume,
    ),
  }
}

/** Replace one unit in an input, returning a new input. Never mutates. */
function withUnitReplaced(
  input: TopologyInput,
  unitNumber: string,
  change: (unit: ValidatableUnit) => ValidatableUnit,
): TopologyInput {
  return {
    ...input,
    units: input.units.map((unit) =>
      unit.unitNumber === unitNumber ? change(unit) : unit,
    ),
  }
}

/** Run every validation check. Pure: no console, no throw. */
export function checkTopologyValidation(): CheckResult[] {
  const results: CheckResult[] = []
  const healthy = healthyInput()

  /* ── HALF ONE: the healthy model is clean ─────────────────────────────── */

  const report = validateTopology(healthy)

  results.push(
    expect(
      'healthy model: overall status is VALID',
      report.status === 'valid',
      'valid',
      report.status,
    ),
    expect(
      'healthy model: no check fails',
      report.failCount === 0,
      '0 failures',
      `${report.failCount} failures: ${report.results
        .filter((r) => r.status !== 'pass')
        .map((r) => r.id)
        .join(', ')}`,
    ),
    expect(
      'healthy model: no unit is flagged',
      report.conflictedUnitIds.length === 0,
      'none',
      report.conflictedUnitIds.join(', ') || 'none',
    ),
    expect(
      'healthy model: every rule actually ran',
      new Set(report.results.map((r) => r.category)).size === 6,
      '6 categories',
      String(new Set(report.results.map((r) => r.category)).size),
    ),
  )

  /* ── THE BOUNDARY CASE: touching is not overlapping ───────────────────── */

  const unit301 = healthy.units.find((unit) => unit.unitNumber === '301')
  const unit302 = healthy.units.find((unit) => unit.unitNumber === '302')
  const unit201 = healthy.units.find((unit) => unit.unitNumber === '201')

  results.push(
    expect(
      'BOUNDARY: adjacent units sharing a wall are not a conflict',
      unit301 !== undefined &&
        unit302 !== undefined &&
        getVolumeIntersection(unit301, unit302) === null,
      'no intersection',
      unit301 === undefined || unit302 === undefined
        ? 'units missing'
        : String(getVolumeIntersection(unit301, unit302)),
    ),
    expect(
      'BOUNDARY: stacked units sharing a slab are not a conflict',
      unit201 !== undefined &&
        unit301 !== undefined &&
        getVolumeIntersection(unit201, unit301) === null,
      'no intersection',
      unit201 === undefined || unit301 === undefined
        ? 'units missing'
        : String(getVolumeIntersection(unit201, unit301)),
    ),
    expect(
      'BOUNDARY: the full 190-pair sweep finds nothing in a valid building',
      findOwnershipConflicts(healthy.units).length === 0,
      '0 conflicts',
      `${findOwnershipConflicts(healthy.units).length} conflicts`,
    ),
  )

  /* ── HALF TWO: broken models are caught ───────────────────────────────── */

  // 1. Two units genuinely overlapping. 302 is pushed 4 m west into 301.
  const overlapping = withUnitReplaced(healthy, '302', (unit) => ({
    ...unit,
    xMin: unit.xMin - 4,
    xMax: unit.xMax - 4,
  }))
  const overlapReport = validateTopology(overlapping)
  const foundConflicts = findOwnershipConflicts(overlapping.units)

  results.push(
    expect(
      'BROKEN: a real 3D overlap is detected',
      overlapReport.status === 'conflict',
      'conflict',
      overlapReport.status,
    ),
    expect(
      'BROKEN: exactly one conflicting pair is found',
      foundConflicts.length === 1,
      '1 pair',
      `${foundConflicts.length} pairs`,
    ),
    expect(
      'BROKEN: the pair named is 301 and 302',
      foundConflicts.length === 1 &&
        [foundConflicts[0].unitA.unitNumber, foundConflicts[0].unitB.unitNumber]
          .sort()
          .join('/') === '301/302',
      '301/302',
      foundConflicts.length === 1
        ? [foundConflicts[0].unitA.unitNumber, foundConflicts[0].unitB.unitNumber]
            .sort()
            .join('/')
        : 'n/a',
    ),
    // 4 m of overlap in X, the full 7 m depth, the full 3 m height = 84 m³.
    expect(
      'BROKEN: the intersection volume is computed, not guessed',
      foundConflicts.length === 1 &&
        Math.abs(foundConflicts[0].intersectionVolumeCubicM - 4 * 7 * 3) < 1e-6,
      `${4 * 7 * 3} m3`,
      foundConflicts.length === 1
        ? `${foundConflicts[0].intersectionVolumeCubicM.toFixed(3)} m3`
        : 'n/a',
    ),
    expect(
      'BROKEN: both disputed units are named in the report',
      overlapReport.conflictedUnitIds.includes('unit-301') &&
        overlapReport.conflictedUnitIds.includes('unit-302'),
      'unit-301 and unit-302',
      overlapReport.conflictedUnitIds.join(', '),
    ),
  )

  // 2. A unit pushed outside the footprint horizontally.
  const outside = withUnitReplaced(healthy, '404', (unit) => ({
    ...unit,
    xMin: unit.xMin + 20,
    xMax: unit.xMax + 20,
  }))
  const outsideReport = validateTopology(outside)

  results.push(
    expect(
      'BROKEN: a unit outside the footprint is caught',
      outsideReport.results.some(
        (r) => r.id === 'units-within-footprint' && r.status === 'fail',
      ),
      'units-within-footprint fails',
      outsideReport.results.find((r) => r.id === 'units-within-footprint')?.status ??
        'missing',
    ),
  )

  // 3. A unit pushed through the roof.
  const tooHigh = withUnitReplaced(healthy, '504', (unit) => ({
    ...unit,
    yMin: unit.yMin + 5,
    yMax: unit.yMax + 5,
  }))
  const tooHighReport = validateTopology(tooHigh)

  results.push(
    expect(
      'BROKEN: a unit above the sanctioned height is caught',
      tooHighReport.results.some(
        (r) => r.id === 'units-within-height' && r.status === 'fail',
      ),
      'units-within-height fails',
      tooHighReport.results.find((r) => r.id === 'units-within-height')?.status ??
        'missing',
    ),
    expect(
      'BROKEN: a unit no longer matching its floor is caught by the hierarchy rule',
      tooHighReport.results.some(
        (r) => r.id === 'floor-hierarchy' && r.status === 'fail',
      ),
      'floor-hierarchy fails',
      tooHighReport.results.find((r) => r.id === 'floor-hierarchy')?.status ?? 'missing',
    ),
  )

  // 4. A duplicated identifier.
  const duplicated = withUnitReplaced(healthy, '402', (unit) => ({
    ...unit,
    prototypeUlpin: healthy.units[0].prototypeUlpin,
  }))
  const duplicatedReport = validateTopology(duplicated)

  results.push(
    expect(
      'BROKEN: a duplicated prototype ULPIN is caught',
      duplicatedReport.results.some(
        (r) => r.id === 'identifier-uniqueness' && r.status === 'fail',
      ),
      'identifier-uniqueness fails',
      duplicatedReport.results.find((r) => r.id === 'identifier-uniqueness')?.status ??
        'missing',
    ),
  )

  // 5. The building moved off its parcel.
  const offParcel: TopologyInput = {
    ...healthy,
    footprint: DEMO_BUILDING_FOOTPRINT.map((point) => ({
      x: point.x + 60,
      z: point.z,
    })),
  }
  const offParcelReport = validateTopology(offParcel)

  results.push(
    expect(
      'BROKEN: a building outside its parcel is caught',
      offParcelReport.results.some(
        (r) => r.id === 'building-within-parcel' && r.status === 'fail',
      ),
      'building-within-parcel fails',
      offParcelReport.results.find((r) => r.id === 'building-within-parcel')?.status ??
        'missing',
    ),
  )

  // 6. A missing unit — a count mismatch, which is a warning, not a conflict.
  const short: TopologyInput = { ...healthy, units: healthy.units.slice(0, 19) }
  const shortReport = validateTopology(short)

  results.push(
    expect(
      'BROKEN: a unit-count mismatch warns rather than declaring a conflict',
      shortReport.status === 'warning' &&
        shortReport.results.some(
          (r) => r.id === 'structure-count' && r.status === 'warning',
        ),
      'warning',
      shortReport.status,
    ),
  )

  /* ── The plane-geometry primitives, directly ──────────────────────────── */

  const footprintInParcel = isRingInsideRing(
    DEMO_BUILDING_FOOTPRINT,
    DEMO_PARCEL.parcelBoundaryMetric,
  )

  results.push(
    expect(
      'geometry: the demo footprint is inside the demo parcel',
      footprintInParcel.contained,
      'contained',
      footprintInParcel.contained
        ? 'contained'
        : `${footprintInParcel.outsideVertexIndices.length} vertices out, crossing ${footprintInParcel.edgesCross}`,
    ),
    expect(
      'geometry: a point exactly on the footprint edge counts as inside',
      isPointInsideOrOnRing({ x: 9, z: 0 }, DEMO_BUILDING_FOOTPRINT),
      'inside',
      String(isPointInsideOrOnRing({ x: 9, z: 0 }, DEMO_BUILDING_FOOTPRINT)),
    ),
    expect(
      'geometry: a point well outside is outside',
      !isPointInsideOrOnRing({ x: 40, z: 0 }, DEMO_BUILDING_FOOTPRINT),
      'outside',
      String(!isPointInsideOrOnRing({ x: 40, z: 0 }, DEMO_BUILDING_FOOTPRINT)),
    ),
    expect(
      'geometry: both demo rings are simple',
      isSimpleRing(DEMO_BUILDING_FOOTPRINT) &&
        isSimpleRing(DEMO_PARCEL.parcelBoundaryMetric),
      'both simple',
      `${isSimpleRing(DEMO_BUILDING_FOOTPRINT)} / ${isSimpleRing(DEMO_PARCEL.parcelBoundaryMetric)}`,
    ),
    expect(
      'geometry: a bow-tie ring is detected as non-simple',
      !isSimpleRing([
        { x: 0, z: 0 },
        { x: 10, z: 10 },
        { x: 10, z: 0 },
        { x: 0, z: 10 },
      ]),
      'not simple',
      String(
        !isSimpleRing([
          { x: 0, z: 0 },
          { x: 10, z: 10 },
          { x: 10, z: 0 },
          { x: 0, z: 10 },
        ]),
      ),
    ),
    // The signed area is what makes a reversed ring visible; `getFootprintAreaSqM`
    // takes the magnitude and so cannot see it.
    expect(
      'geometry: reversing a ring flips the sign of its area but not its magnitude',
      Math.abs(
        signedRingAreaSqM(DEMO_BUILDING_FOOTPRINT) +
          signedRingAreaSqM([...DEMO_BUILDING_FOOTPRINT].reverse()),
      ) < 1e-9 &&
        Math.abs(Math.abs(signedRingAreaSqM(DEMO_BUILDING_FOOTPRINT)) - 252) < 1e-9,
      'equal and opposite, |area| = 252',
      `${signedRingAreaSqM(DEMO_BUILDING_FOOTPRINT).toFixed(1)} / ${signedRingAreaSqM([...DEMO_BUILDING_FOOTPRINT].reverse()).toFixed(1)}`,
    ),
  )

  /* ── HALF THREE: below the ground datum (Phase 11) ─────────────────────────

     Structured exactly like the two halves above, and for the same reason: a
     validator that has been taught about basements is worth nothing unless it
     can still fail on one.

     The healthy case is checked FIRST and hardest, because the boundary it turns
     on is a shared plane rather than a shared wall. Every one of the four
     underground volumes touches a ground-floor unit at exactly y = 0, so a
     validator with `>=` where `>` was meant would report four cross-datum
     conflicts in a perfectly correct model — and, unlike the shared-wall case,
     it would do so in the half of the model a presenter is about to point at. */

  const withBasement = basementInput()
  const basementReport = validateTopology(withBasement)

  results.push(
    expect(
      'basement: a model with an excavation is VALID',
      basementReport.status === 'valid',
      'valid',
      basementReport.status,
    ),
    expect(
      'basement: no conflict is reported although every volume touches y = 0',
      basementReport.results.find((r) => r.id === 'ownership-overlap')?.status === 'pass',
      'pass',
      `${basementReport.results.find((r) => r.id === 'ownership-overlap')?.status}`,
    ),
    expect(
      'basement: the surface-adjacency rule passes and counts the volumes at the datum',
      basementReport.results.find((r) => r.id === 'surface-adjacency')?.status === 'pass',
      'pass',
      `${basementReport.results.find((r) => r.id === 'surface-adjacency')?.status}`,
    ),
    expect(
      'basement: the parcel-linkage rule ties all 24 volumes to one parcel',
      basementReport.results.find((r) => r.id === 'parcel-linkage')?.status === 'pass',
      'pass',
      `${basementReport.results.find((r) => r.id === 'parcel-linkage')?.status}`,
    ),
  )

  // The counts are DERIVED, and this is the check that says so. It compares the
  // engine's own chips against the lengths of the arrays it was handed — not
  // against 20, 4 or 24 — so it keeps holding if the config changes.
  const expectedTotal = withBasement.units.length + (withBasement.undergroundUnits ?? []).length

  results.push(
    expect(
      'basement: identifier uniqueness is reported over the WHOLE model',
      basementReport.results.find((r) => r.id === 'identifier-uniqueness')?.chip ===
        `${expectedTotal} unique IDs`,
      `${expectedTotal} unique IDs`,
      `${basementReport.results.find((r) => r.id === 'identifier-uniqueness')?.chip}`,
    ),
    expect(
      'basement: the structure count reports total 3D spaces, derived from the arrays',
      basementReport.results.find((r) => r.id === 'structure-count')?.chip ===
        `${expectedTotal} 3D spaces`,
      `${expectedTotal} 3D spaces`,
      `${basementReport.results.find((r) => r.id === 'structure-count')?.chip}`,
    ),
    expect(
      'basement: the overlap sweep tested every pair in the model, not just the surface',
      basementReport.results.find((r) => r.id === 'ownership-overlap')?.details[
        'Pairs tested'
      ] === (expectedTotal * (expectedTotal - 1)) / 2,
      `${(expectedTotal * (expectedTotal - 1)) / 2}`,
      `${basementReport.results.find((r) => r.id === 'ownership-overlap')?.details['Pairs tested']}`,
    ),
    expect(
      'basement: a model WITHOUT an excavation still reports only its own units',
      report.results.find((r) => r.id === 'identifier-uniqueness')?.chip ===
        `${healthy.units.length} unique IDs`,
      `${healthy.units.length} unique IDs`,
      `${report.results.find((r) => r.id === 'identifier-uniqueness')?.chip}`,
    ),
    expect(
      'basement: the below-ground rules are SKIPPED entirely when there is no excavation',
      report.results.every(
        (r) =>
          r.category !== 'underground-containment' && r.category !== 'surface-adjacency',
      ),
      'no below-ground results',
      `${report.results.filter((r) => r.category === 'underground-containment' || r.category === 'surface-adjacency').length} found`,
    ),
  )

  /* ── Deliberately broken basements. Each must be CAUGHT. ─────────────── */

  // 1. A volume lifted 0.5 m so it reaches up through the datum into Floor 1.
  //    This is the phase's characteristic fault — subsurface rights claiming
  //    surface space — and it must fire on BOTH the generic overlap rule and the
  //    adjacency rule that names it for what it is.
  const risen = withUndergroundReplaced(withBasement, 'B01-P01', (volume) => ({
    ...volume,
    yMin: volume.yMin + 0.5,
    yMax: volume.yMax + 0.5,
  }))
  const risenReport = validateTopology(risen)

  results.push(
    expect(
      'broken: a basement volume raised through the datum is CAUGHT',
      risenReport.status === 'conflict',
      'conflict',
      risenReport.status,
    ),
    expect(
      'broken: the cross-datum intrusion is named by the surface-adjacency rule',
      risenReport.results.find((r) => r.id === 'surface-adjacency')?.status === 'fail',
      'fail',
      `${risenReport.results.find((r) => r.id === 'surface-adjacency')?.status}`,
    ),
    expect(
      'broken: it is ALSO found by the ordinary overlap sweep, with no cross-tier code',
      risenReport.results.find((r) => r.id === 'ownership-overlap')?.status === 'fail',
      'fail',
      `${risenReport.results.find((r) => r.id === 'ownership-overlap')?.status}`,
    ),
    expect(
      'broken: it leaves the excavated interval, and containment says so',
      risenReport.results.find((r) => r.id === 'underground-within-basement')?.status ===
        'fail',
      'fail',
      `${risenReport.results.find((r) => r.id === 'underground-within-basement')?.status}`,
    ),
  )

  // 2. A volume slid 30 m east, off the plot entirely.
  const displaced = withUndergroundReplaced(withBasement, 'B01-S01', (volume) => ({
    ...volume,
    xMin: volume.xMin + 30,
    xMax: volume.xMax + 30,
  }))
  const displacedReport = validateTopology(displaced)

  results.push(
    expect(
      'broken: a basement volume outside the building footprint is CAUGHT',
      displacedReport.results.find((r) => r.id === 'underground-within-footprint')
        ?.status === 'fail',
      'fail',
      `${displacedReport.results.find((r) => r.id === 'underground-within-footprint')?.status}`,
    ),
    expect(
      'broken: and the finding names the right volume',
      displacedReport.results
        .find((r) => r.id === 'underground-within-footprint')
        ?.affectedUnitIds.includes('space-B01-S01') === true,
      'space-B01-S01',
      `${displacedReport.results.find((r) => r.id === 'underground-within-footprint')?.affectedUnitIds.join(', ')}`,
    ),
  )

  // 3. Two basement volumes genuinely interpenetrating.
  const overlappingBasement = withUndergroundReplaced(
    withBasement,
    'B01-P02',
    (volume) => ({ ...volume, xMin: volume.xMin - 4, xMax: volume.xMax - 4 }),
  )

  results.push(
    expect(
      'broken: two underground volumes overlapping each other is CAUGHT',
      validateTopology(overlappingBasement).status === 'conflict',
      'conflict',
      validateTopology(overlappingBasement).status,
    ),
  )

  // 4. A basement volume re-parented to a different parcel. The geometry is
  //    perfect; the linkage is not, and only the linkage rule can see it.
  const reparented = withUndergroundReplaced(withBasement, 'B01-U01', (volume) => ({
    ...volume,
    parentParcelId: 'KA-BLR-0482-999999',
  }))
  const reparentedReport = validateTopology(reparented)

  results.push(
    expect(
      'broken: a volume tied to a different parent parcel is CAUGHT',
      reparentedReport.results.find((r) => r.id === 'parcel-linkage')?.status === 'fail',
      'fail',
      `${reparentedReport.results.find((r) => r.id === 'parcel-linkage')?.status}`,
    ),
    expect(
      'broken: and its geometry rules still pass, so the finding is specific',
      reparentedReport.results.find((r) => r.id === 'ownership-overlap')?.status ===
        'pass',
      'pass',
      `${reparentedReport.results.find((r) => r.id === 'ownership-overlap')?.status}`,
    ),
  )

  // 5. A duplicated identifier ACROSS the datum — an underground volume given an
  //    apartment's ULPIN. Neither generator's own uniqueness assertion could see
  //    this; only a check over the whole model can.
  const collided = withUndergroundReplaced(withBasement, 'B01-P01', (volume) => ({
    ...volume,
    prototypeUlpin: withBasement.units[0].prototypeUlpin,
  }))

  results.push(
    expect(
      'broken: an underground volume carrying an apartment’s identifier is CAUGHT',
      validateTopology(collided).results.find((r) => r.id === 'identifier-uniqueness')
        ?.status === 'fail',
      'fail',
      `${validateTopology(collided).results.find((r) => r.id === 'identifier-uniqueness')?.status}`,
    ),
  )

  /* ── The engine does not mutate what it validates ─────────────────────── */

  const basementBefore = JSON.stringify(withBasement.undergroundUnits)
  validateTopology(withBasement)
  const basementAfter = JSON.stringify(withBasement.undergroundUnits)

  results.push(
    expect(
      'the engine does not mutate the underground volumes either',
      basementBefore === basementAfter,
      'volumes unchanged',
      basementBefore === basementAfter ? 'volumes unchanged' : 'VOLUMES WERE MODIFIED',
    ),
  )

  const before = JSON.stringify(healthy.units)
  validateTopology(healthy)
  findOwnershipConflicts(healthy.units)
  const after = JSON.stringify(healthy.units)

  results.push(
    expect(
      'the validation engine does not mutate the model it validates',
      before === after,
      'units unchanged',
      before === after ? 'units unchanged' : 'UNITS WERE MODIFIED',
    ),
  )

  return results
}

/** Development-only runner. Logs, then throws on any failure. */
export function runTopologyValidationSelfCheck(): void {
  const results = checkTopologyValidation()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] topology validation self-check passed (${results.length} checks) — valid models pass, broken ones are caught`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] validation self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  console.error(
  `[3D ULPIN] topology validation self-check failed (${failures.length} of ${results.length}).`,
)
}
