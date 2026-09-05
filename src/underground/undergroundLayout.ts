/**
 * The underground-space model: how one basement level becomes four independent
 * 3D properties below the ground datum.
 *
 * UNIT CONVENTION: **1 Three.js unit = 1 metre**, as everywhere else. Every
 * length is metres, every area square metres, every volume cubic metres.
 *
 * This is the below-ground counterpart of `scene/unitLayout.ts` and it is built
 * the same way, from the same inputs, on purpose:
 *
 *   BuildingFootprint ──► bounding box ──┐
 *    (the SAME surveyed polygon the      ├──► UndergroundSpace[]
 *     floors above are cut from)         │
 *   BasementConfig ──► level layouts ────┘
 *
 * **The horizontal source is the building footprint, not a second polygon.**
 * That is the cadastral claim the prototype is making: the excavation lies
 * under the building's own plan, so its plan *is* the building's plan, and the
 * two cannot drift because there is only one ring. The only thing that differs
 * between a unit and an underground space is the vertical interval it occupies
 * and the use it is put to.
 *
 * WHY A SEPARATE TYPE FROM `ApartmentUnit`
 * An `ApartmentUnit` carries a `floorLevel` that a great deal of code reads as
 * "1-based floor in the upward stack": the ULPIN encoder, floor isolation, the
 * exploded view's upward offset, the conflict simulation's preferred floor.
 * Handing those a record whose `floorLevel` meant "basement 1" would make every
 * one of them silently wrong. A distinct type means the compiler asks each
 * consumer which of the two it wants, and the answers are visible.
 *
 * What the two types DO share is structure: both are six-bounds boxes carrying
 * an id, a parent parcel and a prototype identifier, so both satisfy the
 * validator's `Box3D` and both feed one selection mechanism and one inspector.
 * The shared shapes are structural, not inherited — see `ui/spaceRecord.ts`.
 *
 * No React and no Three.js here either.
 */

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
  assertUniqueIdentifiers,
  generateUndergroundPrototype3DULPIN,
  UNIT_PREFIX,
} from '../ulpin/generateUlpin'
import {
  buildBasementLevels,
  type BasementConfig,
  type BasementLevelLayout,
} from './basementConfig'

/**
 * What an underground space is used for, in cadastral terms.
 *
 * A union rather than a bare `string`, for the same reason `PropertyType` is:
 * the day a basement holds a substation or a shared cycle store, the compiler
 * points at every place that has to cope. Deliberately *not* merged with the
 * above-ground `PropertyType` union — `Residential` is not a thing a basement
 * level of this building contains, and a single union would let the two be
 * confused at a call site where only one is meaningful.
 */
export type UndergroundSpaceType = 'Parking' | 'Storage' | 'Utility'

/**
 * The use assigned to each space on a level, **by its index on that level**.
 *
 * Two parking bays, a store and a plant room: the ordinary composition of a
 * small residential basement, and four spaces of three different types rather
 * than four identical ones, so the interface has something real to distinguish.
 *
 * It lives here, next to the generator, rather than in a panel — the panel must
 * *read* a space's type, never decide it. Indexed rather than hard-assigned per
 * space so a config with a different grid still resolves: the lookup wraps.
 */
export const UNDERGROUND_SPACE_TYPES: readonly UndergroundSpaceType[] = [
  'Parking',
  'Parking',
  'Storage',
  'Utility',
]

/** The use for the `n`th space on a level, 1-based. Wraps for larger grids. */
export function getUndergroundSpaceType(
  indexOnLevel: number,
): UndergroundSpaceType {
  const position = (indexOnLevel - 1) % UNDERGROUND_SPACE_TYPES.length
  return UNDERGROUND_SPACE_TYPES[position]
}

/**
 * One underground property space — an axis-aligned box in metres, below y = 0.
 *
 * Stored as **six bounds**, exactly like `ApartmentUnit`, and for the same
 * reasons: bounds are what a register records, they compose, and containment
 * and overlap become comparisons rather than reconstructions. `yMin` and `yMax`
 * are both ≤ 0 and `yMin < yMax` still holds — below ground is a different
 * interval, not a different sign convention.
 *
 * Axes follow Three.js: **X = width (east), Y = up (elevation), Z = depth
 * (north)**, the mapping fixed in `geometry/footprint.ts`.
 */
