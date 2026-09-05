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
 * Anything below ground that needs a width, a depth or an area asks the same
 * building footprint the floors above are cut from — which is what makes the
 * basement share the building's plan by *derivation* rather than by two
 * numbers that happen to match.
 */
export interface BasementConfig {
  /** How many basement levels are excavated, counting downward from the datum. */
  readonly numberOfLevels: number
  /** Floor-to-ceiling depth of each basement level, in metres. Uniform. */
  readonly levelDepth: number
  /** How many underground spaces each level is cut into along X (east-west). */
  readonly spaceColumns: number
  /** How many underground spaces each level is cut into along Z (north-south). */
  readonly spaceRows: number
}

/** The one basement the prototype shows: a single 3 m level, cut 2 × 2. */
export const DEFAULT_BASEMENT_CONFIG: BasementConfig = {
  numberOfLevels: 1,
  levelDepth: 3,
  // A 2 x 2 grid: four underground spaces on the one level.
  spaceColumns: 2,
  spaceRows: 2,
}

/**
 * Where one basement level sits on the vertical axis, in metres.
 *
 * The mirror of `FloorLayout`, and deliberately the same shape: `baseY` is the
 * lower bound and `topY` the upper one, so `baseY < topY` holds below ground
 * exactly as it does above and no consumer needs a sign special-case. For the
 * demo's single level that is `baseY = -3`, `topY = 0`.
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
 * With one 3 m level that produces exactly **−3.0 m → 0.0 m**: the topmost
 * basement ceiling *is* the ground datum, so it touches the ground floor's slab
 * and does not intersect it. A second level would be −6 → −3, meeting the first
 * at −3 the same way. Each level starts exactly where the one above it ends,
 * with no gaps and no overlap — the downward statement of the invariant
 * `buildFloorLayouts` states upward.
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
 * because it is a *depth*, a quantity a person states as "three metres down";
 * the elevation it corresponds to is `-getTotalDepthM(config)`.
 */
export function getTotalDepthM(config: BasementConfig): number {
  return config.numberOfLevels * config.levelDepth
}

/** The lowest elevation the model reaches, in metres. Negative. */
export function getLowestElevationM(config: BasementConfig): number {
  return GROUND_DATUM_Y - getTotalDepthM(config)
}

/** How many underground spaces sit on one level. `2 × 2 = 4`. */
export function getSpacesPerLevel(config: BasementConfig): number {
  return config.spaceColumns * config.spaceRows
}

/** How many underground spaces the whole basement contains. `1 × 4 = 4`. */
export function getTotalUndergroundSpaces(config: BasementConfig): number {
  return config.numberOfLevels * getSpacesPerLevel(config)
}
