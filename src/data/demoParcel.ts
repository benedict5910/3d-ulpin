/**
 * The demo cadastral parcel: where the prototype building actually stands.
 *
 * DEMO DATA NOTICE — read this before reusing anything here.
 * Every coordinate in this file is **invented for the SIH demonstration**. The
 * parcel is a plausible-looking Bengaluru plot at a plausible-looking location;
 * it corresponds to no surveyed boundary, no real ownership, and no record held
 * by any authority. Nothing here came from a cadastral API, and no phase of this
 * prototype fetches one. `DEMO_PARCEL_DATA_NOTE` is rendered wherever these
 * figures are shown so the label travels with the numbers.
 *
 * WHY THIS MODULE IS SEPARATE FROM `ulpin/parcelIdentity.ts`
 * The identity says **which** parcel — four administrative codes that join into
 * `KA-BLR-0482-001928`. This file says **where** that parcel is — a reference
 * latitude/longitude and two rings of coordinates. They are different kinds of
 * fact with different lifetimes: a re-survey moves the geometry without touching
 * the identity, and a re-numbering changes the identity without moving one
 * metre of ground. Keeping them apart is also what makes the "one parcel"
 * claim checkable rather than asserted: this module does not *repeat* the
 * identity, it **imports** it, so the map's label and the inspector's
 * `Parent parcel` row are the same four strings by construction.
 *
 * WHY THE GEOMETRY IS AUTHORED IN METRES, NOT IN DEGREES
 * The polygons below are written as **local offsets in metres** from a single
 * origin point, and converted to latitude/longitude by one function at the
 * bottom. Three reasons, all of which matter later:
 *
 *   1. The project's whole-model convention is **1 unit = 1 metre** (see
 *      `scene/buildingConfig.ts`). Authoring in metres means the 2D footprint
 *      and the 3D building are stated in the *same* units, so the building's
 *      18 x 14 m footprint is literally reused rather than re-measured. As of
 *      Phase 8 that reuse is the mechanism, not a nicety: `DEMO_BUILDING_
 *      FOOTPRINT_M` below is the geometry the 3D building is extruded from,
 *      and lat/lng never enters the 3D pipeline at all.
 *   2. Area is exact. Shoelace over metres gives a true square-metre figure;
 *      shoelace over raw degrees gives a number in degrees-squared that has to
 *      be re-projected, and re-projected badly at any latitude but the equator.
 *   3. A person can read and correct them. `{ eastM: -23, northM: -17 }` is a
 *      corner 23 m west and 17 m south of the plot's reference point. The
 *      equivalent decimal degrees, `12.93505, 77.62429`, is unreviewable.
 *
 * This module holds no React and no Leaflet. It is data plus arithmetic, so it
 * can be executed in plain Node, and so replacing Leaflet later would not touch
 * a single line of it.
 */

import {
  footprintFromEastNorth,
  getFootprintAreaSqM,
  type BuildingFootprint,
} from '../geometry/footprint'
import {
  DEMO_PARCEL_IDENTITY,
  formatParentParcelId,
  type ParcelIdentity,
} from '../ulpin/parcelIdentity'

/**
 * One geographic position, `[latitude, longitude]`, in decimal degrees.
 *
 * Latitude first. That is the order Leaflet uses, the order GeoJSON does *not*
 * use, and the single most common source of "my polygon is in the Indian Ocean"
 * bugs — so the tuple is labelled, and every function here says which it means.
 */
export type GeoPoint = [latitude: number, longitude: number]

/**
 * One position on the ground, in metres from the parcel's reference point.
 *
 * `eastM` grows to the east, `northM` grows to the north — the ordinary survey
 * convention. These are the numbers a human authors and reviews; `GeoPoint` is
 * what the map consumes.
 */
export interface LocalPointM {
  /** Metres east of the parcel reference point. Negative is west. */
  readonly eastM: number
  /** Metres north of the parcel reference point. Negative is south. */
  readonly northM: number
}

