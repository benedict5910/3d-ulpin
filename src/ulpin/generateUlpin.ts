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
/**
 * Prefix marking the **basement level** segment.
 *
 *   KA-BLR-0482-001928-B01-P02
 *   └──────┬─────────┘ └┬┘ └┬┘
 *    parent parcel  basement  use code + index within that use
 *
 * A different letter, not a negative floor number. Two reasons, and both are
 * about the identifier being *read* as well as generated:
 *
 *   1. `F-01` and `F01` differ by one character and mean opposite sides of the
 *      ground datum. A prefix that differs in the letter cannot be misread,
 *      cannot be mistyped into the other, and sorts into its own block.
 *   2. Every segment stays a **1-based positive count**, so the same
 *      `assertPositiveInteger` guard covers both directions and no encoder
 *      anywhere has to reason about signs.
 *
 * Because the letter differs, `B01-P01` and `F01-U01` are distinct strings by
 * construction: an above-ground unit and an underground space on the same
 * parcel can never collide, and the uniqueness assertion is a check on the
 * generator rather than the thing keeping the two apart.
 */
export const BASEMENT_PREFIX = 'B'
/** Prefix marking the unit-index segment. Shared by both directions. */
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
 * Format the use-and-index segment of an underground identifier: `P01`.
 *
 *   formatUndergroundSpaceCode('P', 1)  -> "P01"
 *   formatUndergroundSpaceCode('S', 12) -> "S12"
 *
 * The **one** place that segment is composed. The layout generator needs it on
 * its own — an `UndergroundUnit` carries `spaceCode` as a field and a panel
 * shows it without the parcel prefix — and the identifier generator needs it
 * inside a full ULPIN. One formatter used by both is what keeps the segment
 * shown in the interface identical to the segment inside the identifier; two
 * would only agree until one of them was edited.
 *
 * The use code is validated rather than trusted. A single capital letter is the
 * whole vocabulary (`P`, `S`, `U` today), so `PK` or `p` is a bug upstream, and
 * an unchecked one would produce `PK01` — a plausible-looking identifier of the
 * wrong shape, which is exactly the failure this module exists to prevent.
 *
 * @param typeCode         one capital letter naming the use
 * @param indexWithinType  1-based count of this volume **within its own use, on
 *                         its own level**
 */
export function formatUndergroundSpaceCode(
  typeCode: string,
  indexWithinType: number,
): string {
  if (!/^[A-Z]$/.test(typeCode)) {
    throw new Error(
      `[3D ULPIN] underground use code must be a single capital letter; received "${typeCode}"`,
    )
  }
  assertPositiveInteger('indexWithinType', indexWithinType)

  return `${typeCode}${padSegment(indexWithinType)}`
}

/**
 * Build the prototype 3D ULPIN for one **underground** space.
 *
 *   generateUndergroundPrototype3DULPIN(DEMO_PARCEL_IDENTITY, 1, 'P', 2)
 *     -> "KA-BLR-0482-001928-B01-P02"
 *
 * @param parcel           the land parcel the excavation sits under
 * @param basementLevel    1-based basement level; the first basement below the
 *                         ground datum is 1, not 0 and not −1
 * @param typeCode         the use's single capital letter — `P`, `S` or `U`
 * @param indexWithinType  1-based index of the space **within its own use on
 *                         that level**, so `P02` genuinely means "the second
 *                         parking bay" to anyone reading it
 *
 * The last segment counts within the use rather than across the level, which is
 * why the code is a parameter rather than something this function derives: the
 * use and the count are one fact, decided together by the layout generator, and
 * splitting them would let a caller pair `S` with parking's running total.
 *
 * Deliberately a sibling of `generatePrototype3DULPIN` rather than a flag on
 * it. The two produce different strings from the same shaped inputs, and a
 * boolean parameter would let a caller generate an above-ground identifier for
 * an underground volume by getting one argument wrong — the one mistake this
 * module exists to make impossible. Two functions, two call sites, no flag.
 *
 * Composed from structured fields and nothing else, so it is deterministic in
 * exactly the way the above-ground encoder is: same parcel, level and index,
 * same string, forever.
 */
export function generateUndergroundPrototype3DULPIN(
  parcel: ParcelIdentity,
  basementLevel: number,
  typeCode: string,
  indexWithinType: number,
): string {
  assertPositiveInteger('basementLevel', basementLevel)

  return [
    formatParentParcelId(parcel),
    `${BASEMENT_PREFIX}${padSegment(basementLevel)}`,
    // The same formatter the layout generator stores as `spaceCode`, so the
    // segment inside the identifier and the segment on the panel are one string
    // produced once. It validates the use code and the index.
    formatUndergroundSpaceCode(typeCode, indexWithinType),
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
