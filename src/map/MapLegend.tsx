import {
  BUILDING_FOOTPRINT_STYLE,
  PARCEL_BOUNDARY_STYLE,
  type ParcelLayerStyle,
} from './parcelStyles'

/**
 * The map legend: which line means what.
 *
 * Two entries, because the map draws two cadastral things and a viewer has no
 * way to guess which is which. A dashed blue ring and a solid green rectangle
 * are only self-explanatory to someone who already knows the answer.
 *
 * The swatches are **not** styled in CSS. Each takes its colour, thickness and
 * dash pattern from the very same constant the corresponding polygon is drawn
 * with, so the legend cannot describe a style the map has stopped using. That
 * is the whole reason `parcelStyles.ts` exists as a separate module.
 *
 * The basemap is deliberately absent from the legend. It is context, not a
 * cadastral layer, and its provenance is already stated in the attribution
 * control in the corner of the map.
 */

/** Render one style as a short line of the right colour, weight and pattern. */
function LegendSwatch({ style }: { style: ParcelLayerStyle }) {
  return (
    <span
      className="map-legend-swatch"
      aria-hidden="true"
      style={{
        borderTopColor: style.color,
        borderTopWidth: `${style.weight}px`,
        // The one thing the swatch abstracts: Leaflet's `dashArray` is an SVG
        // dash pattern and CSS has no equivalent, so a dashed stroke is shown
        // as CSS `dashed`. The distinction the legend has to carry is
        // "dashed vs solid", and that survives the translation intact.
        borderTopStyle: style.dashArray ? 'dashed' : 'solid',
      }}
    />
  )
}

interface LegendItem {
  readonly label: string
  readonly style: ParcelLayerStyle
}

const LEGEND_ITEMS: readonly LegendItem[] = [
  { label: 'Cadastral Parcel', style: PARCEL_BOUNDARY_STYLE },
  { label: 'Building Footprint', style: BUILDING_FOOTPRINT_STYLE },
]

function MapLegend() {
  return (
    <div className="map-legend" role="note" aria-label="Map legend">
      {LEGEND_ITEMS.map((item) => (
        <span className="map-legend-item" key={item.label}>
          <LegendSwatch style={item.style} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export default MapLegend
