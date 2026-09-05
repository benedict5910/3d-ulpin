/**
 * A pure self-check for the below-ground model.
 *
 * WHAT THIS IS GUARDING
 * Phase 11's claim is small and precise: *a 3D cadastre can hold rights and
 * spaces beneath the surface, not only apartments above it.* Almost everything
 * that could quietly falsify that claim is a **sign error** or an **off-by-one at
 * the datum**, and neither is visible on screen. A basement drawn at −3 → 0 m and
 * a basement drawn at 0 → 3 m look identical from a low camera angle; a basement
 * that silently overlaps the ground floor by a millimetre looks exactly like one
 * that touches it.
 *
 * So the assertions below concentrate on the arithmetic nobody can eyeball:
 *
 *   • the vertical interval is **negative**, and exactly `−depth → 0`
 *   • the plan is **the building's own footprint**, not a look-alike rectangle
 *   • the volumes do not overlap each other, and do not overlap the building
 *   • **touching Floor 1 at exactly `y = 0` is not an overlap** — the boundary
 *     case that would break everything quietly, in the direction of "the
 *     validator reports twenty-four conflicts in a correct model"
 *   • the identifiers are the exact strings the scheme specifies, and are
 *     distinct from all twenty above ground
 *   • what the inspector shows is what the geometry records
 *
 * Two of those deserve their own note.
 *
 * **The touching case is checked from both directions.** It is not enough to
 * assert that no conflict is found; the check also asserts that the pair really
 * is coincident — that the y-overlap is *exactly zero* rather than negative — so
 * a basement accidentally generated a metre lower would not pass by simply
 * failing to reach the building. "They do not overlap" and "they meet exactly"
 * are different statements and both are required.
 *
 * **The identifier check is exact, not structural.** A regex for
 * `B\d\d-[PSU]\d\d` would pass on `B01-P01, B01-P02, B01-P03, B01-P04` — a
 * generator that had forgotten the use pattern entirely. The expected set is
 * written out, so the check fails if the uses, their order, or the per-use
 * numbering changes.
 *
 * Pure: no console, no throw, no DOM. Runs in bare Node.
 */

import {
  buildBasementLevels,
  DEFAULT_BASEMENT_CONFIG,
  getBasementDepthM,
  getSpacesPerBasementLevel,
  getTotalUndergroundSpaces,
} from './basementConfig'
import {
  buildUndergroundUnits,
  getUndergroundUnitCentre,
} from './basementLayout'
import { buildApartmentUnits } from './unitLayout'
import { countPropertyVolumes } from './propertyVolume'
import {
  EXPLODED_FLOOR_GAP_M,
  getBasementExplodedOffsetM,
  getExplodedApparentDepthM,
  getExplodedOffsetM,
} from './explodedView'
import { DEFAULT_BUILDING_CONFIG } from './buildingConfig'
import { DEMO_BUILDING_FOOTPRINT } from '../data/demoParcel'
import { getFootprintBounds } from '../geometry/footprint'
import {
  DATUM_EPSILON_M,
  GROUND_DATUM_Y,
  isUnderground,
  straddlesGroundDatum,
  touchesGroundDatum,
} from '../geometry/groundDatum'
import {
  getOverlapExtents,
  getVolumeIntersection,
  OVERLAP_EPSILON_M,
} from '../validation/aabb'
import { findDuplicateIdentifiers } from '../ulpin/generateUlpin'
import { DEMO_PARCEL_IDENTITY, formatParentParcelId } from '../ulpin/parcelIdentity'
import { buildInspectorRecord } from '../ui/inspectorRecord'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/** Compare two numbers at the model's own tolerance. */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= OVERLAP_EPSILON_M
}

/**
 * The identifiers the scheme must produce for the demo basement, in order.
 *
 * Written out rather than generated, deliberately — see the note at the top. A
 * check that built its expectation with the same function it is checking would
 * pass on any consistent generator, including a wrong one.
 */
const EXPECTED_IDENTIFIERS = [
  'KA-BLR-0482-001928-B01-P01',
  'KA-BLR-0482-001928-B01-P02',
  'KA-BLR-0482-001928-B01-S01',
  'KA-BLR-0482-001928-B01-U01',
] as const

