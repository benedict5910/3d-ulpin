/**
 * The vertical description of what lies **below** the ground datum.
 *
 * UNIT CONVENTION: **1 Three.js unit = 1 metre**, the same convention every
 * other module uses. Elevations here are negative because they are below
 * `GROUND_DATUM_Y`, not because a second sign convention has been introduced.
 *
 * WHY A SEPARATE MODULE FROM `scene/buildingConfig.ts`
 * The above-ground config answers "how is the sanctioned volume above the
 * outline sliced". This one answers "how deep does the excavation go and how is
 * it partitioned". They are two sanctions, granted separately, revised
 * separately, and a real project can change one without touching the other —
 * so they are two configs. Merging them would also have forced
 * `buildFloorLayouts` to emit negative levels, which every consumer of
 * `floorLevel` (the ULPIN encoder, floor isolation, the exploded view, the
 * conflict simulation) assumes is a 1-based positive count.
 *
 * Like its above-ground counterpart this module contains no React and no
 * Three.js: plain data and plain arithmetic, runnable under bare Node.
 */

/**
 * **The ground datum: y = 0.**
 *
 * The one elevation the whole model is stated against, named once here so that
 * "above ground", "at ground" and "below ground" are comparisons against a
 * constant rather than against a literal zero scattered through a dozen files.
 *
 * The rule it fixes, and the rule the validator enforces:
 *
 *   above ground   y > 0
 *   ground datum   y = 0
 *   underground    y < 0
 *
 * A property **touching** the datum — a basement whose ceiling is exactly y = 0
 * and a ground floor whose slab is exactly y = 0 — is valid: they share a
 * surface, they do not share a volume. Positive interpenetration is not. That
 * distinction is the whole reason the overlap test is a strict, epsilon-guarded
 * volume test rather than an interval comparison; see `validation/aabb.ts`.
 */
export const GROUND_DATUM_Y = 0

/**
 * The excavation description of a building.
 *
 * Deliberately **no horizontal dimensions**, exactly like `BuildingConfig`.
 * Anything below ground that needs a width, a depth or an area asks the
 * **excavation's own footprint** — `underground/basementFootprint.ts` — a
 * separately authored ring, wider than the tower's, parented to the same
 * cadastral parcel. Keeping the plan out of this file is what stops a config
 * value and a survey ring becoming two descriptions of one boundary.
 *
 * Note what is *not* here any more: `spaceColumns` and `spaceRows`. A basement
 * level is no longer partitioned — see `DEFAULT_BASEMENT_CONFIG` below.
 */
export interface BasementConfig {
  /** How many basement levels are excavated, counting downward from the datum. */
  readonly numberOfLevels: number
  /** Floor-to-ceiling depth of each basement level, in metres. Uniform. */
  readonly levelDepth: number
}

/**
 * The excavation the prototype shows: **two 3 m parking decks, B1 and B2.**
 *
 * WHY THE GRID FIELDS ARE GONE RATHER THAN SET TO 1 × 1
 * This config used to carry `spaceColumns: 2` and `spaceRows: 2`, and the one
 * 3 m level below the datum was cut into four small volumes typed Parking,
 * Parking, Storage and Utility. That was the surface building's subdivision
 * reflected downward, and it was wrong in two ways at once.
 *
 * Wrong **cadastrally**: a parking deck is not four adjacent properties. It is
 * one continuous floor plate held as a single subsurface property, with bays
 * allotted inside it by an instrument a land register does not record. Cutting
 * it into quarters invented four ownership boundaries the real record does not
 * have.
 *
 * Wrong **as a demonstration**: four boxes of 9 × 7 m, tucked exactly under the
 * tower and occupying in plan precisely what the tower already occupies, is the
 * picture a 2D cadastre can already draw by projection. Two broad decks that
 * oversail the building and stack below it is the picture it cannot.
 *
 * So the subdivision is **removed**, not configured smaller. Each level yields
 * exactly one cadastral space; there is nothing left to configure about the
 * horizontal partition of a level, so there is no field for it and no caller
 * can set one back to 2.
 */
export const DEFAULT_BASEMENT_CONFIG: BasementConfig = {
  // B1 and B2, counted downward from the datum.
  numberOfLevels: 2,
  // 3 m each, so the excavation reaches exactly −6.0 m.
  levelDepth: 3,
}

