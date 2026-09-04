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
  generatePrototype3DULPIN,
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
