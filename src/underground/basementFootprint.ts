/**
 * **The canonical underground footprint — the excavation's own plan.**
 *
 * WHY THIS RING EXISTS AT ALL
 * Until this redesign the basement had no plan of its own: it was cut from
 * `DEMO_BUILDING_FOOTPRINT`, the tower's ring, and the claim being made was
 * "the excavation lies under the building's own plan". That is a real cadastral
 * arrangement, but it is the *narrow* one, and it is the one a 2D register can
 * already express by projection — if the basement and the tower share a
 * polygon, the plan view answers every question about the basement's extent.
 *
 * A parking deck almost never shares the tower's plan. It is dug wider, out to
 * the setback line, because a ramp and two rows of bays do not fit inside a
 * residential core. That is the interesting case for a 3D cadastre, and it is
 * the one this module makes possible: **the subsurface property is larger in
 * plan than the surface property standing on it**, and the two are separately
 * described, separately measured, and separately validated — while remaining
 * subdivisions of one parcel.
 *
 *   Parent parcel  KA-BLR-0482-001928        ~1 547 m2
 *   ├── Above-ground building footprint       18 x 14 m,  252 m2
 *   └── Underground basement footprint        22 x 18 m,  396 m2   <- this file
 *       ├── B1 parking deck   -3 -> 0 m
 *       └── B2 parking deck   -6 -> -3 m
 *
 * WHY IT IS AUTHORED HERE AND NOT DERIVED FROM THE TOWER
 * Deriving it — "the building ring, grown by a two-metre margin" — would make
 * the excavation a *function of* the tower, so a re-detection of the roof would
 * silently move the sanctioned excavation, and the two rings could never
 * disagree even when the real records do. An excavation is granted by its own
 * permission over its own boundary; it is source data, not a computation. So it
 * is authored, in the same survey axes and against the same parcel origin as
 * `DEMO_PARCEL_OUTLINE_M` and `DEMO_BUILDING_FOOTPRINT_M`, and the validator
 * *checks* the relationships (inside the parcel; not interpenetrating the
 * tower's volumes) rather than assuming them by construction.
 *
 * DEMO DATA NOTICE. Like every coordinate in `data/demoParcel.ts`, these four
 * corners are invented for the SIH demonstration. No surveyed excavation
 * boundary, no sanction, no authority.
 *
 * No React and no Three.js: plain data and plain arithmetic, runnable under
 * bare Node, exactly like the modules either side of it.
 */

import {
  footprintFromEastNorth,
  getFootprintAreaSqM,
  getFootprintMetrics,
  type BuildingFootprint,
  type FootprintMetrics,
} from '../geometry/footprint'
import { polygonAreaSqM, type LocalPointM } from '../data/demoParcel'

/**
 * The excavation boundary, as local metre offsets from the parcel origin.
 *
 * Centred on the same `(0, 0)` the parcel reference point and the building
 * footprint use, so `-11 -> +11` east and `-9 -> +9` north is a **22 m x 18 m**
 * plan enclosing **396 m2** — against the tower's 18 x 14 and 252 m2. The
 * excavation therefore oversails the tower by 2 m on every side, which is what
 * makes it visibly broader than the building in the 3D view rather than a
 * difference only a panel could report.
 *
 * It sits comfortably inside the parcel: the plot runs roughly -23 -> +24 east
 * and -17 -> +18 north, so the nearest boundary is more than seven metres away
 * on every side. That is checked, not asserted — see `checkBasementPlan` in
 * `validation/undergroundRules.ts`.
 *
 * Authored in `eastM` / `northM` because this is the *survey* form, the form a
 * person can read off a plan and correct. `footprintFromEastNorth` converts it
 * once, below.
 */
export const DEMO_BASEMENT_OUTLINE_M: readonly LocalPointM[] = [
  { eastM: -11, northM: -9 },
  { eastM: 11, northM: -9 },
  { eastM: 11, northM: 9 },
  { eastM: -11, northM: 9 },
]

/**
 * The same ring in Three.js axes — the form the 3D pipeline consumes.
 *
 * East -> X, North -> Z, by the one conversion function the building footprint
 * also goes through, so the two rings the validator compares are guaranteed to
 * be on the same axes rather than merely believed to be.
 */
export const DEMO_BASEMENT_FOOTPRINT: BuildingFootprint = footprintFromEastNorth(
  DEMO_BASEMENT_OUTLINE_M,
)

/**
 * Everything measurable about the excavation's plan, computed once.
 *
 * The area is the polygon's **true** area, not `width x depth` — the same
 * treatment the building footprint gets. For this rectangle they agree at
 * 396 m2; for an L-shaped excavation they would not, and a panel printing the
 * product would be quietly wrong.
 */
export const DEMO_BASEMENT_FOOTPRINT_METRICS: FootprintMetrics =
  getFootprintMetrics(DEMO_BASEMENT_FOOTPRINT)

/** The excavation's plan area in square metres, from the ring itself. */
export function getBasementFootprintAreaSqM(
  footprint: BuildingFootprint = DEMO_BASEMENT_FOOTPRINT,
): number {
  return getFootprintAreaSqM(footprint)
}

/**
 * The same area computed from the survey ring, for review against a plan.
 *
 * Deliberately a second route to one number rather than a second number: it
 * exists so the survey outline and the converted footprint can be shown to
 * agree, which is the check that would catch an axis flip in the conversion.
 */
export function getBasementOutlineAreaSqM(
  outline: readonly LocalPointM[] = DEMO_BASEMENT_OUTLINE_M,
): number {
  return polygonAreaSqM(outline)
}