/**
 * Metres per degree of latitude.
 *
 * Effectively constant everywhere on Earth (the meridian is very nearly a
 * circle), so one number is honest at this scale. 111 320 m is the standard
 * spherical figure; over a 40 m plot the error against a true ellipsoid is far
 * below a millimetre, which is several orders of magnitude finer than anything
 * this prototype claims.
 */
const METRES_PER_DEGREE_LATITUDE = 111_320

/**
 * Metres per degree of longitude **at a given latitude**.
 *
 * Meridians converge towards the poles, so a degree of longitude shrinks by
 * `cos(latitude)`. At Bengaluru's ~12.94 deg N that factor is about 0.9746 —
 * ignoring it would stretch every east-west measurement by roughly 2.6%, which
 * on an 18 m building is nearly half a metre of error in one direction only.
 * That is exactly the kind of quiet distortion that makes a footprint sit
 * visibly askew inside its parcel.
 */
function metresPerDegreeLongitude(latitudeDeg: number): number {
  return METRES_PER_DEGREE_LATITUDE * Math.cos((latitudeDeg * Math.PI) / 180)
}

/**
 * Convert a local metre offset into a geographic position.
 *
 * A deliberately small, local, flat-earth conversion — valid because the whole
 * parcel spans under fifty metres, where curvature is irrelevant. It is **not**
 * a general-purpose projection and should not be reused as one; a real system
 * would carry proper CRS handling (EPSG:4326 vs a local UTM zone) instead.
 */
export function localPointToGeoPoint(point: LocalPointM, origin: GeoPoint): GeoPoint {
  const [originLat, originLng] = origin

  const latitude = originLat + point.northM / METRES_PER_DEGREE_LATITUDE
  const longitude = originLng + point.eastM / metresPerDegreeLongitude(originLat)

  return [latitude, longitude]
}

/**
 * The area of a closed polygon given in local metres, in square metres.
 *
 * The shoelace formula, indifferent to winding order, over a ring that is
 * treated as implicitly closed — which is why no polygon in this file repeats
 * its opening point.
 *
 * PHASE 8: THE ARITHMETIC MOVED, THE FUNCTION STAYED.
 * The implementation now lives in `geometry/footprint.ts` and this is a thin
 * adapter onto it. Before, the same shoelace was written here in `eastM` /
 * `northM` and would have had to be written a *second* time in `x` / `z` for
 * the 3D side — two copies of one formula, which is exactly the kind of
 * duplication that produces a map and a model quietly disagreeing about an
 * area. One implementation, two coordinate namings, one answer.
 */
export function polygonAreaSqM(points: readonly LocalPointM[]): number {
  return getFootprintAreaSqM(footprintFromEastNorth(points))
}

/**
 * The parcel's reference point: a demo location in Bengaluru, Karnataka.
 *
 * This single position anchors everything else in the file, and it is also the
 * point the 3D scene's origin corresponds to — the building in the 3D viewer is
 * centred on `(0, 0)` in Three.js, and `(0, 0)` here is this latitude and
 * longitude. **That correspondence is the seam Phase 8 uses.** The 3D pipeline
 * consumes the metre ring and never sees a degree; this origin is the one place
 * the two coordinate systems are tied together, and tying them in exactly one
 * place is what makes the tie checkable.
 *
 * Invented for the demonstration. It names no real plot.
 */
export const DEMO_PARCEL_ORIGIN: GeoPoint = [12.9352, 77.6245]

/**
 * The cadastral parcel boundary, as local metre offsets.
 *
 * Four corners, deliberately **not** a perfect rectangle. Real plots are
 * irregular — they follow old field boundaries, road widenings and neighbours'
 * walls — and an exactly square demo parcel quietly teaches the wrong lesson
 * about what cadastral geometry looks like. Roughly 46 m east-west by 34 m
 * north-south; the exact area is computed below, never typed in.
 */
export const DEMO_PARCEL_OUTLINE_M: readonly LocalPointM[] = [
  { eastM: -23, northM: -17 },
  { eastM: 23, northM: -16 },
  { eastM: 24, northM: 17 },
  { eastM: -21, northM: 18 },
]

