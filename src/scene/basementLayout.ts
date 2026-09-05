/**
 * The underground-volume model: how a basement level becomes independent
 * subsurface properties.
 *
 * UNIT CONVENTION: **1 Three.js unit = 1 metre**, as everywhere else. Every
 * length is metres, every area square metres, every volume cubic metres, and
 * **elevations below the ground datum are negative** — see
 * `geometry/groundDatum.ts`. There is no second scale and no "depth" axis that
 * counts the other way; a basement floor at three metres down is `yMin = −3`,
 * full stop.
 *
 * WHY THIS FILE EXISTS ALONGSIDE `unitLayout.ts` RATHER THAN INSIDE IT
 * The two generators do structurally the same thing — lay a grid over the
 * footprint's bounding box, inherit vertical bounds from a level layout, attach a
 * prototype identifier — and the temptation to unify them is real. They are kept
 * apart because *what they produce* is not the same kind of record:
 *
 *   • An apartment has a door number and a floor. A parking bay has neither; it
 *     has a use and a position within that use.
 *   • An apartment's identity is its ordinal on its floor (`U02`). A subsurface
 *     volume's identity includes what it is for (`P02` versus `S02`).
 *   • Apartments are counted upward from the datum; basement levels downward.
 *
 * Forcing one record type over both would produce a `floorLevel` that meant
 * "third storey" for some rows and "second basement" for others, distinguished by
 * a sign — the exact ambiguity a register exists to remove. Two types, two
 * generators, one shared footprint, one shared parcel, one shared validator.
 *
 * WHAT IS SHARED, DELIBERATELY AND COMPLETELY
 *   • the **footprint polygon** — the basement plan is derived from the same
 *     `BuildingFootprint` the surface building is derived from, measured by the
 *     same `getFootprintBounds`. It is not an unrelated rectangle that happens to
 *     be the same size; re-survey the plot and both move together.
 *   • the **parcel identity** — one `ParcelIdentity`, so every identifier above
 *     and below ground opens with the same four segments.
 *   • the **subdivision grid** — the same rectangular `columns × rows` approach,
 *     with the same prototype limitation (see below).
 *   • the **six-bounds discipline** — bounds are stored, sizes are derived once,
 *     and the centroid is **not stored at all**: it is a function of the bounds
 *     (`getUndergroundUnitCentre`), for the same reason `getUnitCenter` is. A
 *     stored centroid is the same fact written twice, and the second copy is the
 *     one that goes stale.
 *
 * PROTOTYPE LIMITATION, INHERITED HONESTLY
 * The grid is laid over the footprint's **bounding box**, exactly as the
 * apartment grid is. For the demo's axis-aligned rectangle that is exact. For an
 * L-shaped plan it would place volumes over ground the excavation does not
 * occupy — and the validator would then report them as outside the footprint,
 * which is the correct behaviour and the reason the check exists.
 *
 * No React, no Three.js. Runs in bare Node — see `basementSelfCheck.ts`.
 */

import {
  buildBasementLevels,
  getUseForIndex,
  UNDERGROUND_TYPE_CODES,
  type BasementConfig,
  type BasementLevelLayout,
  type UndergroundPropertyType,
} from './basementConfig'
import {
  getFootprintBounds,
  type BuildingFootprint,
  type FootprintBounds,
} from '../geometry/footprint'
import {
  DEMO_PARCEL_IDENTITY,
  formatParentParcelId,
  type ParcelIdentity,
} from '../ulpin/parcelIdentity'
import {
  formatUndergroundSpaceCode,
  generateUndergroundPrototype3DULPIN,
} from '../ulpin/generateUlpin'

/**
 * One below-ground property volume — an axis-aligned box in metres, with a
 * **negative** vertical extent.
 *
 * Stored as six bounds for the same reasons `ApartmentUnit` is: bounds are what
 * a register records, they compose (adjacency is one bound equalling another),
 * and containment and overlap become comparisons rather than reconstructions.
 * The size fields are derived once so no consumer has to subtract.
 */
export interface UndergroundUnit {
  /** Stable unique key within the model, e.g. `space-B01-P01`. */
  readonly id: string
  /**
   * Discriminator, so a volume can be told apart from an `ApartmentUnit` at
   * runtime as well as in the type system.
   *
   * The union that uses it lives in `scene/propertyVolume.ts`. It is a literal
   * field rather than an inferred check on `'basementLevel' in unit`, because a
   * structural probe is a rule someone has to remember and a tag is one the
   * compiler enforces.
   */
  readonly tier: 'underground'

