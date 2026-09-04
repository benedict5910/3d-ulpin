/**
 * How the two cadastral layers are drawn — and the single place that decides.
 *
 * The map draws the parcel and the footprint; the legend explains what those
 * two lines mean. If each held its own colour, a restyle would silently make
 * the legend lie — a legend that disagrees with the map is worse than no legend
 * at all. So both read from here, and a swatch cannot drift from the shape it
 * describes.
 *
 * The shapes are `Path` options in Leaflet's vocabulary (`color`, `weight`,
 * `dashArray`, `fillOpacity`), which react-leaflet passes straight through as
 * props. Typed structurally rather than as Leaflet's `PathOptions` so this
 * module stays free of the mapping library, in keeping with the rest of the
 * data-side code.
 */

/** The subset of Leaflet path options these two layers actually set. */
export interface ParcelLayerStyle {
  /** Stroke colour. */
  readonly color: string
  /** Stroke width in pixels. */
  readonly weight: number
  /** SVG dash pattern, or `undefined` for a solid line. */
  readonly dashArray?: string
  /** Fill colour. Kept explicit rather than inheriting from `color`. */
  readonly fillColor: string
  /** Fill alpha, 0-1. */
  readonly fillOpacity: number
}

/**
 * The cadastral parcel boundary — a cool slate-blue, dashed, barely filled.
 *
 * Dashed because a cadastral boundary is a *legal* line, not a physical one:
 * there is usually nothing on the ground at that position. The near-transparent
 * fill exists only to make the plot clickable and to separate it from the
 * basemap; it must never compete with the building for attention.
 */
export const PARCEL_BOUNDARY_STYLE: ParcelLayerStyle = {
  color: '#7d9dc0',
  weight: 2,
  dashArray: '6 5',
  fillColor: '#7d9dc0',
  fillOpacity: 0.06,
}

/**
 * The building footprint — the project's accent green, solid, filled.
 *
 * Solid because a footprint *is* a physical thing: walls stand on that line.
 * The colour is the same accent the status indicator and the ULPIN block use,
 * which reads as "this is the object the application is about" — and it is the
 * one shape on this map that the 3D viewer also draws.
 */
export const BUILDING_FOOTPRINT_STYLE: ParcelLayerStyle = {
  color: '#4ade80',
  weight: 2,
  fillColor: '#4ade80',
  fillOpacity: 0.2,
}

/** The parcel reference point — small, neutral, deliberately unobtrusive. */
export const PARCEL_CENTRE_STYLE: ParcelLayerStyle = {
  color: '#e8eef5',
  weight: 1.5,
  fillColor: '#e8eef5',
  fillOpacity: 0.9,
}

/** Radius in pixels of the reference-point marker. */
export const PARCEL_CENTRE_RADIUS_PX = 4

/**
 * The basemap tile source.
 *
 * OpenStreetMap's standard raster tiles: no API key, no account, and usable
 * under the ODbL provided the attribution below is displayed. It is the only
 * part of this map that is fetched from the network, and it carries **none** of
 * our cadastral data — see `OSM_ATTRIBUTION` and the architecture notes.
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Required attribution for the tiles above. Not optional, legally or ethically. */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * The highest zoom OpenStreetMap actually renders tiles for.
 *
 * Beyond this the map keeps zooming and Leaflet upscales the last real tile,
 * which is the right trade for a plot this small: the basemap goes soft, but
 * the parcel and footprint are vectors and stay crisp at any zoom.
 */
export const OSM_MAX_NATIVE_ZOOM = 19

/** How far the user may zoom in, tiles upscaled past `OSM_MAX_NATIVE_ZOOM`. */
export const MAP_MAX_ZOOM = 21

/**
 * The zoom the map opens at.
 *
 * At ~12.94 deg N one pixel is about 0.29 m at zoom 19, so the 46 m parcel
 * spans roughly 160 px — comfortably framed in the map column without needing
 * a fit-to-bounds pass that would change with the panel's width.
 */
export const MAP_DEFAULT_ZOOM = 19
