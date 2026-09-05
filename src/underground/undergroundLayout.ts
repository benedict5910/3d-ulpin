/**
 * The underground-space model: how each basement level becomes **one** large
 * cadastral property below the ground datum.
 *
 * UNIT CONVENTION: **1 Three.js unit = 1 metre**, as everywhere else. Every
 * length is metres, every area square metres, every volume cubic metres.
 *
 * WHAT THIS MODULE PRODUCES NOW, AND WHAT IT USED TO
 * It used to cut one 3 m level into a 2 × 2 grid of four small volumes typed
 * Parking, Parking, Storage and Utility, over the **tower's** footprint. It now
 * produces **two parking decks, one per level, each a single undivided
 * cadastral space over the excavation's own, wider footprint**:
 *
 *   B1   −3.0 m → 0.0 m    22 × 18 m   Parking   KA-…-B01-PARK
 *   B2   −6.0 m → −3.0 m   22 × 18 m   Parking   KA-…-B02-PARK
 *
 * Both changes are cadastral rather than cosmetic, and they are the point of
 * the redesign:
 *
 *   **One space per level.** A parking deck is one floor plate held as one
 *   subsurface property; bays inside it are allotted by an instrument the land
 *   register does not hold. Four quarter-boxes invented four ownership
 *   boundaries that do not exist. See `basementConfig.ts`.
 *
 *   **Its own plan.** The deck is dug wider than the tower — out toward the
 *   setback line, because a ramp and two rows of bays do not fit inside a
 *   residential core. A subsurface property *larger in plan* than the surface
 *   property above it is the case a 2D cadastre cannot express at all, and it
 *   is now the case this model shows.
 *
 *   BasementFootprint ──► bounding box ──┐
 *    (the excavation's OWN surveyed ring, ├──► UndergroundSpace[]
 *     parented to the same parcel)        │     one deck per level
 *   BasementConfig ──► level layouts ─────┘
 *
 * **The horizontal source is the excavation's footprint, not the building's.**
 * That is the claim the prototype now makes, and the reason `footprint` is a
 * required parameter with no default: every call site has to say which ring it
 * means, and getting it wrong is a visible decision rather than an inherited
 * assumption. The relationships that used to hold *by construction* — inside
 * the parcel, no positive overlap with the tower's volumes — are now **checked**
 * by `validation/undergroundRules.ts` rather than guaranteed by sharing one
 * polygon. That is a strictly stronger position: the validator is doing work it
 * previously could not fail at.
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
  generateUndergroundDeckPrototype3DULPIN,
  PARKING_DECK_CODE,
} from '../ulpin/generateUlpin'
import {
  buildBasementLevels,
  type BasementConfig,
  type BasementLevelLayout,
} from './basementConfig'

/**
 * What an underground space is used for, in cadastral terms.
 *
 * A one-member union today: **every space below this datum is a parking deck.**
 * It stays a union rather than collapsing to a bare string because the day the
 * model records a substation or a shared cycle store, the compiler points at
 * every place that has to cope — which is the whole value the `Storage` and
 * `Utility` members carried, even though the shape they described (a quarter of
 * one level, typed by its position in a grid) was not worth keeping.
 *
 * Deliberately *not* merged with the above-ground `PropertyType` union.
 * `Residential` is not a thing a basement level of this building contains, and
 * a single union would let the two be confused at a call site where only one is
 * meaningful.
 */
export type UndergroundSpaceType = 'Parking'

/**
 * The use of every space on a basement level.
 *
 * A constant, not a lookup by index. The old `UNDERGROUND_SPACE_TYPES` array
 * assigned a use *by position in a grid* — the third box was a store because it
 * was third — which made the use an accident of iteration order. There is no
 * grid and no position to read from now: a level is a parking deck, and this is
 * the one place that says so.
 */
export const BASEMENT_LEVEL_USE: UndergroundSpaceType = 'Parking'

/**
 * The human-facing name of that use, for panels and the inspector.
 *
 * `Parking` is the cadastral *use*; `Parking Deck` is what a person reading the
 * record calls the thing. Kept beside the use rather than typed into a panel,
 * so the inspector and the scene cannot come to describe one volume with two
 * different words.
 */
export const PARKING_DECK_LABEL = 'Parking Deck'

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
  /** Stable unique key within the model, e.g. `underground-B01`. */
  readonly id: string
  /** 1-based basement level. The first level below the datum is 1. */
  readonly basementLevel: number
  /** 0-based index of that level in the downward stack. B1 is `0`. */
  readonly levelIndex: number
  /** Display name of that level, e.g. `Basement 1`. Carried, not re-derived. */
  readonly levelLabel: string
  /**
   * Human-facing space number, e.g. `B1`.
   *
   * A display label only — never parsed, and never a source for the identifier,
   * exactly like `ApartmentUnit.unitNumber`.
   *
   * Named `unitNumber` rather than `spaceNumber` so that this record satisfies
   * the validation engine's `ValidatableUndergroundUnit` contract without an
   * adapter: the register-wide rules then read one field name on both sides of
   * the datum, and a below-ground volume is handed to them beside a flat.
   *
   * It no longer carries a per-level ordinal (`B1-02`), because there is no
   * longer more than one space on a level to tell apart.
   */
  readonly unitNumber: string
  /** Cadastral use of the space. `Parking` for every deck in this model. */
  readonly propertyType: UndergroundSpaceType
  /** What a person calls it: `Parking Deck`. Display only. */
  readonly useLabel: string
  /** The scene's short caption for this deck, e.g. `B1 · PARKING`. */
  readonly deckLabel: string

  /** The parcel identifier shared with every unit in the building above. */
  readonly parentParcelId: string
  /**
   * The space's **prototype** 3D ULPIN, e.g. `KA-BLR-0482-001928-B01-PARK`.
   *
   * Generated here, at the model layer, at the same moment as the geometry, so
   * the identifier and the volume it names come from one pass over one set of
   * inputs. PROTOTYPE ONLY — an encoding invented for this demonstration, and
   * never the official Government of India ULPIN format.
   */
  readonly prototypeUlpin: string

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

