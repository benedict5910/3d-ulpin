/**
 * Exploded view: a **visualisation transform**, not a change to the model.
 *
 * THE ONE IDEA IN THIS FILE
 * Floor 3 of the demo building occupies 6 m to 9 m above ground, and unit 302
 * occupies 0–9 m east of the origin. In exploded view floor 3 is *drawn* several
 * metres higher, and unit 302 is *drawn* pushed outward from the middle of its
 * floor. Neither unit moves. The property inspector still says 6–9 m, the
 * prototype ULPIN is unchanged, and any future export is unchanged.
 *
 * That separation is the whole design. `ApartmentUnit`'s six bounds are
 * cadastral facts: they say which slice of space a person owns. If exploding the
 * view edited them, the interface would be answering "where is this property"
 * with coordinates that depend on a display toggle — which is precisely the
 * class of bug that makes a spatial register untrustworthy.
 *
 * So this module produces **offsets**, in metres, and nothing else. Every offset
 * is added at render time by the component placing a mesh, and nothing reads one
 * back. See ARCHITECTURE §10 for the three-way separation this belongs to
 * (canonical geometry / visualisation transform / simulation override).
 *
 * SUBPHASE A ADDED THE SECOND AXIS OF SEPARATION.
 * Before, floors separated vertically and that was all — the picture showed
 *
 *     parcel → floor layers
 *
 * and stopped one level short of the thing the project is actually about.
 * A unit explosion carries it to the end:
 *
 *     parcel → floor layers → individual ownership volumes
 *
 * Vertical separation shows that a building is a stack of strata. Horizontal
 * separation shows that a stratum is a set of *separately owned volumes*, which
 * is the claim a 3D cadastre makes and the one a judge most needs to see.
 *
 * WHY THE HORIZONTAL DIRECTION IS DERIVED, NOT TABULATED
 * The obvious implementation is a lookup: 301 goes north-west, 302 north-east,
 * and so on. It would work today and be wrong in principle — the direction a
 * unit moves is a *fact about where that unit sits on its floor*, so it should
 * be computed from where that unit sits on its floor:
 *
 *     direction = normalise(unitPlanCentre − floorPlanCentre)
 *     offset    = direction × EXPLODED_UNIT_DISTANCE_M × amount
 *
 * Change the grid from 2 × 2 to 3 × 4 and this keeps working with no edit. The
 * middle unit of a 3 × 3 grid sits *on* the floor's centre, has no direction,
 * and correctly does not move.
 *
 * WHY NORMALISED RATHER THAN SCALED
 * Multiplying the raw offset vector (a "scale about the centre") would push
 * far-out units further than near ones, so a wide floor would fly apart while a
 * narrow one barely opened. Normalising gives every unit the same displacement,
 * which reads as *the same operation applied to each property* — which is what
 * it is.
 *
 * No React, no Three.js. Everything here is arithmetic on plain numbers and can
 * be executed and checked in bare Node — see `explodedSelfCheck.ts`.
 */

/** Which level of separation the viewer is showing. */
export type ExplodeMode = 'none' | 'floors' | 'units'

/**
 * How far apart consecutive floors are pushed at full explosion, in metres.
 *
 * Chosen against the floor height rather than in the abstract: at 3.2 m against
 * a 3 m floor, the gap between two floors is slightly larger than a floor
 * itself, so each stratum reads as clearly separate while the stack still reads
 * as one building. Much less and the floors look merely loose; much more and the
 * top floor leaves the frame and the camera presets stop framing anything.
 */
export const EXPLODED_FLOOR_GAP_M = 3.2

/**
 * How far each unit is pushed out from its floor's centre, in metres.
 *
 * A displacement, not a gap: because the direction is normalised, every unit
 * moves exactly this far. For the demo's 9 × 7 m units that opens roughly a
 * five-metre channel between opposite properties — wide enough that the four
 * volumes are unmistakably four, narrow enough that they still read as one
 * floor's worth of accommodation rather than four unrelated boxes.
 */
export const EXPLODED_UNIT_DISTANCE_M = 4

/** How long the floors take to separate or restack, in milliseconds. */
export const EXPLODE_FLOOR_DURATION_MS = 620

/**
 * How long the units take to separate or regroup, in milliseconds.
 *
 * Deliberately a little longer than the floor ramp. Going from stacked straight
 * to fully exploded runs both at once, and the small difference means the floors
 * arrive fractionally first — so the eye reads "the building opened into layers,
 * and the layers opened into properties" rather than one undifferentiated
 * scatter. It costs one constant and no sequencing logic.
 */