/** Run every below-ground check. Pure: no console, no throw. */
export function checkBasementModel(): CheckResult[] {
  const results: CheckResult[] = []

  const config = DEFAULT_BASEMENT_CONFIG
  const buildingConfig = DEFAULT_BUILDING_CONFIG
  const levels = buildBasementLevels(config)
  const spaces = buildUndergroundUnits(config, DEMO_BUILDING_FOOTPRINT, levels)
  const units = buildApartmentUnits(buildingConfig, DEMO_BUILDING_FOOTPRINT)
  const depth = getBasementDepthM(config)

  /* ── The vertical interval ──────────────────────────────────────────────── */

  results.push(
    expect(
      'one basement level is generated',
      levels.length === config.numberOfLevels,
      `${config.numberOfLevels}`,
      `${levels.length}`,
    ),
  )

  const level = levels[0]

  results.push(
    expect(
      'basement level 1 floor is at −3.0 m',
      near(level.baseY, -3),
      '-3.00 m',
      `${level.baseY.toFixed(2)} m`,
    ),
    expect(
      'basement level 1 ceiling is the ground datum, y = 0',
      near(level.topY, GROUND_DATUM_Y),
      '0.00 m',
      `${level.topY.toFixed(2)} m`,
    ),
    expect(
      'basement level 1 centre is at −1.5 m',
      near(level.centerY, -1.5),
      '-1.50 m',
      `${level.centerY.toFixed(2)} m`,
    ),
  )

  const wrongYMin = spaces.filter((space) => !near(space.yMin, -depth))
  const wrongYMax = spaces.filter((space) => !near(space.yMax, GROUND_DATUM_Y))

  results.push(
    expect(
      'every underground volume has yMin = −3',
      wrongYMin.length === 0,
      '0 volumes with a wrong floor',
      `${wrongYMin.length}`,
    ),
    expect(
      'every underground volume has yMax = 0',
      wrongYMax.length === 0,
      '0 volumes with a wrong ceiling',
      `${wrongYMax.length}`,
    ),
    expect(
      'every underground volume has a POSITIVE height (a depth is a length)',
      spaces.every((space) => space.height > 0 && near(space.height, config.levelHeight)),
      `${config.levelHeight.toFixed(2)} m`,
      `${(spaces[0]?.height ?? Number.NaN).toFixed(2)} m`,
    ),
    expect(
      'every underground volume lies at or below the ground datum',
      spaces.every((space) => isUnderground(space)),
      'all below y = 0',
      `${spaces.filter((s) => !isUnderground(s)).length} not below`,
    ),
    expect(
      'no underground volume straddles the ground datum',
      spaces.every((space) => !straddlesGroundDatum(space)),
      '0 straddling',
      `${spaces.filter((s) => straddlesGroundDatum(s)).length}`,
    ),
    expect(
      'every underground volume touches the ground datum (its ceiling is y = 0)',
      spaces.every((space) => touchesGroundDatum(space)),
      `${spaces.length} touching`,
      `${spaces.filter((s) => touchesGroundDatum(s)).length}`,
    ),
    expect(
      'the datum epsilon matches the overlap epsilon',
      DATUM_EPSILON_M === OVERLAP_EPSILON_M,
      `${OVERLAP_EPSILON_M}`,
      `${DATUM_EPSILON_M}`,
    ),
  )

  /* ── The counts ─────────────────────────────────────────────────────────── */

  results.push(
    expect(
      'four underground volumes are generated',
      spaces.length === getTotalUndergroundSpaces(config),
      `${getTotalUndergroundSpaces(config)}`,
      `${spaces.length}`,
    ),
    expect(
      'the level holds unitColumns × unitRows volumes',
      spaces.length === getSpacesPerBasementLevel(config) * config.numberOfLevels,
      `${getSpacesPerBasementLevel(config) * config.numberOfLevels}`,
      `${spaces.length}`,
    ),
  )

  const counts = countPropertyVolumes(units, spaces)

  results.push(
    expect(
      'total 3D spaces = above ground + underground',
      counts.total === counts.aboveGround + counts.underground &&
        counts.total === units.length + spaces.length,
      `${units.length} + ${spaces.length} = ${units.length + spaces.length}`,
      `${counts.aboveGround} + ${counts.underground} = ${counts.total}`,
    ),
  )

  /* ── The plan is the BUILDING's plan ────────────────────────────────────── */

  const bounds = getFootprintBounds(DEMO_BUILDING_FOOTPRINT)

  const outsidePlan = spaces.filter(
    (space) =>
      space.xMin < bounds.xMin - OVERLAP_EPSILON_M ||
      space.xMax > bounds.xMax + OVERLAP_EPSILON_M ||
      space.zMin < bounds.zMin - OVERLAP_EPSILON_M ||
      space.zMax > bounds.zMax + OVERLAP_EPSILON_M,
  )

  results.push(
    expect(
      'every underground volume lies inside the building footprint bounds',
      outsidePlan.length === 0,
      '0 outside the plan',
      `${outsidePlan.length}`,
    ),
    expect(
      'the underground volumes tile the footprint exactly (no gap, no spill)',
      near(
        spaces.reduce((sum, space) => sum + space.areaSqM, 0),
        (bounds.xMax - bounds.xMin) * (bounds.zMax - bounds.zMin),
      ),
      `${((bounds.xMax - bounds.xMin) * (bounds.zMax - bounds.zMin)).toFixed(1)} m²`,
      `${spaces.reduce((sum, s) => sum + s.areaSqM, 0).toFixed(1)} m²`,
    ),
  )

  // The basement grid and the apartment grid are cut from one polygon by two
  // functions. If either ever stopped measuring the footprint, the two would
  // stop lining up — and this is the check that would say so.
  const groundFloor = units.filter((unit) => unit.floorLevel === 1)
  const misaligned = spaces.filter((space) => {
    const above = groundFloor.find(
      (unit) => unit.column === space.column && unit.row === space.row,
    )
    return (
      above === undefined ||
      !near(above.xMin, space.xMin) ||
      !near(above.xMax, space.xMax) ||
      !near(above.zMin, space.zMin) ||
      !near(above.zMax, space.zMax)
    )
  })

  results.push(
    expect(
      'each underground volume shares its plan with the ground-floor unit above it',
      misaligned.length === 0,
      '0 misaligned',
      `${misaligned.length}`,
    ),
  )

  /* ── Areas and volumes are derived, not asserted ────────────────────────── */

  const wrongArea = spaces.filter(
    (space) => !near(space.areaSqM, space.width * space.depth),
  )
  const wrongVolume = spaces.filter(
    (space) => !near(space.volumeCubicM, space.areaSqM * space.height),
  )

  results.push(
    expect(
      'areaSqM = width × depth for every underground volume',
      wrongArea.length === 0,
      '0 wrong',
      `${wrongArea.length}`,
    ),
    expect(
      'volumeCubicM = areaSqM × height for every underground volume',
      wrongVolume.length === 0,
      '0 wrong',
      `${wrongVolume.length}`,
    ),
  )

  /* ── No overlaps: within the tier, and across the datum ─────────────────── */

  let undergroundPairOverlaps = 0
  for (let i = 0; i < spaces.length; i++) {
    for (let j = i + 1; j < spaces.length; j++) {
      if (getVolumeIntersection(spaces[i], spaces[j]) !== null) undergroundPairOverlaps++
    }
  }

  let crossTierOverlaps = 0
  for (const space of spaces) {
    for (const unit of units) {
      if (getVolumeIntersection(space, unit) !== null) crossTierOverlaps++
    }
  }

  results.push(
    expect(
      'no two underground volumes positively overlap',
      undergroundPairOverlaps === 0,
      '0 overlapping pairs',
      `${undergroundPairOverlaps}`,
    ),
    expect(
      'no underground volume positively overlaps an above-ground unit',
      crossTierOverlaps === 0,
      '0 overlapping pairs',
      `${crossTierOverlaps}`,
    ),
  )

  /* ── THE BOUNDARY CASE: touching at y = 0 is not overlapping ────────────── */

  // The volume directly beneath the first ground-floor unit — found by plan
  // position, not by index, so the check survives a change of grid.
  const firstGroundUnit = groundFloor[0]
  const beneathIt = spaces.find(
    (space) =>
      firstGroundUnit !== undefined &&
      space.column === firstGroundUnit.column &&
      space.row === firstGroundUnit.row,
  )

  if (firstGroundUnit === undefined || beneathIt === undefined) {
    results.push(
      expect(
        'a ground-floor unit and the volume beneath it can be identified',
        false,
        'both found',
        'not found',
      ),
    )
  } else {
    const extents = getOverlapExtents(beneathIt, firstGroundUnit)

    results.push(
      expect(
        'the volume beneath a ground-floor unit meets it EXACTLY at y = 0',
        near(extents.y, 0),
        'y overlap = 0.00 m',
        `y overlap = ${extents.y.toFixed(5)} m`,
      ),
      expect(
        'they genuinely coincide horizontally (so the test above is not vacuous)',
        extents.x > OVERLAP_EPSILON_M && extents.z > OVERLAP_EPSILON_M,
        'x and z overlap positively',
        `x ${extents.x.toFixed(2)} m, z ${extents.z.toFixed(2)} m`,
      ),
      expect(
        'touching at the ground datum is NOT reported as an intersection',
        getVolumeIntersection(beneathIt, firstGroundUnit) === null,
        'null',
        getVolumeIntersection(beneathIt, firstGroundUnit) === null
          ? 'null'
          : 'AN INTERSECTION WAS REPORTED',
      ),
      expect(
        'lifting that volume 1 mm above the datum DOES become a conflict',
        // The other half of the boundary check. If this passed as "no conflict"
        // too, the test above would be proving nothing about the epsilon.
        getVolumeIntersection(
          { ...beneathIt, yMin: beneathIt.yMin + 0.001, yMax: beneathIt.yMax + 0.001 },
          firstGroundUnit,
        ) !== null,
        'an intersection',
        getVolumeIntersection(
          { ...beneathIt, yMin: beneathIt.yMin + 0.001, yMax: beneathIt.yMax + 0.001 },
          firstGroundUnit,
        ) !== null
          ? 'an intersection'
          : 'NO INTERSECTION FOUND',
      ),
    )
  }

  /* ── Identifiers ────────────────────────────────────────────────────────── */

  const identifiers = spaces.map((space) => space.prototypeUlpin)

  results.push(
    expect(
      'the underground identifiers are exactly the specified set, in order',
      identifiers.join(' ') === EXPECTED_IDENTIFIERS.join(' '),
      EXPECTED_IDENTIFIERS.join(' '),
      identifiers.join(' '),
    ),
    expect(
      'every identifier in the whole model is unique',
      findDuplicateIdentifiers([
        ...units.map((unit) => unit.prototypeUlpin),
        ...identifiers,
      ]).length === 0,
      '0 duplicates across 24 identifiers',
      `${findDuplicateIdentifiers([...units.map((u) => u.prototypeUlpin), ...identifiers]).length} duplicates`,
    ),
    expect(
      'every underground identifier opens with the same parent parcel as the flats',
      identifiers.every((id) => id.startsWith(`${formatParentParcelId(DEMO_PARCEL_IDENTITY)}-`)),
      `all start with ${formatParentParcelId(DEMO_PARCEL_IDENTITY)}-`,
      identifiers.every((id) => id.startsWith(`${formatParentParcelId(DEMO_PARCEL_IDENTITY)}-`))
        ? 'all do'
        : 'some do not',
    ),
    expect(
      'every volume carries the same parentParcelId as every unit',
      spaces.every((space) => space.parentParcelId === units[0]?.parentParcelId),
      units[0]?.parentParcelId ?? '(none)',
      spaces[0]?.parentParcelId ?? '(none)',
    ),
    expect(
      'the use pattern produced two parking bays, one store and one plant room',
      spaces.map((space) => space.propertyType).join(',') ===
        'Parking,Parking,Storage,Utility',
      'Parking,Parking,Storage,Utility',
      spaces.map((space) => space.propertyType).join(','),
    ),
    expect(
      'the per-use index restarts per use (the second parking bay is P02, the first store S01)',
      spaces.map((space) => space.spaceCode).join(' ') === 'P01 P02 S01 U01',
      'P01 P02 S01 U01',
      spaces.map((space) => space.spaceCode).join(' '),
    ),
  )

  /* ── Selection metadata matches canonical geometry ──────────────────────── */

  const sample = spaces[2] // the store — not the first, so an index bug shows

  if (sample === undefined) {
    results.push(
      expect('a sample underground volume exists', false, 'a volume', 'none'),
    )
  } else {
    const record = buildInspectorRecord(sample)
    const [cx, cy, cz] = getUndergroundUnitCentre(sample)

    const boundsMatch =
      record.xMin === sample.xMin &&
      record.xMax === sample.xMax &&
      record.yMin === sample.yMin &&
      record.yMax === sample.yMax &&
      record.zMin === sample.zMin &&
      record.zMax === sample.zMax

    results.push(
      expect(
        'the inspector record reports the volume’s own bounds, unmodified',
        boundsMatch,
        `${sample.yMin} → ${sample.yMax} m`,
        `${record.yMin} → ${record.yMax} m`,
      ),
      expect(
        'the inspector centroid is the centre the renderer positions the mesh at',
        record.centroid[0] === cx &&
          record.centroid[1] === cy &&
          record.centroid[2] === cz,
        `[${cx}, ${cy}, ${cz}]`,
        `[${record.centroid.join(', ')}]`,
      ),
      expect(
        'the inspector centroid’s elevation is NEGATIVE',
        record.centroid[1] < 0 && near(record.centroid[1], -depth / 2),
        `${(-depth / 2).toFixed(2)} m`,
        `${record.centroid[1].toFixed(2)} m`,
      ),
      expect(
        'the record is labelled as underground and names its level and space',
        record.tier === 'underground' &&
          record.tierBadge !== null &&
          record.levelLabel === 'Basement 1' &&
          record.unitLabel === 'Storage S01',
        'underground · Basement 1 · Storage S01',
        `${record.tier} · ${record.levelLabel} · ${record.unitLabel}`,
      ),
      expect(
        'an above-ground record carries no tier badge',
        buildInspectorRecord(units[0]).tierBadge === null,
        'null',
        `${buildInspectorRecord(units[0]).tierBadge}`,
      ),
    )
  }

  /* ── The exploded stack: downward, and continuous through the datum ─────── */

  results.push(
    expect(
      'the basement offset is zero when the stack is not exploded',
      getBasementExplodedOffsetM(0, 0) === 0,
      '0',
      `${getBasementExplodedOffsetM(0, 0)}`,
    ),
    expect(
      'the basement separates DOWNWARD',
      getBasementExplodedOffsetM(0, 1) < 0,
      'a negative offset',
      `${getBasementExplodedOffsetM(0, 1)}`,
    ),
    expect(
      'basement 1 sits one gap below the ground floor, continuing the ladder',
      near(
        Math.abs(getBasementExplodedOffsetM(0, 1) - getExplodedOffsetM(0, 1)),
        EXPLODED_FLOOR_GAP_M,
      ),
      `${EXPLODED_FLOOR_GAP_M} m`,
      `${Math.abs(getBasementExplodedOffsetM(0, 1) - getExplodedOffsetM(0, 1))} m`,
    ),
    expect(
      'the ground floor stays on the datum, so the datum is the hinge',
      getExplodedOffsetM(0, 1) === 0,
      '0',
      `${getExplodedOffsetM(0, 1)}`,
    ),
    expect(
      'apparent depth is the recorded depth when unexploded',
      near(getExplodedApparentDepthM(depth, levels.length, 0), depth),
      `${depth} m`,
      `${getExplodedApparentDepthM(depth, levels.length, 0)} m`,
    ),
    expect(
      'apparent depth is zero for a model with no basement',
      getExplodedApparentDepthM(0, 0, 1) === 0,
      '0',
      `${getExplodedApparentDepthM(0, 0, 1)}`,
    ),
  )

  /* ── The transform writes to nothing ────────────────────────────────────── */

  const before = JSON.stringify(spaces)
  getBasementExplodedOffsetM(0, 1)
  for (const space of spaces) getUndergroundUnitCentre(space)
  buildInspectorRecord(spaces[0])
  const after = JSON.stringify(spaces)

  results.push(
    expect(
      'reading the display offsets and the inspector record mutates nothing',
      before === after,
      'volumes unchanged',
      before === after ? 'volumes unchanged' : 'VOLUMES WERE MODIFIED',
    ),
    expect(
      'generating twice from the same inputs produces identical volumes',
      JSON.stringify(buildUndergroundUnits(config, DEMO_BUILDING_FOOTPRINT, levels)) ===
        before,
      'identical',
      JSON.stringify(buildUndergroundUnits(config, DEMO_BUILDING_FOOTPRINT, levels)) ===
        before
        ? 'identical'
        : 'DIFFERENT',
    ),
  )

  return results
}

/** Development-only runner. Logs, then throws on any failure. */
export function runBasementSelfCheck(): void {
  const results = checkBasementModel()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] basement self-check passed (${results.length} checks) — volumes at −3 → 0 m, derived from the building footprint, touching Floor 1 without overlapping it`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] basement self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] basement self-check failed (${failures.length} of ${results.length}).`,
  )
}
