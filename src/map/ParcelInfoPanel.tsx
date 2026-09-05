import type { DemoParcel } from '../data/demoParcel'
import type { FootprintMetrics } from '../geometry/footprint'

/**
 * The parcel record, in words, beneath the map.
 *
 * The map answers "where"; this panel answers "which, and how big". It is the
 * ground-level counterpart of `ui/PropertyInspector` — same visual language,
 * same rule about where its values come from. Every figure below is read off
 * the `DemoParcel` the map itself is drawn from, so the panel and the polygons
 * cannot disagree: if the parcel outline is edited, the area shown here changes
 * with it, because the area is computed from that outline rather than typed
 * beside it.
 *
 * The `Parent parcel` row is the join between the two halves of the prototype.
 * The identical string appears in the property inspector for every one of the
 * twenty units, and both come from `DEMO_PARCEL_IDENTITY` — one constant, read
 * twice, never copied.
 */

/** An area in square metres, grouped for readability. */
function formatAreaSqM(value: number): string {
  return `${Math.round(value).toLocaleString('en-IN')} m²`
}

/**
 * A latitude/longitude pair with hemisphere letters rather than signs.
 *
 * `12.9352 deg N, 77.6245 deg E` is legible to a non-specialist in a way that
 * `12.9352, 77.6245` is not — and it removes any doubt about which number is
 * which, the mistake that puts Bengaluru polygons in the Indian Ocean. Four
 * decimal places is about 11 m of precision, which is honest for demo data;
 * more digits would imply a survey accuracy that does not exist here.
 */
function formatCoordinates(latitude: number, longitude: number): string {
  const northSouth = latitude >= 0 ? 'N' : 'S'
  const eastWest = longitude >= 0 ? 'E' : 'W'

  return `${Math.abs(latitude).toFixed(4)}° ${northSouth}, ${Math.abs(longitude).toFixed(4)}° ${eastWest}`
}

interface ParcelInfoPanelProps {
  /** The parcel being displayed on the map above. */
  parcel: DemoParcel
  /**
   * The building footprint, measured once by `App`.
   *
   * Passed in rather than measured here, so this panel, the building summary
   * and the 3D geometry all quote **one** measurement of one polygon. Before
   * Phase 8 the footprint's dimensions existed only as `config.width` and
   * `config.depth`, which this panel had no business reading; now they are a
   * property of the shape on the map, which is exactly what it should show.
   */
  footprintMetrics: FootprintMetrics
}

function ParcelInfoPanel({ parcel, footprintMetrics }: ParcelInfoPanelProps) {
  return (
    <section className="parcel-info" aria-label="Parcel information">
      <h2 className="summary-title">Cadastral Parcel</h2>

      <dl className="summary-list">
        <div className="summary-row">
          <dt>Parent parcel</dt>
          <dd className="mono">{parcel.parcelId}</dd>
        </div>
        <div className="summary-row">
          <dt>Location</dt>
          <dd>
            {parcel.city}, {parcel.state}
          </dd>
        </div>
        <div className="summary-row">
          <dt>Parcel area</dt>
          <dd>{formatAreaSqM(parcel.areaSqM)}</dd>
        </div>
        <div className="summary-row">
          <dt>Building footprint</dt>
          <dd>{formatAreaSqM(parcel.buildingFootprintAreaSqM)}</dd>
        </div>
        {/* The plan dimensions of the green polygon above — and the same two
            numbers the 3D building is generated from. */}
        <div className="summary-row">
          <dt>Footprint plan</dt>
          <dd>
            {footprintMetrics.widthM.toFixed(1)} &times;{' '}
            {footprintMetrics.depthM.toFixed(1)} m
          </dd>
        </div>
        <div className="summary-row">
          <dt>Coordinates</dt>
          <dd className="mono">
            {formatCoordinates(parcel.latitude, parcel.longitude)}
          </dd>
        </div>
        <div className="summary-row">
          <dt>Data</dt>
          <dd>{parcel.dataNote}</dd>
        </div>
      </dl>

      {/* The disclaimer travels with the figures, exactly as the prototype
          encoding note travels with the identifier. */}
      <p className="parcel-info-note" role="note">
        Boundary and footprint are local demo geometry. No cadastral API is
        called; the basemap tiles are OpenStreetMap, the parcel data is not.
        The footprint polygon shown here is the geometry the 3D model is
        generated from.
      </p>
    </section>
  )
}

export default ParcelInfoPanel
