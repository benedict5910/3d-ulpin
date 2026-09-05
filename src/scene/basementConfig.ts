/**
 * The basement's **vertical** description — the below-ground counterpart of
 * `buildingConfig.ts`, and deliberately a separate module from it.
 *
 * WHY A SEPARATE CONFIG RATHER THAN A FIELD ON `BuildingConfig`
 * It would have been one line to add `basementLevels: 1` to the building config
 * and have `buildFloorLayouts` emit negative floors. It would also have been
 * wrong, and wrong in a way that would have spread.
 *
 * A floor and a basement level are governed by different facts. Floors come from
 * a plan sanction and are counted upward from the ground; excavation depth comes
 * from a soil report, a water-table survey and a separate permission, and the
 * rights attached to what is dug are frequently held under a different chapter of
 * law from the rights attached to what is built. Merging the two would mean a
 * single loop that had to special-case its own sign, an `index` that meant
 * "upward from ground" for some values and "downward" for others, and — the real
 * cost — a `floorLevel` field on a record where the number `0` or `−1` would
 * have to be read as "basement" by every consumer that ever touched it.
 *
 * So: two configs, two layout builders, two record types, one datum between
 * them. Everything that must be shared *is* shared — the footprint polygon, the
 * parcel identity, the subdivision grid, the validation engine, the overlap
 * epsilon — and nothing that differs is forced into a common shape.
 *
 * WHAT THIS FILE DOES NOT CONTAIN
 * No horizontal dimensions. The basement's plan is the **building footprint**,
 * the same polygon the surface building is generated from, for the same reason
 * `buildingConfig.ts` has no `width`: there is one horizontal description of this
 * building and it lives in `data/demoParcel.ts`.
 *
 * No React, no Three.js. Plain data and arithmetic; runs in bare Node.
 */

import { GROUND_DATUM_Y } from '../geometry/groundDatum'

/**
 * What a below-ground volume is used for, in cadastral terms.
 *
 * A separate union from `PropertyType` in `unitLayout.ts`, and not a superset of
 * it. Above ground the prototype records dwellings; below ground it records
 * *space with a use* — a parking bay, a store, a plant room. `Parking` appears in
 * both unions because the word is the same; the two are still different
 * vocabularies, and collapsing them would mean the compiler could no longer stop
 * a `Residential` basement or a `Utility` apartment.
 */
export type UndergroundPropertyType = 'Parking' | 'Storage' | 'Utility'

/**
 * The single-letter code each use contributes to a prototype identifier.
 *
 *   Parking → P      Storage → S      Utility → U
 *
 * A `Record` over the union rather than a `switch`, so adding a fourth use is a
 * compile error here — at the one place that has to decide what letter it gets —
 * rather than a silent `undefined` inside a generated string.
 *
 * PROTOTYPE ONLY. These letters are invented for this demonstration. No
 * published Government of India scheme assigns them, and nothing in this project
 * should be presented as though one did.
 */
export const UNDERGROUND_TYPE_CODES: Readonly<
  Record<UndergroundPropertyType, string>
> = {
  Parking: 'P',
  Storage: 'S',
  Utility: 'U',
}

/** The vertical and subdivision description of the below-ground structure. */
export interface BasementConfig {
  /** How many levels are excavated, counting downward from the ground datum. */
  readonly numberOfLevels: number
  /** Floor-to-ceiling height of one basement level, in metres. Uniform. */
  readonly levelHeight: number
  /** How many volumes each level is cut into along X (east-west). */
  readonly unitColumns: number
  /** How many volumes each level is cut into along Z (north-south). */
  readonly unitRows: number
  /**
   * The use assigned to each volume, in generation order, cycled if the grid is
   * larger than the pattern.
   *
   * A pattern rather than four hard-coded strings: the grid dimensions above are
   * configuration, so the uses have to be able to follow a grid of any size. With
   * the demo's 2 × 2 grid the four entries are consumed exactly once and produce
   * two parking bays, a store and a plant room — which is what a small
   * residential basement in Bengaluru actually contains.
   */
  readonly usePattern: readonly UndergroundPropertyType[]
}

/**
 * The one basement the prototype shows: a single level, 3 m deep, cut 2 × 2.
 *
 * The 3 m matches the surface building's floor height, and that is a deliberate
 * demo choice rather than a structural claim — it makes the vertical stack read
 * as six equal 3 m slices with the datum sitting exactly between the second and
 * the third, which is the clearest possible picture of "the same building,
 * continued downward". A real basement is usually deeper than a storey.
 *
 * The 2 × 2 grid is the **same subdivision approach** the floors use. Reusing it
 * rather than inventing a below-ground layout keeps the phase's claim narrow and
 * checkable: the point being demonstrated is that a cadastre can hold volumes at
 * negative elevations, not that it can partition an arbitrary parking layout.
 */