export interface UndergroundSpace {
  /** Stable unique key within the model, e.g. `underground-B01-U02`. */
  readonly id: string
  /** 1-based basement level. The first level below the datum is 1. */
  readonly basementLevel: number
  /** Display name of that level, e.g. `Basement 1`. Carried, not re-derived. */
  readonly levelLabel: string
  /** 1-based position of the space **within its own level**: 1..spacesPerLevel. */
  readonly indexOnLevel: number
  /**
   * Human-facing space number, e.g. `B1-02`.
   *
   * A display label only — never parsed, and never a source for the identifier,
   * exactly like `ApartmentUnit.unitNumber`.
   *
   * Named `unitNumber` rather than `spaceNumber` so that this record satisfies
   * the validation engine's `ValidatableUndergroundUnit` contract without an
   * adapter: the register-wide rules then read one field name on both sides of
   * the datum, and a below-ground volume is handed to them beside a flat.
   */
  readonly unitNumber: string
  /** Cadastral use of the space: parking, storage or utility. */
  readonly propertyType: UndergroundSpaceType

  /** The parcel identifier shared with every unit in the building above. */
  readonly parentParcelId: string
  /**
   * The space's **prototype** 3D ULPIN, e.g. `KA-BLR-0482-001928-B01-U02`.
   *
   * Generated here, at the model layer, at the same moment as the geometry, so
   * the identifier and the volume it names come from one pass over one set of
   * inputs. PROTOTYPE ONLY — an encoding invented for this demonstration.
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
  /** Floor slab, metres relative to the ground datum. Negative. */
  readonly yMin: number
  /** Ceiling, metres relative to the ground datum. `0` on the topmost level. */
  readonly yMax: number
  /** South edge, metres along Z. */
  readonly zMin: number
  /** North edge, metres along Z. */
  readonly zMax: number

  /** `xMax - xMin`, metres. */
  readonly width: number
  /** `zMax - zMin`, metres. */
  readonly depth: number
  /** `yMax - yMin`, metres. Positive: the interval is below zero, not inverted. */
  readonly height: number

  /** Floor area, `width * depth`, in square metres. */
  readonly areaSqM: number
  /** Enclosed volume, `areaSqM * height`, in cubic metres. */
  readonly volumeCubicM: number

  /**
   * Always `true`.
   *
   * A type-level marker so a consumer holding "some space" can narrow without
   * inspecting an elevation. Reading a sign to decide what kind of record
   * something is would make the classification a *consequence* of geometry that
   * a simulation could shift; this is a fact about the record.
   */
  readonly isUnderground: true
}

/** Format a space number from a level and a position on that level: `B1-02`. */
function formatSpaceNumber(basementLevel: number, indexOnLevel: number): string {
  return `B${basementLevel}-${String(indexOnLevel).padStart(2, '0')}`
}

/**
 * Cut one basement level into a grid of underground spaces.
 *
 * The horizontal arithmetic is deliberately **identical** to
 * `buildUnitsForFloor`, over the same bounding box:
 *
 *   spaceWidth = (bounds.xMax - bounds.xMin) / spaceColumns     (18 / 2 = 9 m)
 *   spaceDepth = (bounds.zMax - bounds.zMin) / spaceRows        (14 / 2 = 7 m)
 *
 * so an underground space sits exactly beneath the unit above it, sharing its
 * plan and meeting it at the datum. That vertical alignment is not decorative:
 * it is what makes "touching at y = 0 is valid, positive overlap is not" a
 * claim the demo actually exercises rather than one it asserts about volumes
 * that never come near each other.
 *
 * The same prototype limitation applies as above ground and for the same
 * reason: the grid is laid over the footprint's **bounding box**, so an
 * irregular plan would put spaces under ground the building does not occupy.
 * The app warns about it once, at the call site, for both directions at once.
 *
 * The vertical bounds are taken verbatim from the level, never recomputed, so a
 * space cannot disagree with its level about which slice of the excavation it
 * occupies.
 *
 * Spaces are walked row-major (Z outer, X inner), matching the unit ordering.
 */