/**
 * **The building footprint. The authoritative horizontal geometry of the whole
 * project.**
 *
 * This is the constant Phase 8 is built around, so it is worth being precise
 * about what changed. In Phase 7 this ring was a *function of the 3D config* —
 * `buildFootprintOutlineM(config)` read `config.width` and `config.depth` and
 * built a rectangle from them. The map was therefore downstream of the 3D
 * model, and the model was generated from two scalars.
 *
 * The arrow now points the other way:
 *
 *     DEMO_BUILDING_FOOTPRINT_M   ← surveyed geometry, authored here
 *              │
 *              ├──► buildingFootprintMetric ──► 3D building, floors, units
 *              └──► buildingFootprint (lat/lng) ──► the Leaflet polygon
 *
 * `config.width` and `config.depth` no longer exist to read. The four corners
 * below are the only horizontal description of this building anywhere in the
 * codebase, and both views measure *them*.
 *
 * WHY THE NUMBERS LOOK LIKE THIS
 * The ring is centred on the parcel reference point — `(0, 0)` here is the same
 * physical spot as `(0, 0)` in the 3D scene — so the corners run from −9 to +9
 * east and −7 to +7 north. That is an 18 m × 14 m plan enclosing 252 m², the
 * dimensions the demo has had since Phase 3. **They are unchanged on purpose:**
 * Phase 8 is a change of architecture, not of geometry, and a demo whose
 * numbers moved would make it impossible to tell the two apart.
 *
 * Nothing about the *type* is rectangular. It is a ring, like the parcel
 * boundary above it, and replacing these four points with an eight-point L
 * would change the 3D building's plan with no edit to any renderer. What would
 * still need work is the internal 2 × 2 subdivision — see `scene/unitLayout.ts`,
 * which documents that limitation where it actually bites.
 *
 * Authored in `eastM` / `northM` rather than in Three.js `x` / `z` because this
 * is the *survey* form: it is what a person can read, check against a plan, and
 * correct. `footprintFromEastNorth` converts it, once, in one place.
 */
export const DEMO_BUILDING_FOOTPRINT_M: readonly LocalPointM[] = [
  { eastM: -9, northM: -7 },
  { eastM: 9, northM: -7 },
  { eastM: 9, northM: 7 },
  { eastM: -9, northM: 7 },
]

/**
 * The same footprint in Three.js axes — the form the 3D pipeline consumes.
 *
 * East → X, North → Z, per the convention fixed in `geometry/footprint.ts`.
 * Converted once, at module load, so every consumer shares one array rather
 * than each performing its own flip.
 */
export const DEMO_BUILDING_FOOTPRINT: BuildingFootprint = footprintFromEastNorth(
  DEMO_BUILDING_FOOTPRINT_M,
)

/** The wording shown wherever these figures appear. */
export const DEMO_PARCEL_DATA_NOTE = 'Demo / prototype dataset'

/**
 * A parcel as the map layer consumes it: identity, place, geometry, areas.
 *
 * Note what is *not* here: no ownership, no valuation, no survey number, no
 * encumbrance. Those are the fields a real cadastre carries and this prototype
 * deliberately does not invent.
 */