  /** 1-based basement level, counting downward. The first basement is `1`. */
  readonly basementLevel: number
  /** 0-based index of that level in the excavation. `0` is nearest the surface. */
  readonly levelIndex: number
  /** 1-based position of this volume **within its own level**: 1..spacesPerLevel. */
  readonly indexOnLevel: number
  /**
   * 1-based count of this volume **within its own use, on its own level**.
   *
   * The second parking bay is `2` even though it is the second of four volumes
   * generated; the first store is `1` even though it is the third. This — not
   * `indexOnLevel` — is what the identifier's last segment counts, so that `P02`
   * genuinely means "the second parking bay" to anyone reading it.
   */
  readonly indexWithinType: number

  /** Cadastral use of the volume: parking, storage or utility/service. */
  readonly propertyType: UndergroundPropertyType
  /** The use-and-index segment on its own, e.g. `P01`. Generated, never typed. */
  readonly spaceCode: string
  /**
   * The human-facing label for this space, e.g. `B01-P01`.
   *
   * The below-ground counterpart of an apartment's door number, and named
   * `unitNumber` rather than `spaceNumber` for one concrete reason: it lets an
   * `UndergroundUnit` satisfy the validation engine's structural
   * `ValidatableVolume` contract without an adapter, so a basement volume and an
   * apartment are handed to `findOwnershipConflicts` as members of one array.
   * The cross-tier overlap check in Phase 11 exists because of this line.
   */
  readonly unitNumber: string
  /** A longer form for panels, e.g. `Parking P01`. Derived from the two above. */
  readonly spaceLabel: string

  /**
   * The parcel identifier shared with every apartment in the building above.
   *
   *   `KA-BLR-0482-001928`
   *
   * Identical text, from the same `ParcelIdentity` object. This is the field the
   * validator's parcel-linkage rule compares, and it is what makes "the basement
   * belongs to the same parcel" a checkable statement rather than an assurance.
   */
  readonly parentParcelId: string
  /**
   * The volume's **prototype** 3D ULPIN.
   *
   *   `KA-BLR-0482-001928-B01-P01`
   *
   * Generated here, at the model layer, in the same pass that produces the
   * bounds — so the identifier and the volume it names cannot describe different
   * things.
   *
   * PROTOTYPE ONLY: part of this project's own invented encoding, extended
   * downward in Phase 11. Not the official Government of India ULPIN format, and
   * no published scheme defines the `B` / `P` / `S` / `U` segments.
   */
  readonly prototypeUlpin: string

  /** 0-based grid column along X. */
  readonly column: number
  /** 0-based grid row along Z. */
  readonly row: number

  /** West edge, metres along X. */
  readonly xMin: number
  /** East edge, metres along X. */
  readonly xMax: number
  /** Floor, metres relative to the ground datum. **Negative.** */
  readonly yMin: number
  /** Ceiling, metres relative to the ground datum. `0` for the first basement. */
  readonly yMax: number
  /** South edge, metres along Z. */
  readonly zMin: number
  /** North edge, metres along Z. */
  readonly zMax: number

  /** `xMax - xMin`, metres. */
  readonly width: number
  /** `zMax - zMin`, metres. */
  readonly depth: number
  /** `yMax - yMin`, metres. Always positive: a height, not a depth. */
  readonly height: number

  /** Floor area, `width * depth`, in square metres. */
  readonly areaSqM: number
  /** Enclosed volume, `areaSqM * height`, in cubic metres. */
  readonly volumeCubicM: number
}

/**
 * Format the label a person reads for one space: `B01-P01`.
 *
 * The level and the space code joined, with the level zero-padded to two digits
 * so `B01` sorts before `B10`. One function so the label, the identifier segment
 * and the scene text cannot drift.
 */
export function formatUndergroundLabel(
  basementLevel: number,
  spaceCode: string,
): string {
  return `B${String(basementLevel).padStart(2, '0')}-${spaceCode}`
}