/**
 * How many cadastral spaces one basement level holds. **Always one.**
 *
 * A named constant rather than the literal `1` scattered through the layout
 * generator and the panels, because it is the one place the model states "a
 * level is a single property" — and it is where a future phase that genuinely
 * subdivided a deck would have to come to change it.
 */
export const SPACES_PER_BASEMENT_LEVEL = 1

/**
 * Where one basement level sits on the vertical axis, in metres.
 *
 * The mirror of `FloorLayout`, and deliberately the same shape: `baseY` is the
 * lower bound and `topY` the upper one, so `baseY < topY` holds below ground
 * exactly as it does above and no consumer needs a sign special-case. For the
 * demo's two levels that is `baseY = -3, topY = 0` (B1) and
 * `baseY = -6, topY = -3` (B2).
 */
export interface BasementLevelLayout {
  /** 0-based position in the downward stack. Level B1 is index 0. */
  readonly index: number
  /** 1-based level number shown to a human. The first basement is 1. */
  readonly level: number
  /** Display name for the level, e.g. `Basement 1`. */
  readonly label: string
  /** Elevation of the level's floor slab, in metres. Negative. */
  readonly baseY: number
  /** Elevation of the level's ceiling, in metres. `0` for the topmost level. */
  readonly topY: number
  /** Midpoint between base and top — where a mesh's origin must go. */
  readonly centerY: number
}

/** The display name for a basement level. One place, so the panels agree. */
export function formatBasementLabel(level: number): string {
  return `Basement ${level}`
}

/**
 * Turn a basement configuration into one layout entry per level.
 *
 * The two lines that matter, and the only place they are written:
 *
 *   topY  = GROUND_DATUM_Y - levelIndex       * levelDepth
 *   baseY = GROUND_DATUM_Y - (levelIndex + 1) * levelDepth
 *
 * With the demo's two 3 m levels that produces exactly
 *
 *   B1   −3.0 m → 0.0 m
 *   B2   −6.0 m → −3.0 m
 *
 * The topmost basement ceiling *is* the ground datum, so it touches the ground
 * floor's slab and does not intersect it; B2's ceiling is exactly B1's floor,
 * so the two decks touch at −3 and do not intersect either. Each level starts
 * exactly where the one above it ends, with no gaps and no overlap — the
 * downward statement of the invariant `buildFloorLayouts` states upward, and
 * the pair of shared planes the validator is required to accept.
 */
export function buildBasementLevels(
  config: BasementConfig,
): BasementLevelLayout[] {
  const layouts: BasementLevelLayout[] = []

  for (let levelIndex = 0; levelIndex < config.numberOfLevels; levelIndex++) {
    const topY = GROUND_DATUM_Y - levelIndex * config.levelDepth
    const baseY = topY - config.levelDepth

    layouts.push({
      index: levelIndex,
      level: levelIndex + 1,
      label: formatBasementLabel(levelIndex + 1),
      baseY,
      topY,
      centerY: (baseY + topY) / 2,
    })
  }

  return layouts
}

/**
 * Total excavated depth, in metres, as a positive magnitude.
 *
 * Derived, never stored — the same reasoning as `getTotalHeight`. Positive
 * because it is a *depth*, a quantity a person states as "six metres down";
 * the elevation it corresponds to is `-getTotalDepthM(config)`. Two 3 m levels
 * give 6.0.
 */
export function getTotalDepthM(config: BasementConfig): number {
  return config.numberOfLevels * config.levelDepth
}

/** The lowest elevation the model reaches, in metres. Negative. */
export function getLowestElevationM(config: BasementConfig): number {
  return GROUND_DATUM_Y - getTotalDepthM(config)
}

/**
 * How many underground spaces sit on one level. **One: the deck itself.**
 *
 * Takes the config it does not read, deliberately: every other derived figure
 * in this module is a function of the configuration, and a caller should not
 * have to remember that this one happens not to be. The day a level is
 * genuinely partitioned, the signature does not change.
 */
export function getSpacesPerLevel(_config: BasementConfig): number {
  return SPACES_PER_BASEMENT_LEVEL
}

/** How many underground spaces the whole excavation contains. `2 × 1 = 2`. */
export function getTotalUndergroundSpaces(config: BasementConfig): number {
  return config.numberOfLevels * SPACES_PER_BASEMENT_LEVEL
}