export interface DemoParcel {
  /** The joined parent parcel identifier, e.g. `KA-BLR-0482-001928`. */
  readonly parcelId: string
  /** The four administrative codes the identifier is built from. */
  readonly identity: ParcelIdentity
  /** State name, spelled for display. */
  readonly state: string
  /** City name, spelled for display. */
  readonly city: string
  /** Reference latitude in decimal degrees (positive = north). */
  readonly latitude: number
  /** Reference longitude in decimal degrees (positive = east). */
  readonly longitude: number
  /** The reference point as a map-ready tuple. Same two numbers as above. */
  readonly centre: GeoPoint
  /** The cadastral boundary ring, implicitly closed. */
  readonly boundary: readonly GeoPoint[]
  /**
   * **The parcel boundary in local metres — the validation engine's input.**
   *
   * The same ring as `boundary`, before projection, on the same axes as
   * `buildingFootprintMetric`. Added in Subphase C so the topology engine can
   * ask "is the building inside its parcel" in the one coordinate system both
   * rings already share, rather than converting degrees back to metres at the
   * point of use — which would put a second, slightly different projection into
   * a module whose whole job is to be exact about geometry.
   */
  readonly parcelBoundaryMetric: BuildingFootprint
  /** The parcel ring in survey axes, as authored. Kept for display and review. */
  readonly parcelOutlineM: readonly LocalPointM[]
  /** The building footprint ring in geographic coordinates, for the map. */
  readonly buildingFootprint: readonly GeoPoint[]
  /**
   * **The building footprint in local metres — the 3D pipeline's input.**
   *
   * The same ring as `buildingFootprint`, before projection. This is the field
   * the 3D viewer reads: `x` / `z` metres, ready to become geometry. The map
   * reads the projected form above. One ring, two renderings, no second
   * description of the building.
   */
  readonly buildingFootprintMetric: BuildingFootprint
  /** The footprint ring in survey axes, as authored. Kept for display and review. */
  readonly buildingFootprintOutlineM: readonly LocalPointM[]
  /** Parcel area in square metres, computed from the boundary. */
  readonly areaSqM: number
  /** Footprint area in square metres, computed from the footprint polygon. */
  readonly buildingFootprintAreaSqM: number
  /** Always `true`. A type-level reminder that none of this is real. */
  readonly isDemoData: true
  /** The human-readable demo-data label, carried with the figures. */
  readonly dataNote: string
}

/**
 * Assemble the demo parcel.
 *
 * A function rather than a hand-written object literal, because six of the
 * fields are **derived** and deriving them is the guarantee: the geographic
 * rings come from the metre outlines, the areas come from those same outlines,
 * and `parcelId` comes from the shared identity. There is no second place where
 * an area or an identifier could be typed and then quietly fall out of step.
 */
export function buildDemoParcel(
  identity: ParcelIdentity = DEMO_PARCEL_IDENTITY,
  footprintOutlineM: readonly LocalPointM[] = DEMO_BUILDING_FOOTPRINT_M,
  origin: GeoPoint = DEMO_PARCEL_ORIGIN,
): DemoParcel {
  // Converted once. The 3D pipeline and the area figure below both read this
  // array, so "the map and the model share a footprint" is a fact about object
  // identity, not a claim about two calculations agreeing.
  const footprintMetric = footprintFromEastNorth(footprintOutlineM)

  return {
    parcelId: formatParentParcelId(identity),
    identity,
    state: 'Karnataka',
    city: 'Bengaluru',
    latitude: origin[0],
    longitude: origin[1],
    centre: [origin[0], origin[1]],
    boundary: DEMO_PARCEL_OUTLINE_M.map((point) => localPointToGeoPoint(point, origin)),
    // Converted by the same function as the footprint, so the two rings the
    // validator compares are guaranteed to be on the same axes.
    parcelBoundaryMetric: footprintFromEastNorth(DEMO_PARCEL_OUTLINE_M),
    parcelOutlineM: DEMO_PARCEL_OUTLINE_M,
    buildingFootprint: footprintOutlineM.map((point) => localPointToGeoPoint(point, origin)),
    buildingFootprintMetric: footprintMetric,
    buildingFootprintOutlineM: footprintOutlineM,
    areaSqM: polygonAreaSqM(DEMO_PARCEL_OUTLINE_M),
    buildingFootprintAreaSqM: getFootprintAreaSqM(footprintMetric),
    isDemoData: true,
    dataNote: DEMO_PARCEL_DATA_NOTE,
  }
}

/**
 * The one parcel the prototype shows — `KA-BLR-0482-001928`.
 *
 * Built once at module load from the shared identity and the authored
 * footprint. Parcel area works out at 1 547 m2; the footprint at 252 m2, which
 * is 18 x 14 exactly — and since Phase 8 that is not because it was *derived
 * from* the 3D building's dimensions, but because it **is** the geometry the
 * 3D building is generated from.
 */
export const DEMO_PARCEL: DemoParcel = buildDemoParcel()