/**
 * Cut one basement level into a grid of volumes and return them.
 *
 * WHERE THE HORIZONTAL NUMBERS COME FROM
 * From the **bounding box of the building footprint polygon**, passed in —
 * exactly as `buildUnitsForFloor` gets them, from exactly the same measurement of
 * exactly the same polygon:
 *
 *   spaceWidth = (bounds.xMax − bounds.xMin) / unitColumns     (18 / 2 = 9 m)
 *   spaceDepth = (bounds.zMax − bounds.zMin) / unitRows        (14 / 2 = 7 m)
 *
 * So the basement's plan is the building's plan. It is not a rectangle authored
 * beside it that happens to match: change the footprint's corners and the
 * basement moves with the building, because there is one polygon and both
 * generators measure it.
 *
 * WHERE THE VERTICAL NUMBERS COME FROM
 * Verbatim from the level layout — `level.baseY` and `level.topY`, never
 * recomputed — so a volume can never disagree with its level about which slice of
 * the subsurface it occupies. That is the same rule apartments follow with their
 * floors, and it is what the validator's level-interval check asserts is still
 * true.
 *
 * Volumes are walked row-major (Z outer, X inner), matching the apartment grid,
 * so `indexOnLevel` 1..4 reads left-to-right then front-to-back: 1 2 / 3 4.
 */
function buildSpacesForLevel(
  config: BasementConfig,
  bounds: FootprintBounds,
  level: BasementLevelLayout,
  parcel: ParcelIdentity,
): UndergroundUnit[] {
  const footprintWidth = bounds.xMax - bounds.xMin
  const footprintDepth = bounds.zMax - bounds.zMin

  const spaceWidth = footprintWidth / config.unitColumns
  const spaceDepth = footprintDepth / config.unitRows
  // Positive by construction: `topY` is above `baseY` even though both are at or
  // below zero. A height is a length; only the elevations are negative.
  const spaceHeight = level.topY - level.baseY

  const parentParcelId = formatParentParcelId(parcel)

  /**
   * How many of each use have been emitted on this level so far.
   *
   * The counter is what makes the identifier's last segment count *within its
   * use*: the third volume generated is the first store, so it gets `S01` rather
   * than `S03`. Reset per level, because `B02-P01` and `B01-P01` are different
   * spaces and both are correctly the first parking bay on their own level.
   */
  const countByType = new Map<UndergroundPropertyType, number>()

  const spaces: UndergroundUnit[] = []

  for (let row = 0; row < config.unitRows; row++) {
    for (let column = 0; column < config.unitColumns; column++) {
      const indexOnLevel = row * config.unitColumns + column + 1

      const propertyType = getUseForIndex(config, indexOnLevel - 1)
      const indexWithinType = (countByType.get(propertyType) ?? 0) + 1
      countByType.set(propertyType, indexWithinType)

      const spaceCode = formatUndergroundSpaceCode(
        UNDERGROUND_TYPE_CODES[propertyType],
        indexWithinType,
      )
      const unitNumber = formatUndergroundLabel(level.level, spaceCode)

      // Offsets into the footprint's own extent — not into a config constant.
      const xMin = bounds.xMin + column * spaceWidth
      const zMin = bounds.zMin + row * spaceDepth

      const areaSqM = spaceWidth * spaceDepth

      spaces.push({
        id: `space-${unitNumber}`,
        tier: 'underground',

        basementLevel: level.level,
        levelIndex: level.index,
        indexOnLevel,
        indexWithinType,

        propertyType,
        spaceCode,
        unitNumber,
        spaceLabel: `${propertyType} ${spaceCode}`,

        parentParcelId,
        prototypeUlpin: generateUndergroundPrototype3DULPIN(
          parcel,
          level.level,
          UNDERGROUND_TYPE_CODES[propertyType],
          indexWithinType,
        ),

        column,
        row,

        xMin,
        xMax: xMin + spaceWidth,
        // Inherited, not recomputed: the volume spans exactly its level.
        yMin: level.baseY,
        yMax: level.topY,
        zMin,
        zMax: zMin + spaceDepth,

        width: spaceWidth,
        depth: spaceDepth,
        height: spaceHeight,

        areaSqM,
        volumeCubicM: areaSqM * spaceHeight,
      })
    }
  }

  return spaces
}

