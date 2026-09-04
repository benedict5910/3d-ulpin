/**
 * The parcel a building stands on, as structured data.
 *
 * PROTOTYPE NOTICE — read this before reusing anything here.
 * `ParcelIdentity` and the identifier built from it are a **prototype encoding
 * scheme invented for this SIH demonstration**. They are *not* the official
 * Government of India ULPIN format, they are not derived from any published
 * specification, and no field here should be presented as a real cadastral
 * code. The point of the exercise is the *shape* of the idea: that a vertical
 * property can be named by composing a land-parcel identity with a position
 * inside the building standing on it.
 *
 * This module holds no geometry and no React. A parcel identity is four short
 * strings — the administrative address of a piece of land — and the rules for
 * turning them into text. Keeping it separate from `buildingConfig.ts` is
 * deliberate: the building's *dimensions* and the parcel's *identity* are two
 * unrelated facts that happen to describe the same site. One can change without
 * the other, and a later phase that loads real parcels from a GIS layer will
 * replace this file alone.
 */

/**
 * The administrative identity of a single land parcel.
 *
 * Four separate fields rather than one pre-joined string, because each segment
 * means something on its own: code lists differ per level, a map layer will
 * later want to filter by zone, and a validator has to be able to check the
 * parcel number's width without re-splitting text it just joined. Text is
 * assembled from these fields; the fields are never parsed back out of text.
 *
 * Every field is a `string`, not a `number`, and that matters: `0482` and
 * `001928` carry meaningful leading zeros. Stored as numbers they would become
 * 482 and 1928, and the zeros would have to be guessed back at display time.
 */
export interface ParcelIdentity {
  /** State code — two letters, e.g. `KA` for Karnataka. */
  readonly stateCode: string
  /** City or district demo code — three letters, e.g. `BLR` for Bengaluru. */
  readonly cityCode: string
  /** Spatial / zone code within the city — four digits, e.g. `0482`. */
  readonly zoneCode: string
  /** Parent land-parcel number within the zone — six digits, e.g. `001928`. */
  readonly parcelNumber: string
}

/**
 * The one demo parcel the prototype building stands on.
 *
 * Fixed for the demonstration. `KA-BLR-0482-001928` — Karnataka, Bengaluru,
 * zone 0482, parcel 001928. Invented values; they name no real land.
 */
export const DEMO_PARCEL_IDENTITY: ParcelIdentity = {
  stateCode: 'KA',
  cityCode: 'BLR',
  zoneCode: '0482',
  parcelNumber: '001928',
}

/** The separator between every segment of a prototype identifier. */
export const SEGMENT_SEPARATOR = '-'

/**
 * The parent parcel identifier: the ground-level part, shared by every unit.
 *
 *   KA-BLR-0482-001928
 *
 * Computed from the identity rather than stored beside it, so the joined string
 * and the fields it came from can never disagree. Every vertical identifier in
 * the building begins with exactly this text, which is what makes "these twenty
 * properties sit on one parcel" visible in the identifier itself.
 */
export function formatParentParcelId(parcel: ParcelIdentity): string {
  return [
    parcel.stateCode,
    parcel.cityCode,
    parcel.zoneCode,
    parcel.parcelNumber,
  ].join(SEGMENT_SEPARATOR)
}

/**
 * The wording shown wherever a prototype identifier is displayed.
 *
 * A constant, not a string typed into a component, so the disclaimer cannot
 * appear in one place and be forgotten in another.
 */
export const PROTOTYPE_ENCODING_NOTE = 'Prototype encoding – demonstration only'
