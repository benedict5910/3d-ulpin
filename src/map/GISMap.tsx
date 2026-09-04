import { useEffect } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'

import type { DemoParcel, GeoPoint } from '../data/demoParcel'
import MapLegend from './MapLegend'
import {
  BUILDING_FOOTPRINT_STYLE,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  OSM_ATTRIBUTION,
  OSM_MAX_NATIVE_ZOOM,
  OSM_TILE_URL,
  PARCEL_BOUNDARY_STYLE,
  PARCEL_CENTRE_RADIUS_PX,
  PARCEL_CENTRE_STYLE,
} from './parcelStyles'

/**
 * The 2D GIS view: the parent cadastral parcel, and the building on it.
 *
 * This is the horizontal half of "3D ULPIN". The Three.js viewer answers
 * *what is inside the building and at what height*; this map answers *where on
 * the ground the building's parent parcel is, and how much of that parcel the
 * building covers*. Neither question is answerable from the other view, which
 * is why the prototype needs both.
 *
 * THREE THINGS ARE DRAWN, AND THEY ARE NOT THE SAME KIND OF THING
 *
 *   1. **The basemap** — raster tiles fetched from OpenStreetMap. Context only:
 *      roads, blocks, a sense of place. It is *not* our data, it carries no
 *      cadastral authority, and replacing it with a different provider, an
 *      offline tile set, or nothing at all would leave items 2 and 3 exactly
 *      as they are.
 *   2. **The parcel polygon** — the demo cadastral boundary, from local typed
 *      data in `data/demoParcel.ts`. Never fetched.
 *   3. **The building footprint** — the outline of the building the 3D viewer
 *      is showing, derived from the same `BuildingConfig` the 3D geometry is
 *      generated from. Never fetched either.
 *
 * WHAT THIS COMPONENT DOES NOT DO
 * It does not own the parcel. `App` passes one in, exactly as it passes the
 * unit array to the 3D scene, so the map and the inspector are demonstrably
 * reading one record rather than two similar ones.
 */

/**
 * Copy a readonly ring into the mutable array Leaflet's typings ask for.
 *
 * The data layer marks its rings `readonly` on purpose — nothing should be able
 * to edit the cadastral geometry in place. Leaflet's `positions` prop is typed
 * as a plain mutable array, so the conversion has to happen somewhere; doing it
 * here, in one named function at the boundary, is better than weakening the
 * data model or scattering casts through the JSX. The copy is shallow and
 * per-render, which is free at four vertices.
 */
function toPositions(ring: readonly GeoPoint[]): GeoPoint[] {
  return ring.map(([latitude, longitude]) => [latitude, longitude])
}

/**
 * Keep Leaflet's idea of the container size in step with the real one.
 *
 * Leaflet measures its container **once**, at initialisation, and caches the
 * result; it has no way to notice that a CSS grid column later got wider. When
 * that cache is stale the symptoms are the classic ones: grey wedges where
 * tiles should be, and clicks landing a few pixels from where they were made.
 *
 * A `ResizeObserver` on the container turns that into a non-issue — any size
 * change, from any cause, triggers `invalidateSize()`. This is a child of
 * `MapContainer` rather than a prop on it because `useMap()` only works inside
 * the map's context. It renders nothing.
 */
function MapAutoSize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [map])

  return null
}

interface GISMapProps {
  /** The parcel to draw. Supplied by `App`; never fetched or invented here. */
  parcel: DemoParcel
}

function GISMap({ parcel }: GISMapProps) {
  return (
    // The wrapper carries the height. Leaflet cannot size itself from its
    // content the way a div can — it needs a container with real pixels, and a
    // container of zero height renders a zero-height map with no error. See
    // `.gis-map` in index.css, which gives it both a grid row and a floor.
    <div className="gis-map">
      <MapContainer
        className="gis-map-canvas"
        center={parcel.centre}
        zoom={MAP_DEFAULT_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        // A tiny plot in a narrow column: scroll-wheel zoom would fight the
        // page and surprise anyone scrolling past it. Buttons and double-click
        // still zoom, dragging still pans.
        scrollWheelZoom={false}
        attributionControl
      >
        <MapAutoSize />

        {/* Layer 1 — borrowed context. Everything below this line is ours. */}
        <TileLayer
          url={OSM_TILE_URL}
          attribution={OSM_ATTRIBUTION}
          maxNativeZoom={OSM_MAX_NATIVE_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
        />

        {/* Layer 2 — the cadastral parcel. Drawn first so the building sits
            visually on top of the land it stands on, which is also the real
            relationship between the two. */}
        <Polygon positions={toPositions(parcel.boundary)} pathOptions={PARCEL_BOUNDARY_STYLE}>
          <Tooltip sticky>
            <strong>Cadastral parcel</strong>
            <br />
            {parcel.parcelId}
          </Tooltip>
        </Polygon>

        {/* Layer 3 — the building footprint: the ground-floor outline of the
            same building the 3D viewer is showing. */}
        <Polygon
          positions={toPositions(parcel.buildingFootprint)}
          pathOptions={BUILDING_FOOTPRINT_STYLE}
        >
          <Tooltip sticky>
            <strong>Building footprint</strong>
            <br />
            {parcel.buildingFootprintAreaSqM.toFixed(0)} m&sup2;
          </Tooltip>
        </Polygon>

        {/* The reference point. A `CircleMarker`, not a `Marker`: Leaflet's
            default marker is a PNG referenced by a relative URL, which breaks
            under a bundler unless the icon paths are patched by hand. A circle
            is a vector — no asset, no patch, and it scales cleanly. */}
        <CircleMarker
          center={parcel.centre}
          radius={PARCEL_CENTRE_RADIUS_PX}
          pathOptions={PARCEL_CENTRE_STYLE}
        >
          <Tooltip>Parcel reference point</Tooltip>
        </CircleMarker>
      </MapContainer>

      {/* HTML over the map, not a Leaflet control — the same relationship the
          building summary has to the 3D canvas. */}
      <MapLegend />
    </div>
  )
}

export default GISMap