export const EXPLODE_UNIT_DURATION_MS = 760

/**
 * How far along each of the two separations is, `0`–`1`.
 *
 * Two independent numbers rather than one mode, because both are animated and
 * during a transition they genuinely differ. The mode is what the user chose;
 * this is where the animation has got to.
 */
export interface ExplodeAmounts {
  /** Vertical separation between floors. */
  readonly floors: number
  /** Horizontal separation of units within their floor. */
  readonly units: number
}

/** Nothing separated. The resting state, and the identity of the transform. */
export const NO_EXPLOSION: ExplodeAmounts = { floors: 0, units: 0 }

/** A point on the ground plane, in metres. Three.js axes: X east, Z north. */
export interface PlanPoint {
  readonly x: number
  readonly z: number
}

/**
 * The horizontal extent of something, in metres.
 *
 * Declared structurally rather than importing `ApartmentUnit`, so this module
 * stays independent of the cadastral model and can be exercised with plain
 * object literals. An `ApartmentUnit` satisfies it without being mentioned.
 */
export interface HorizontalExtent {
  readonly xMin: number
  readonly xMax: number
  readonly zMin: number
  readonly zMax: number
}

/** The plan centre of one extent. */
function extentCentre(extent: HorizontalExtent): PlanPoint {
  return {
    x: (extent.xMin + extent.xMax) / 2,
    z: (extent.zMin + extent.zMax) / 2,
  }
}

/**
 * The plan centre of a group of extents — the centre of their bounding box.
 *
 * The bounding box rather than the mean of the centres, because a floor whose
 * units are unevenly sized should explode about the middle of the *floor*, not
 * about wherever the small units happen to pull the average. For the prototype's
 * uniform grid the two agree exactly.
 *
 * Returns the origin for an empty group, which is meaningless but harmless: the
 * only caller that could produce one is a floor with no units, which then has
 * nothing to displace.
 */
export function getPlanCentre(extents: readonly HorizontalExtent[]): PlanPoint {
  if (extents.length === 0) return { x: 0, z: 0 }

  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let zMin = Number.POSITIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY

  for (const extent of extents) {
    if (extent.xMin < xMin) xMin = extent.xMin
    if (extent.xMax > xMax) xMax = extent.xMax
    if (extent.zMin < zMin) zMin = extent.zMin
    if (extent.zMax > zMax) zMax = extent.zMax
  }

  return { x: (xMin + xMax) / 2, z: (zMin + zMax) / 2 }
}

/**
 * The plan centre of every floor, keyed by 1-based floor level.
 *
 * Computed once from the units themselves rather than taken from the footprint,
 * so a unit explodes away from *the middle of the floor it is on* even if some
 * floor is laid out differently from the others. Generic over anything that
 * carries a horizontal extent and a floor level, again to avoid importing the
 * cadastral model into a display module.
 */
export function buildFloorPlanCentres<
  T extends HorizontalExtent & { readonly floorLevel: number },
>(items: readonly T[]): Map<number, PlanPoint> {
  const byFloor = new Map<number, T[]>()

  for (const item of items) {
    const existing = byFloor.get(item.floorLevel)
    if (existing === undefined) {
      byFloor.set(item.floorLevel, [item])
    } else {
      existing.push(item)
    }
  }

  const centres = new Map<number, PlanPoint>()
  for (const [floorLevel, floorItems] of byFloor) {
    centres.set(floorLevel, getPlanCentre(floorItems))
  }
  return centres
}

/**
 * The upward display offset for one floor, in metres.
 *
 *   offset = floorIndex × gap × amount
 *
 * The ground floor (`floorIndex` 0) never moves — the building separates upward
 * from its own base, so it stays standing on the footprint that generated it
 * rather than drifting off the plot as a whole.
 *
 * @param floorIndex 0-based index in the stack. Derive it from `floorLevel - 1`;
 *   a unit's `floorLevel` is 1-based.
 * @param amount `0` (stacked) to `1` (fully separated). Intermediate values come
 *   from the eased ramp, so the same function drives every frame of the
 *   transition as well as both resting states.
 */
export function getExplodedOffsetM(floorIndex: number, amount: number): number {
  return floorIndex * EXPLODED_FLOOR_GAP_M * amount
}

