/**
 * The prototype 3D ULPIN generator.
 *
 * PROTOTYPE NOTICE: the format produced here is an **encoding scheme invented
 * for this SIH demonstration**, not the official Government of India ULPIN
 * format. See `parcelIdentity.ts`.
 *
 *   KA-BLR-0482-001928-F03-U02
 *   └──────┬─────────┘ └┬┘ └┬┘
 *    parent parcel     floor  unit index on that floor
 *
 * The module is pure: no React, no Three.js, no I/O, no clock, no randomness.
 * Given the same parcel, floor and index it returns the same string forever —
 * which is the whole point of an identifier. Purity also means the functions
 * can be executed directly by the self-check in `ulpinSelfCheck.ts` without a
 * browser, a renderer or a test runner.
 */

import {
  formatParentParcelId,
  SEGMENT_SEPARATOR,
  type ParcelIdentity,
} from './parcelIdentity'

/** Prefix marking the floor segment. */
export const FLOOR_PREFIX = 'F'
/** Prefix marking the unit-index segment. */
export const UNIT_PREFIX = 'U'
/** How many digits the floor and unit segments are padded to. */
export const SEGMENT_DIGITS = 2

/**
 * Zero-pad a positive integer to the fixed segment width.
 *
 *   1 -> "01"      3 -> "03"      12 -> "12"      120 -> "120"
 *
 * Fixed width is what makes identifiers line up in a column, sort in the same
 * order as the floors they name (`F02` before `F10`, where `F2` would sort
 * after it), and slice at known offsets. Numbers wider than the pad are left
 * intact rather than truncated: a 120-storey tower should produce an ugly
 * identifier, never a wrong one.
 */
function padSegment(value: number): string {
  return String(value).padStart(SEGMENT_DIGITS, '0')
}

/**
 * Reject anything that is not a 1-based counting number.
 *
 * Floors and unit indices are counted, not measured: `0`, `-1`, `2.5` and `NaN`
 * are all bugs upstream, and each would silently produce a plausible-looking
 * identifier (`F00`, `F-1`, `F2.5`) if allowed through. Failing here means the
 * error is reported where it was introduced.
 */
function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `[3D ULPIN] ${label} must be a positive integer (1-based); received ${value}`,
    )
  }
}

/**
 * Build the prototype 3D ULPIN for one vertical property unit.
 *
 *   generatePrototype3DULPIN(DEMO_PARCEL_IDENTITY, 3, 2)
 *     -> "KA-BLR-0482-001928-F03-U02"
 *
 * @param parcel     the land parcel the building stands on
 * @param floorLevel 1-based floor; the ground floor is 1
 * @param unitIndex  1-based index of the unit **within that floor** — not the
 *                   door number. Apartment 302 is floor 3, unit index 2.
 *
 * The identifier is composed from structured fields, never assembled by hand
 * and never recovered by parsing another string. That is what makes it
 * deterministic: two units with the same parcel, floor and index cannot end up
 * with different text, and two different units cannot collide.
 */
export function generatePrototype3DULPIN(
  parcel: ParcelIdentity,
  floorLevel: number,
  unitIndex: number,
): string {
  assertPositiveInteger('floorLevel', floorLevel)
  assertPositiveInteger('unitIndex', unitIndex)

  return [
    formatParentParcelId(parcel),
    `${FLOOR_PREFIX}${padSegment(floorLevel)}`,
    `${UNIT_PREFIX}${padSegment(unitIndex)}`,
  ].join(SEGMENT_SEPARATOR)
}

/**
 * Every identifier that appears more than once in a list, in first-seen order.
 *
 * A pure function returning data, not a boolean and not a throw, so the caller
 * decides what a duplicate means: the data layer treats it as fatal, a future
 * import screen might want to list the offenders next to their rows.
 */
export function findDuplicateIdentifiers(identifiers: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const identifier of identifiers) {
    if (seen.has(identifier)) duplicates.add(identifier)
    else seen.add(identifier)
  }

  return [...duplicates]
}

/**
 * Fail loudly if a generated set of identifiers is not unique.
 *
 * Uniqueness is the one property an identifier cannot be allowed to lose. A
 * duplicate here would mean two distinct 3D volumes claiming to be the same
 * property — precisely the ownership ambiguity the project exists to remove —
 * and it would be invisible in the UI, because each panel would look perfectly
 * correct on its own. So the failure is a thrown error at generation time
 * rather than a warning, a silent skip, or a bug someone notices in a demo.
 *
 * This is a *uniqueness* check, deliberately nothing more. Topology validation
 * — overlapping volumes, gaps, floors that do not stack — is a later phase.
 */
export function assertUniqueIdentifiers(identifiers: string[]): void {
  const duplicates = findDuplicateIdentifiers(identifiers)

  if (duplicates.length > 0) {
    throw new Error(
      `[3D ULPIN] duplicate prototype identifiers generated: ${duplicates.join(', ')}. ` +
        'Every vertical property unit must have a unique identifier.',
    )
  }
}
