/**
 * The ground datum: the one elevation the whole model is measured from.
 *
 * WHY THIS IS ITS OWN MODULE, HOLDING A SINGLE ZERO
 * Until Phase 11 the number `0` appeared in this project as an accident of the
 * coordinate system: floors were laid out from `floorIndex * floorHeight`, so
 * the ground floor started at zero because counting starts at zero. Nothing
 * *said* that zero meant the surface of the earth, and nothing needed to —
 * every property in the model was above it.
 *
 * A basement changes that. The moment a property occupies −3 m to 0 m, the zero
 * in the middle stops being an artefact of the loop and becomes **a cadastral
 * boundary**: the plane where surface rights end and subsurface rights begin,
 * the plane the two tiers of the register meet at, and the plane a validator has
 * to be able to say "these touch here, and touching is legal" about.
 *
 * A fact that load-bearing should be written down once, with a name, in a place
 * that has no other job. That is this file.
 *
 *     y > 0     above ground   apartments, the surface building
 *     y = 0     GROUND DATUM   the surveyed surface; the shared boundary
 *     y < 0     below ground   basement parking, storage, services
 *
 * WHY ZERO AND NOT A SURVEYED REDUCED LEVEL
 * A real cadastre ties elevations to a national vertical datum — in India, mean
 * sea level via the Great Trigonometrical Survey — so a plot in Bengaluru sits
 * at roughly +900 m and its basement at +897 m. This prototype works in a
 * **local** frame whose origin is the parcel's own reference point, exactly as
 * `data/demoParcel.ts` works in metres east and north of one latitude and
 * longitude rather than in absolute coordinates. Local zero *is* the surface
 * here. Adopting a real datum is a change of origin, not a change of model: it
 * would move this constant and nothing else, which is the point of naming it.
 *
 * No React, no Three.js, no imports.
 */

/**
 * The elevation of the surveyed ground surface, in metres.
 *
 * Every vertical bound in the model is relative to this. It is deliberately a
 * named constant rather than a literal `0` at the twenty places that compare
 * against it: the comparisons say *what they mean* — "is this volume below the
 * ground datum?" — instead of saying "is this number negative?", and the day the
 * project adopts a surveyed reduced level there is exactly one line to change.
 */
export const GROUND_DATUM_Y = 0

/**
 * Which side of the datum a volume sits on.
 *
 * A closed union rather than a boolean, because "not above ground" and "below
 * ground" are not the same statement — a volume could straddle the datum, which
 * is a fault the validator has to be able to name rather than a third truth
 * value it has to invent.
 */
export type VerticalTier = 'above-ground' | 'underground'

/** How each tier is written wherever the interface names one. Stated once. */
export const TIER_LABELS: Readonly<Record<VerticalTier, string>> = {
  'above-ground': 'Above ground',
  underground: 'Underground',
}

/** The minimum a volume must expose to be placed relative to the datum. */
export interface VerticalExtent {
  readonly yMin: number
  readonly yMax: number
}

/**
 * How much slack is allowed when comparing an elevation with the datum.
 *
 * The same hundredth of a millimetre `validation/aabb.ts` uses, and for the same
 * reason: a floor slab authored as exactly `0` and a basement ceiling authored
 * as exactly `0` agree to the bit today, and will differ in the last place the
 * day both come out of a survey file. Declared here rather than imported so this
 * module stays dependency-free; the two constants are checked against each other
 * in `scene/basementSelfCheck.ts`.
 */
export const DATUM_EPSILON_M = 1e-5

/** Whether a volume lies entirely at or above the ground datum. */
export function isAboveGround(extent: VerticalExtent): boolean {
  return extent.yMin >= GROUND_DATUM_Y - DATUM_EPSILON_M
}

/** Whether a volume lies entirely at or below the ground datum. */
export function isUnderground(extent: VerticalExtent): boolean {
  return extent.yMax <= GROUND_DATUM_Y + DATUM_EPSILON_M
}

/**
 * Whether a volume crosses the datum — part above the surface, part below it.
 *
 * Not a tier, and not something the prototype ever generates. It exists as a
 * question the validator can ask, because a volume that straddles the surface is
 * neither a surface property nor a subsurface one, and a register that quietly
 * filed it as either would be recording something it had not checked.
 */
export function straddlesGroundDatum(extent: VerticalExtent): boolean {
  return (
    extent.yMin < GROUND_DATUM_Y - DATUM_EPSILON_M &&
    extent.yMax > GROUND_DATUM_Y + DATUM_EPSILON_M
  )
}

/**
 * Whether a volume's face **meets** the datum — touching it, from either side.
 *
 * This is the predicate behind the phase's central claim. A basement whose
 * ceiling is at 0 and a ground-floor apartment whose slab is at 0 share that
 * plane. They are *adjacent*, exactly as two apartments sharing a wall are
 * adjacent, and adjacency is not overlap. See `validation/aabb.ts` for the
 * strict-inequality test that makes contact legal and interpenetration a
 * conflict; this function is what lets the interface **say** that a contact
 * exists rather than merely not complaining about it.
 */
export function touchesGroundDatum(extent: VerticalExtent): boolean {
  return (
    Math.abs(extent.yMin - GROUND_DATUM_Y) <= DATUM_EPSILON_M ||
    Math.abs(extent.yMax - GROUND_DATUM_Y) <= DATUM_EPSILON_M
  )
}