function buildSpacesForLevel(
  config: BasementConfig,
  bounds: FootprintBounds,
  level: BasementLevelLayout,
  parcel: ParcelIdentity,
): UndergroundSpace[] {
  const footprintWidth = bounds.xMax - bounds.xMin
  const footprintDepth = bounds.zMax - bounds.zMin

  const spaceWidth = footprintWidth / config.spaceColumns
  const spaceDepth = footprintDepth / config.spaceRows
  const spaceHeight = level.topY - level.baseY
  const parentParcelId = formatParentParcelId(parcel)

  const spaces: UndergroundSpace[] = []

  for (let row = 0; row < config.spaceRows; row++) {
    for (let column = 0; column < config.spaceColumns; column++) {
      const indexOnLevel = row * config.spaceColumns + column + 1

      const xMin = bounds.xMin + column * spaceWidth
      const zMin = bounds.zMin + row * spaceDepth
      const areaSqM = spaceWidth * spaceDepth

      // `UNIT_PREFIX` and the space's position on its level — deliberately the
      // same two segments this generator has always produced, so every
      // identifier it emits is byte-for-byte what it was: `…-B01-U02`.
      //
      // The generator now takes the segment's letter as a parameter because the
      // basement layout counts within a *use* (`P02` is the second parking
      // bay). This one does not: it numbers spaces across the level, and `U`
      // here is the unit-index prefix it has always been, not the utility use
      // code. Passing it explicitly is what keeps the two schemes from being
      // silently merged by a shared default.
      const prototypeUlpin = generateUndergroundPrototype3DULPIN(
        parcel,
        level.level,
        UNIT_PREFIX,
        indexOnLevel,
      )

      spaces.push({
        // The identifier's own level and index segments, reused as the key:
        // one naming decision, so a space's DOM-facing id and its cadastral id
        // cannot come to disagree about which space they name.
        id: `underground-B${String(level.level).padStart(2, '0')}-U${String(indexOnLevel).padStart(2, '0')}`,
        basementLevel: level.level,
        levelLabel: level.label,
        indexOnLevel,
        unitNumber: formatSpaceNumber(level.level, indexOnLevel),
        propertyType: getUndergroundSpaceType(indexOnLevel),

        parentParcelId,
        prototypeUlpin,

        column,
        row,

        xMin,
        xMax: xMin + spaceWidth,
        // Inherited, not recomputed: the space spans exactly its level.
        yMin: level.baseY,
        yMax: level.topY,
        zMin,
        zMax: zMin + spaceDepth,

        width: spaceWidth,
        depth: spaceDepth,
        height: spaceHeight,

        areaSqM,
        volumeCubicM: areaSqM * spaceHeight,

        isUnderground: true,
      })
    }
  }

  return spaces
}

/**
 * Generate every underground space, level by level.
 *
 * Nothing is hand-authored. Four spaces exist because the config says one level
 * of a 2 × 2 grid; changing `numberOfLevels` to 2 or `spaceColumns` to 3
 * changes the excavation with no edit to this function or to any renderer, and
 * changing the footprint's corners moves every space with no edit either.
 *
 * `footprint` is required and has no default, deliberately: every call site has
 * to say which geometry it means, and it must be the *same* footprint the
 * building above was cut from.
 *
 * Uniqueness is asserted here, over the underground identifiers alone. The
 * cross-set guarantee — that no underground identifier equals an above-ground
 * one — is structural (the `B` prefix differs from `F`) and is *reported* by
 * the topology engine over the combined set rather than thrown here, because by
 * the time the engine runs the arrays may have been modified by a simulation
 * and a register in that state must say so, not crash.
 */
export function buildUndergroundSpaces(
  config: BasementConfig,
  footprint: BuildingFootprint,
  levels: BasementLevelLayout[] = buildBasementLevels(config),
  parcel: ParcelIdentity = DEMO_PARCEL_IDENTITY,
): UndergroundSpace[] {
  // The building's own footprint, measured once — the same measurement the
  // above-ground generator makes, of the same ring.
  const bounds = getFootprintBounds(footprint)

  const spaces = levels.flatMap((level) =>
    buildSpacesForLevel(config, bounds, level, parcel),
  )

  assertUniqueIdentifiers(spaces.map((space) => space.prototypeUlpin))

  return spaces
}

/**
 * The centre of an underground space's box, in metres — a *rendering* value.
 *
 * Derived on demand rather than stored, for the same reason `getUnitCenter` is:
 * the bounds are the truth, the centre is a function of them, and storing both
 * invites the pair to drift. It exists because Three.js anchors a box at its
 * centre.
 */
export function getUndergroundSpaceCenter(
  space: UndergroundSpace,
): [number, number, number] {
  return [
    (space.xMin + space.xMax) / 2,
    (space.yMin + space.yMax) / 2,
    (space.zMin + space.zMax) / 2,
  ]
}

/**
 * Resolve a space id back to the generated space it names.
 *
 * The underground half of the one selection mechanism: `App` holds a single
 * selected id and asks both resolvers, so an underground space is selected by
 * exactly the same machinery as a unit rather than by a parallel one. Returns
 * `null` for `null` and for an id that no longer exists, which is what makes a
 * stale selection harmless.
 */
export function findUndergroundSpaceById(
  spaces: readonly UndergroundSpace[],
  spaceId: string | null,
): UndergroundSpace | null {
  if (spaceId === null) return null
  return spaces.find((space) => space.id === spaceId) ?? null
}