export const DEFAULT_BASEMENT_CONFIG: BasementConfig = {
  numberOfLevels: 1,
  levelHeight: 3,
  unitColumns: 2,
  unitRows: 2,
  usePattern: ['Parking', 'Parking', 'Storage', 'Utility'],
}

/**
 * Where one basement level sits on the vertical axis, in metres.
 *
 * The mirror image of `FloorLayout`, and shaped identically on purpose so that
 * the two can be read side by side. The difference is entirely in the sign of
 * the arithmetic that fills it, which is contained in `buildBasementLevels`
 * below and appears nowhere else.
 */
export interface BasementLevelLayout {
  /**
   * 0-based position in the excavation, counting **downward**.
   *
   * `0` is the level immediately beneath the ground datum. The direction is
   * downward rather than upward because that is how basements are numbered
   * everywhere — B1 is nearer the surface than B2 — and a model whose index
   * counted the other way would produce a `level` field that disagreed with every
   * sign in every car park.
   */
  readonly index: number
  /** 1-based level shown to a human. The first basement is 1, written `B01`. */
  readonly level: number
  /** Elevation of the level's floor, in metres. **Negative.** */
  readonly baseY: number
  /** Elevation of the level's ceiling, in metres. `0` for the first basement. */
  readonly topY: number
  /** Midpoint between floor and ceiling — where a mesh's origin must go. */
  readonly centerY: number
}

/**
 * Turn a basement configuration into one layout entry per level.
 *
 * **The two lines that carry the whole phase**, and the only place they are
 * written:
 *
 *   topY  = GROUND_DATUM_Y −  index      × levelHeight
 *   baseY = GROUND_DATUM_Y − (index + 1) × levelHeight
 *
 * For one 3 m level that is `topY = 0`, `baseY = −3`: the basement's ceiling
 * **is** the ground datum, and its floor is three metres beneath it. For a second
 * level it would be `0 → −3` and `−3 → −6`, each starting exactly where the one
 * above it ends — the same no-gap, no-overlap stacking `buildFloorLayouts`
 * produces upward, reflected.
 *
 * Note what the first level's `topY` being exactly `GROUND_DATUM_Y` means: the
 * basement ceiling and the ground floor's slab occupy the same plane. They
 * **touch**, and touching is not overlapping — see `validation/aabb.ts`. That
 * shared boundary is not an accident of the arithmetic to be tolerated; it is the
 * correct cadastral relationship between a surface property and the property
 * beneath it, and the validator is required to accept it.
 */
export function buildBasementLevels(config: BasementConfig): BasementLevelLayout[] {
  const layouts: BasementLevelLayout[] = []

  for (let index = 0; index < config.numberOfLevels; index++) {
    const topY = GROUND_DATUM_Y - index * config.levelHeight
    const baseY = GROUND_DATUM_Y - (index + 1) * config.levelHeight

    layouts.push({
      index,
      level: index + 1,
      baseY,
      topY,
      centerY: (baseY + topY) / 2,
    })
  }

  return layouts
}

/**
 * Total excavated depth below the ground datum, in metres. Positive.
 *
 * Derived, never stored — the same treatment `getTotalHeight` gives the surface
 * building. Returned as a positive magnitude because "how deep" is a length, and
 * the code that wants the *elevation* of the lowest floor asks
 * `getLowestBasementY` for it instead of remembering to negate.
 */
export function getBasementDepthM(config: BasementConfig): number {
  return config.numberOfLevels * config.levelHeight
}

/** Elevation of the deepest basement floor, in metres. Negative, or the datum. */
export function getLowestBasementY(config: BasementConfig): number {
  return GROUND_DATUM_Y - getBasementDepthM(config)
}

/** How many volumes one basement level is cut into. `unitColumns × unitRows`. */
export function getSpacesPerBasementLevel(config: BasementConfig): number {
  return config.unitColumns * config.unitRows
}

/** How many below-ground volumes the whole excavation contains. */
export function getTotalUndergroundSpaces(config: BasementConfig): number {
  return config.numberOfLevels * getSpacesPerBasementLevel(config)
}

/**
 * The use of the *n*th volume generated on a level, 0-based.
 *
 * Cycles the pattern, so a 3 × 3 grid gets nine uses from a four-entry pattern
 * rather than five `undefined`s. Total by construction: the config type requires
 * a non-empty pattern in practice, and an empty one would be a configuration
 * error, so it is reported as one rather than silently defaulting.
 */
export function getUseForIndex(
  config: BasementConfig,
  indexOnLevel: number,
): UndergroundPropertyType {
  if (config.usePattern.length === 0) {
    throw new Error('[3D ULPIN] basement config has an empty use pattern.')
  }
  return config.usePattern[indexOnLevel % config.usePattern.length]
}
