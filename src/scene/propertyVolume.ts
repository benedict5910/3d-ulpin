/**
 * The two kinds of property volume, as one type — and the few questions that are
 * only answerable when both halves are in scope.
 *
 * WHY A UNION RATHER THAN A COMMON BASE INTERFACE
 * An `ApartmentUnit` and an `UndergroundUnit` share their *geometry* completely
 * and their *identity* not at all. Both are six bounds in metres tied to one
 * parcel; one is identified by a floor and a door number, the other by an
 * excavation level and a use. A shared base class would have to either hoist the
 * differing fields (giving apartments a `propertyType` of `'Parking' | ...` and
 * basements a `floorLevel`, both meaningless) or push everything into optionals,
 * at which point every consumer is writing `unit.floorLevel ?? ...` and the
 * compiler has stopped helping.
 *
 * A discriminated union keeps both halves exact. Narrow on `tier` and each branch
 * has precisely the fields that branch really has; forget to narrow and the code
 * does not compile. Where a consumer genuinely needs only the shared part — the
 * validator intersecting boxes, the scene painting a conflict red — it takes the
 * **structural minimum** it needs rather than the union, which is why
 * `findOwnershipConflicts` can be handed all twenty-four volumes at once without
 * knowing that two kinds exist.
 *
 * WHAT THIS MODULE IS FOR
 * Exactly the questions that neither generator can answer alone:
 *
 *   • resolving one selection id across both tiers
 *   • asserting that all twenty-four identifiers are distinct
 *   • counting the model — above ground, below ground, total
 *
 * Each of those was, before Phase 11, either trivially true (there was one tier)
 * or a figure typed into a panel. Each is now derived.
 *
 * No React, no Three.js.
 */

import {
  findUndergroundUnitById,
  getUndergroundUnitCentre,
  type UndergroundUnit,
} from './basementLayout'
import { findUnitById, getUnitCenter, type ApartmentUnit } from './unitLayout'
import { findDuplicateIdentifiers } from '../ulpin/generateUlpin'

/**
 * Any property volume in the model, above or below the ground datum.
 *
 * Discriminated on `tier`. Narrowing is the intended usage:
 *
 * ```ts
 * if (volume.tier === 'underground') volume.basementLevel  // ✔
 * else                               volume.floorLevel     // ✔
 * ```
 */
export type PropertyVolume = ApartmentUnit | UndergroundUnit

/**
 * How many volumes the model holds, split by tier.
 *
 * The object the summary panel and the pipeline both read. Every field is a
 * length of an array the scene is actually rendering — there is no `24` anywhere
 * in this project, and no `20` either. Change the config to eight floors and two
 * basement levels and the panel says 32 + 8 = 40 with no edit.
 */
export interface PropertyVolumeCounts {
  /** Property units at or above the ground datum. */
  readonly aboveGround: number
  /** Property volumes below the ground datum. */
  readonly underground: number
  /** The whole record. `aboveGround + underground`, derived here and nowhere else. */
  readonly total: number
}

/** Count the model. */
export function countPropertyVolumes(
  units: readonly ApartmentUnit[],
  undergroundUnits: readonly UndergroundUnit[],
): PropertyVolumeCounts {
  return {
    aboveGround: units.length,
    underground: undergroundUnits.length,
    total: units.length + undergroundUnits.length,
  }
}

/**
 * Every volume in the model, in reading order: the surface building, then what
 * is beneath it.
 *
 * The array the validation engine is handed. Its order is presentational — the
 * engine's results are order-independent — but it is a fixed order rather than an
 * arbitrary one, so a details panel listing "pairs tested" reads the same way
 * twice.
 */
export function collectPropertyVolumes(
  units: readonly ApartmentUnit[],
  undergroundUnits: readonly UndergroundUnit[],
): PropertyVolume[] {
  return [...units, ...undergroundUnits]
}

/**
 * Resolve one selection id against both tiers.
 *
 * **This is what lets selection stay a bare string** now that there are two kinds
 * of volume. `App` remembers `"space-B01-P01"` exactly as it remembered
 * `"unit-302"`; this function turns either answer back into the one authoritative
 * record the scene is drawing.
 *
 * Above ground is tried first, and the two id namespaces are disjoint by
 * construction (`unit-…` versus `space-…`), so the order is a performance detail
 * rather than a precedence rule. `null` for an id that resolves to neither, which
 * is what makes a stale selection harmless.
 */
export function findPropertyVolume(
  units: readonly ApartmentUnit[],
  undergroundUnits: readonly UndergroundUnit[],
  volumeId: string | null,
): PropertyVolume | null {
  if (volumeId === null) return null

  const unit = findUnitById(units, volumeId)
  if (unit !== null) return unit

  return findUndergroundUnitById(undergroundUnits, volumeId)
}

/**
 * The centre of any property volume, in metres.
 *
 * Delegates to whichever tier's own accessor applies rather than reimplementing
 * the average, so there remains exactly one definition of where a box's centre is
 * on each side of the datum — and this function cannot drift from either.
 */
export function getPropertyVolumeCentre(
  volume: PropertyVolume,
): [number, number, number] {
  return volume.tier === 'underground'
    ? getUndergroundUnitCentre(volume)
    : getUnitCenter(volume)
}

/**
 * Fail loudly if the model contains two volumes with the same identifier.
 *
 * WHY THIS MOVED UP A LEVEL IN PHASE 11
 * `buildApartmentUnits` asserts uniqueness over the twenty units it produces, and
 * that was a complete guarantee while twenty units were the whole model. It is
 * not any more: two generators now emit identifiers into one register, and each
 * can be internally consistent while the pair collides. The property that
 * actually matters — **no two volumes anywhere claim the same name** — can only
 * be asserted where both halves are in scope, which is here.
 *
 * A collision is fatal rather than a warning for the reason it always was: two
 * distinct volumes claiming one identifier is precisely the ownership ambiguity
 * this project exists to remove, and it is invisible in the interface because
 * each panel looks perfectly correct on its own.
 *
 * The validation engine checks the same property again, over whatever array it is
 * handed, and *reports* rather than throwing. The two are not redundant: this one
 * guards generation, that one guards a record that may have been modified by a
 * simulation.
 */
export function assertUniquePropertyIdentifiers(
  volumes: readonly PropertyVolume[],
): void {
  const duplicates = findDuplicateIdentifiers(
    volumes.map((volume) => volume.prototypeUlpin),
  )

  if (duplicates.length > 0) {
    throw new Error(
      `[3D ULPIN] duplicate prototype identifiers across the model: ${duplicates.join(', ')}. ` +
        'Every property volume, above or below ground, must have a unique identifier.',
    )
  }
}