/**
 * The outward display offset for one unit within its floor, in metres.
 *
 * The direction is derived from the unit's position on its floor and then
 * normalised — see the note at the top of this file. A unit sitting exactly on
 * its floor's centre has no direction and does not move; that is the correct
 * answer, not a special case being papered over.
 *
 * @param unitExtent the unit's horizontal bounds. Read, never written.
 * @param floorCentre the plan centre of the floor the unit is on.
 * @param amount `0` (grouped) to `1` (fully separated).
 */
export function getUnitPlanOffsetM(
  unitExtent: HorizontalExtent,
  floorCentre: PlanPoint,
  amount: number,
): PlanPoint {
  const centre = extentCentre(unitExtent)

  const directionX = centre.x - floorCentre.x
  const directionZ = centre.z - floorCentre.z
  const length = Math.hypot(directionX, directionZ)

  // A unit centred on its floor's centre: no outward direction exists, so there
  // is nothing to move it along. Returning zero also keeps the function total —
  // no division by zero, no NaN leaking into a mesh position.
  if (length === 0) return { x: 0, z: 0 }

  const distance = EXPLODED_UNIT_DISTANCE_M * amount

  return {
    x: (directionX / length) * distance,
    z: (directionZ / length) * distance,
  }
}

/**
 * **The single display offset for one property unit.** Metres, `[x, y, z]`.
 *
 * Both separations, combined, in one place. Four things need this exact
 * value — the unit's mesh, its selection cage, its label, and the camera preset
 * that frames it — and they must agree to the millimetre or the highlight floats
 * away from the box it highlights. One function called four times is the only
 * arrangement in which they cannot disagree.
 *
 * @param unit anything carrying a horizontal extent and a 1-based floor level.
 * @param floorCentre the plan centre of that unit's floor.
 */
export function getUnitDisplayOffsetM(
  unit: HorizontalExtent & { readonly floorLevel: number },
  floorCentre: PlanPoint,
  amounts: ExplodeAmounts,
): [number, number, number] {
  const plan = getUnitPlanOffsetM(unit, floorCentre, amounts.units)
  return [plan.x, getExplodedOffsetM(unit.floorLevel - 1, amounts.floors), plan.z]
}

/**
 * The display offset for one floor plate. Metres, `[x, y, z]`.
 *
 * Plates only separate vertically: a floor plate *is* the floor, so there is
 * nothing on it to move apart. Keeping it as a function that returns a full
 * triple — rather than a bare number — means the plates and the units are placed
 * by the same shaped call, and a future decision to shrink the plate as its
 * units disperse has an obvious home.
 */
export function getFloorDisplayOffsetM(
  floorIndex: number,
  amounts: ExplodeAmounts,
): [number, number, number] {
  return [0, getExplodedOffsetM(floorIndex, amounts.floors), 0]
}

/**
 * How tall the building *appears* at a given explosion amount, in metres.
 *
 * Used only by the camera presets, which have to frame what is on screen rather
 * than what the model says. It is one of the two places the transform is allowed
 * to influence something other than a mesh position, and it is still a display
 * question: "how much of the viewport does this need".
 */
export function getExplodedApparentHeightM(
  totalHeightM: number,
  floorCount: number,
  amount: number,
): number {
  return totalHeightM + getExplodedOffsetM(Math.max(0, floorCount - 1), amount)
}

/**
 * How much wider the building *appears* once its units disperse, in metres.
 *
 * The other framing helper. Every unit moves exactly `EXPLODED_UNIT_DISTANCE_M`,
 * so the plan grows by that much on each side — twice it in total.
 */
export function getExplodedApparentSpreadM(extentM: number, amount: number): number {
  return extentM + 2 * EXPLODED_UNIT_DISTANCE_M * amount
}

/**
 * Where the two ramps will have settled for a given mode.
 *
 * The amounts are animated, so at the instant a mode changes the live amounts
 * still describe the *previous* mode. A camera preset computed from them would
 * frame where the scene is leaving rather than where it is going — which is
 * exactly what a restore-from-conflict does, since it changes the explosion and
 * the camera in the same tick.
 *
 * So: the destination, derived from the mode rather than read from the ramps. It
 * is the same trick `App` already uses when it splices a new isolated floor into
 * the preset context before the state has committed.
 */
export function getSettledExplodeAmounts(mode: ExplodeMode): ExplodeAmounts {
  return {
    floors: mode === 'none' ? 0 : 1,
    units: mode === 'units' ? 1 : 0,
  }
}

/** The note shown wherever an explosion is active. Stated once, used everywhere. */
export const EXPLODED_VIEW_NOTE =
  'Visualization offset only — cadastral geometry unchanged'