/**
 * Generate every below-ground volume, level by level.
 *
 * **This is the 2D-to-3D transformation, applied downward.** The same two inputs
 * as the surface building, contributing the same two things:
 *
 *   BuildingFootprint ──► bounding box ──┐
 *    (the SAME surveyed  horizontal      ├──► UndergroundUnit[]
 *     polygon)           extent          │     four volumes at −3 → 0 m
 *                                        │
 *   BasementConfig ──► BasementLevel[] ──┘
 *    (excavation)      vertical slices
 *
 * The footprint supplies **where**, the basement config supplies **how deep and
 * how many**. Nothing is hand-authored: four volumes exist because the config
 * says one level of a 2 × 2 grid, and changing either produces a different
 * basement with no edit to this function or to any renderer.
 *
 * Identifiers are **not** checked for uniqueness here, and that is deliberate.
 * `buildApartmentUnits` asserts uniqueness over its own twenty because that is
 * the whole set it produces. The basement's four are a *fragment* of a larger
 * set, and the property that matters is that all twenty-four are distinct — a
 * question neither generator can answer alone. It is asserted by
 * `assertUniquePropertyIdentifiers` in `scene/propertyVolume.ts`, where both
 * halves are in scope, and re-checked by the validation engine over whatever
 * array it is handed.
 */
export function buildUndergroundUnits(
  config: BasementConfig,
  footprint: BuildingFootprint,
  levels: BasementLevelLayout[] = buildBasementLevels(config),
  parcel: ParcelIdentity = DEMO_PARCEL_IDENTITY,
): UndergroundUnit[] {
  // Measured once for the whole excavation, from the building's own footprint.
  const bounds = getFootprintBounds(footprint)

  return levels.flatMap((level) =>
    buildSpacesForLevel(config, bounds, level, parcel),
  )
}

/**
 * The centre of a volume's box, in metres — a **derived** value, on demand.
 *
 *   centreX = (xMin + xMax) / 2
 *   centreY = (yMin + yMax) / 2      // negative for a basement: −1.5 m
 *   centreZ = (zMin + zMax) / 2
 *
 * Exactly `getUnitCenter`, for exactly the same reason: Three.js anchors a box at
 * its centre, and storing that centre on the record would put one fact in two
 * places. The bounds are the truth. The property inspector's "Centroid" rows read
 * this function, so what the panel prints is what the mesh is positioned at.
 */
export function getUndergroundUnitCentre(
  unit: UndergroundUnit,
): [number, number, number] {
  return [
    (unit.xMin + unit.xMax) / 2,
    (unit.yMin + unit.yMax) / 2,
    (unit.zMin + unit.zMax) / 2,
  ]
}

/**
 * Resolve a volume id back to the generated record it names.
 *
 * The below-ground twin of `findUnitById`, and the reason selection can stay a
 * bare string across both tiers. Returns `null` for `null` and for an id that no
 * longer exists, so a stale selection degrades to an empty inspector rather than
 * to a crash.
 */
export function findUndergroundUnitById(
  units: readonly UndergroundUnit[],
  unitId: string | null,
): UndergroundUnit | null {
  if (unitId === null) return null
  return units.find((unit) => unit.id === unitId) ?? null
}

/**
 * The volumes on one basement level, and what they add up to.
 *
 * Derived from the volumes themselves rather than from the config — the same
 * discipline `getIsolationSummary` follows for a floor — so the panel reports the
 * elevation of *the volumes it is counting*. If a volume ever disagreed with its
 * level, this would show it rather than paper over it.
 */
export interface BasementLevelSummary {
  readonly basementLevel: number
  readonly spaceCount: number
  /** Floor elevation, metres. Negative. */
  readonly baseY: number
  /** Ceiling elevation, metres. */
  readonly topY: number
  /** Combined floor area of the level's volumes, m². */
  readonly totalAreaSqM: number
}

/** Summarise one basement level. `null` when it holds nothing. */
export function getBasementLevelSummary(
  basementLevel: number,
  units: readonly UndergroundUnit[],
): BasementLevelSummary | null {
  const onLevel = units.filter((unit) => unit.basementLevel === basementLevel)
  if (onLevel.length === 0) return null

  let baseY = Number.POSITIVE_INFINITY
  let topY = Number.NEGATIVE_INFINITY
  let totalAreaSqM = 0

  for (const unit of onLevel) {
    if (unit.yMin < baseY) baseY = unit.yMin
    if (unit.yMax > topY) topY = unit.yMax
    totalAreaSqM += unit.areaSqM
  }

  return { basementLevel, spaceCount: onLevel.length, baseY, topY, totalAreaSqM }
}
