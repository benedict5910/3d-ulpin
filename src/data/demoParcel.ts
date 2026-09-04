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
 *      18 x 14 m footprint is literally reused rather than re-measured.
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

import { DEFAULT_BUILDING_CONFIG, type BuildingConfig } from '../scene/buildingConfig'
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
 * The shoelace formula: sum the cross products of consecutive vertices, halve,
 * take the magnitude. `Math.abs` makes it indifferent to winding order, so a
 * boundary authored clockwise and one authored anticlockwise report the same
 * area rather than the same number with opposite signs.
 *
 * The ring is treated as implicitly closed — the last vertex is joined back to
 * the first — which is why no polygon in this file repeats its opening point.
 */
export function polygonAreaSqM(points: readonly LocalPointM[]): number {
  if (points.length < 3) {
    return 0
  }

  let doubleArea = 0

  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    const next = points[(index + 1) % points.length]

    doubleArea += current.eastM * next.northM - next.eastM * current.northM
  }

  return Math.abs(doubleArea) / 2
}

/**
 * The parcel's reference point: a demo location in Bengaluru, Karnataka.
 *
 * This single position anchors everything else in the file, and it is also the
 * point the 3D scene's origin corresponds to — the building in the 3D viewer is
 * centred on `(0, 0)` in Three.js, and `(0, 0)` here is this latitude and
 * longitude. That correspondence is the seam a later 2D-to-3D phase will use.
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
 * The building footprint, derived from the 3D building's own configuration.
 *
 * This is the point of the whole module. The rectangle drawn on the map is not
 * a hand-typed copy of "18 by 14" — it is computed from
 * `DEFAULT_BUILDING_CONFIG.width` and `.depth`, the same two numbers the 3D
 * floors and units are generated from. Change the building's width in the
 * config and the map's footprint changes with it, because there is only one
 * width in the project.
 *
 * The footprint is centred on the parcel origin, matching the 3D scene, where
 * the building straddles the origin from `-width/2` to `+width/2`. Three.js
 * `X` maps to east, and Three.js `Z` maps to **south** — Z grows towards the
 * camera in a default right-handed view, i.e. towards the viewer, which on a
 * north-up map is downwards. Hence `northM = -z`.
 */
export function buildFootprintOutlineM(config: BuildingConfig): LocalPointM[] {
  const halfWidth = config.width / 2
  const halfDepth = config.depth / 2

  return [
    { eastM: -halfWidth, northM: -halfDepth },
    { eastM: halfWidth, northM: -halfDepth },
    { eastM: halfWidth, northM: halfDepth },
    { eastM: -halfWidth, northM: halfDepth },
  ]
}

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
  /** The building footprint ring, implicitly closed. */
  readonly buildingFootprint: readonly GeoPoint[]
  /** Parcel area in square metres, computed from the boundary. */
  readonly areaSqM: number
  /** Footprint area in square metres, computed from the footprint. */
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
  config: BuildingConfig = DEFAULT_BUILDING_CONFIG,
  origin: GeoPoint = DEMO_PARCEL_ORIGIN,
): DemoParcel {
  const footprintOutlineM = buildFootprintOutlineM(config)

  return {
    parcelId: formatParentParcelId(identity),
    identity,
    state: 'Karnataka',
    city: 'Bengaluru',
    latitude: origin[0],
    longitude: origin[1],
    centre: [origin[0], origin[1]],
    boundary: DEMO_PARCEL_OUTLINE_M.map((point) => localPointToGeoPoint(point, origin)),
    buildingFootprint: footprintOutlineM.map((point) => localPointToGeoPoint(point, origin)),
    areaSqM: polygonAreaSqM(DEMO_PARCEL_OUTLINE_M),
    buildingFootprintAreaSqM: polygonAreaSqM(footprintOutlineM),
    isDemoData: true,
    dataNote: DEMO_PARCEL_DATA_NOTE,
  }
}

/**
 * The one parcel the prototype shows — `KA-BLR-0482-001928`.
 *
 * Built once at module load from the shared identity and the shared building
 * config. Parcel area works out at 1 547 m2; the footprint at 252 m2, which is
 * 18 x 14 exactly, because it *is* the 3D building's footprint.
 */
export const DEMO_PARCEL: DemoParcel = buildDemoParcel()