/** The display number for a deck: `B1`, `B2`. One place, so the panels agree. */
export function formatDeckNumber(basementLevel: number): string {
  return `B${basementLevel}`
}

/**
 * The scene caption for a deck: `B1 · PARKING`.
 *
 * Composed here, next to the record, rather than inside `SceneLabels`, so the
 * text floating in the 3D view is a **field of the record it names**. A label
 * the renderer assembled would be a second description of the same volume, free
 * to drift the moment the use changed.
 */
export function formatDeckLabel(
  basementLevel: number,
  use: UndergroundSpaceType,
): string {
  return `${formatDeckNumber(basementLevel)} · ${use.toUpperCase()}`
}

/**
 * Cut one basement level into a single parking deck spanning the excavation.
 *
 * The horizontal arithmetic is now trivial, and that is exactly the change:
 *
 *   xMin = bounds.xMin,  xMax = bounds.xMax     (−11 → +11, 22 m)
 *   zMin = bounds.zMin,  zMax = bounds.zMax     (−9  → +9,  18 m)
 *
 * The deck **is** the excavation's extent — one space, the full plan, 396 m².
 * No division, no grid indices, no per-position use lookup.
 *
 * The vertical bounds are taken verbatim from the level, never recomputed, so a
 * deck cannot disagree with its level about which slice of the excavation it
 * occupies. That is the invariant the validator's interval rule asserts is
 * still true, and it is the check that fires first if a later phase ever lets
 * an elevation be edited independently of its level.
 *
 * The prototype limitation that remains: the deck is laid over the footprint's
 * **bounding box** — exact for the authored rectangle, approximate for an
 * L-shaped excavation. `BuildingSummary` states it where the figures are shown.
 */
function buildDeckForLevel(
  bounds: FootprintBounds,
  level: BasementLevelLayout,
  parcel: ParcelIdentity,
): UndergroundSpace {
  const width = bounds.xMax - bounds.xMin
  const depth = bounds.zMax - bounds.zMin
  // Positive by construction: `topY` is above `baseY` even though both are at
  // or below zero. A height is a length; only the elevations are negative.
  const height = level.topY - level.baseY

  const areaSqM = width * depth
  const use = BASEMENT_LEVEL_USE

  return {
    // The identifier's own level segment, reused as the key: one naming
    // decision, so a deck's DOM-facing id and its cadastral id cannot come to
    // disagree about which space they name.
    id: `underground-B${String(level.level).padStart(2, '0')}`,
    basementLevel: level.level,
    levelIndex: level.index,
    levelLabel: level.label,
    unitNumber: formatDeckNumber(level.level),
    propertyType: use,
    useLabel: PARKING_DECK_LABEL,
    deckLabel: formatDeckLabel(level.level, use),

    parentParcelId: formatParentParcelId(parcel),
    // `PARK` rather than the old `U02` / `S01` scheme: with one space per level
    // there is no ordinal left to count, and a segment naming the *use* is what
    // remains worth encoding. See `ulpin/generateUlpin.ts`.
    prototypeUlpin: generateUndergroundDeckPrototype3DULPIN(
      parcel,
      level.level,
      PARKING_DECK_CODE,
    ),

    xMin: bounds.xMin,
    xMax: bounds.xMax,
    // Inherited, not recomputed: the deck spans exactly its level.
    yMin: level.baseY,
    yMax: level.topY,
    zMin: bounds.zMin,
    zMax: bounds.zMax,

    width,
    depth,
    height,

    areaSqM,
    volumeCubicM: areaSqM * height,

    isUnderground: true,
  }
}

/**
 * Generate every underground space, one per level.
 *
 * Nothing is hand-authored. Two decks exist because the config says two levels;
 * changing `numberOfLevels` to 3 adds a third at −9 → −6 with no edit to this
 * function or to any renderer, and changing the excavation ring's corners moves
 * both decks with no edit either.
 *
 * `footprint` is **the excavation's ring**, required and with no default: every
 * call site has to say which geometry it means, and since the redesign that is
 * no longer the same ring the building above is cut from. Passing the tower's
 * footprint here would produce a technically valid but wrong record — decks the
 * size of the building — which is precisely why it is not defaulted.
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
  // The excavation's own footprint, measured once for the whole stack.
  const bounds = getFootprintBounds(footprint)

  const spaces = levels.map((level) => buildDeckForLevel(bounds, level, parcel))

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
