/**
 * A pure self-check for the prototype identifier scheme.
 *
 * The project has no test runner yet, and adding one is not Phase 6's job. So
 * the checks live as an ordinary pure function that returns results, plus a
 * thin dev-only runner that prints them. `checkPrototypeUlpin()` imports
 * nothing but the generator, takes no arguments and touches no globals, so the
 * day Vitest arrives its body becomes the body of a test file unchanged.
 *
 * Two kinds of check:
 *
 *   1. **Known-answer cases** — the three examples fixed by the Phase 6 brief.
 *      They pin the format itself: padding, prefixes, separator, field order.
 *   2. **Uniqueness** — twenty generated identifiers, no repeats.
 */

import { DEMO_PARCEL_IDENTITY } from './parcelIdentity'
import {
  findDuplicateIdentifiers,
  formatUndergroundSpaceCode,
  generatePrototype3DULPIN,
  generateUndergroundPrototype3DULPIN,
} from './generateUlpin'

/** One assertion's outcome. */
export interface CheckResult {
  readonly name: string
  readonly passed: boolean
  readonly expected: string
  readonly actual: string
}

/**
 * The known-answer cases from the Phase 6 specification.
 *
 * Written as literal strings, on purpose. A case computed the same way as the
 * code under test proves nothing; these are the answers a human decided the
 * format must produce, so a change to the padding, the prefixes or the field
 * order breaks them.
 */
const KNOWN_ANSWERS: ReadonlyArray<{
  readonly floorLevel: number
  readonly unitIndex: number
  readonly expected: string
}> = [
  { floorLevel: 1, unitIndex: 1, expected: 'KA-BLR-0482-001928-F01-U01' },
  { floorLevel: 3, unitIndex: 2, expected: 'KA-BLR-0482-001928-F03-U02' },
  { floorLevel: 5, unitIndex: 4, expected: 'KA-BLR-0482-001928-F05-U04' },
]

/**
 * The known-answer cases for the **below-ground** extension (Phase 11).
 *
 * Literal strings again, and for a sharper version of the same reason: these
 * four are the exact identifiers the phase's brief specifies, so a change to the
 * `B` prefix, the use letters, the padding or the field order breaks them here
 * rather than being noticed in a demo.
 *
 * The `B02` case is included although the demo has one basement level. It is the
 * check that the level segment is really the level and not a constant — the kind
 * of thing that cannot go wrong while there is only ever one of something.
 */
const KNOWN_UNDERGROUND_ANSWERS: ReadonlyArray<{
  readonly basementLevel: number
  readonly typeCode: string
  readonly indexWithinType: number
  readonly expected: string
}> = [
  { basementLevel: 1, typeCode: 'P', indexWithinType: 1, expected: 'KA-BLR-0482-001928-B01-P01' },
  { basementLevel: 1, typeCode: 'P', indexWithinType: 2, expected: 'KA-BLR-0482-001928-B01-P02' },
  { basementLevel: 1, typeCode: 'S', indexWithinType: 1, expected: 'KA-BLR-0482-001928-B01-S01' },
  { basementLevel: 1, typeCode: 'U', indexWithinType: 1, expected: 'KA-BLR-0482-001928-B01-U01' },
  { basementLevel: 2, typeCode: 'P', indexWithinType: 1, expected: 'KA-BLR-0482-001928-B02-P01' },
]

/**
 * Run every check and return the results. Pure: no console, no throw.
 *
 * `identifiers` defaults to the twenty the demo building produces, but can be
 * passed in so the caller can check the identifiers *actually attached to the
 * generated units* rather than a freshly generated look-alike set.
 */
export function checkPrototypeUlpin(identifiers?: string[]): CheckResult[] {
  const results: CheckResult[] = KNOWN_ANSWERS.map(
    ({ floorLevel, unitIndex, expected }) => {
      const actual = generatePrototype3DULPIN(
        DEMO_PARCEL_IDENTITY,
        floorLevel,
        unitIndex,
      )
      return {
        name: `floor ${floorLevel}, unit index ${unitIndex}`,
        passed: actual === expected,
        expected,
        actual,
      }
    },
  )

  for (const { basementLevel, typeCode, indexWithinType, expected } of
    KNOWN_UNDERGROUND_ANSWERS) {
    const actual = generateUndergroundPrototype3DULPIN(
      DEMO_PARCEL_IDENTITY,
      basementLevel,
      typeCode,
      indexWithinType,
    )
    results.push({
      name: `basement ${basementLevel}, ${typeCode}${indexWithinType}`,
      passed: actual === expected,
      expected,
      actual,
    })
  }

  // The two tiers share a parent parcel and cannot collide: `F` and `B` occupy
  // the same position and differ in the first character, which is the whole
  // reason the basement is not encoded as `F00`.
  results.push({
    name: 'an above-ground and a below-ground identifier never collide',
    passed:
      generatePrototype3DULPIN(DEMO_PARCEL_IDENTITY, 1, 1) !==
      generateUndergroundPrototype3DULPIN(DEMO_PARCEL_IDENTITY, 1, 'P', 1),
    expected: 'different strings',
    actual: `${generatePrototype3DULPIN(DEMO_PARCEL_IDENTITY, 1, 1)} vs ${generateUndergroundPrototype3DULPIN(DEMO_PARCEL_IDENTITY, 1, 'P', 1)}`,
  })

  // A malformed use code must fail where it was introduced, not produce a
  // plausible-looking identifier of the wrong shape.
  let rejectedBadCode = false
  try {
    formatUndergroundSpaceCode('PK', 1)
  } catch {
    rejectedBadCode = true
  }
  results.push({
    name: 'a multi-letter use code is rejected rather than encoded',
    passed: rejectedBadCode,
    expected: 'throws',
    actual: rejectedBadCode ? 'throws' : 'produced an identifier',
  })

  let rejectedZeroLevel = false
  try {
    generateUndergroundPrototype3DULPIN(DEMO_PARCEL_IDENTITY, 0, 'P', 1)
  } catch {
    rejectedZeroLevel = true
  }
  results.push({
    name: 'basement level 0 is rejected (levels are 1-based, like floors)',
    passed: rejectedZeroLevel,
    expected: 'throws',
    actual: rejectedZeroLevel ? 'throws' : 'produced an identifier',
  })

  const subjects =
    identifiers ??
    Array.from({ length: 5 }, (_, floorIndex) =>
      Array.from({ length: 4 }, (_, unitIndexBase) =>
        generatePrototype3DULPIN(
          DEMO_PARCEL_IDENTITY,
          floorIndex + 1,
          unitIndexBase + 1,
        ),
      ),
    ).flat()

  const duplicates = findDuplicateIdentifiers(subjects)
  results.push({
    name: `uniqueness across ${subjects.length} identifiers`,
    passed: duplicates.length === 0,
    expected: 'no duplicates',
    actual:
      duplicates.length === 0 ? 'no duplicates' : `duplicates: ${duplicates.join(', ')}`,
  })

  return results
}

/**
 * Development-only runner: execute the checks and report them in the console.
 *
 * A failure is logged with `console.error` *and* rethrown, so it cannot be
 * scrolled past. Guarded by `import.meta.env.DEV` at the call site so it is
 * dropped from the production bundle entirely.
 */
export function runPrototypeUlpinSelfCheck(identifiers?: string[]): void {
  const results = checkPrototypeUlpin(identifiers)
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] self-check passed (${results.length} checks) — prototype encoding, demonstration only`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] prototype identifier self-check failed (${failures.length} of ${results.length}).`,
  )
}
