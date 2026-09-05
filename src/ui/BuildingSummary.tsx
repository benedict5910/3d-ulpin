import type { FootprintMetrics } from '../geometry/footprint'
import {
  getTotalHeight,
  getUnitsPerFloor,
  type BuildingConfig,
} from '../scene/buildingConfig'
import type { ApartmentUnit } from '../scene/unitLayout'

/**
 * A small read-out of the building and its property units, overlaid on the viewer.
 *
 * PHASE 8: WHERE THE FOOTPRINT ROW COMES FROM.
 * This panel used to print `config.width × config.depth`. Those fields no
 * longer exist. The footprint line is now read off a `FootprintMetrics` — the
 * polygon **measured**, by the same function the geometry itself is built
 * from — so the number in this panel and the shape in the 3D scene cannot
 * disagree without one of them being broken. The footprint *area* is the
 * polygon's true area, not `width × depth`, which for the demo rectangle are
 * the same 252 m² and for any other plan would not be.
 *
 * The per-unit figures are read off the **same generated `ApartmentUnit[]` the
 * scene renders** — nothing here is typed in by hand. If the config says eight
 * floors of six units, the scene shows 48 boxes and this panel says 48 units,
 * with no third place to keep in step.
 *
 * The panel also distinguishes the two Phase 8 states. Before generation the
 * building block is fully known — it is source data plus config — but there are
 * no property units yet, and saying "20 units" while none exist would be the
 * panel claiming the workflow had run.
 */

interface BuildingSummaryProps {
  /** The building's vertical description. */
  config: BuildingConfig
  /** The footprint, measured once by `App`. */
  footprintMetrics: FootprintMetrics
  /** The generated units, as rendered by the scene. */
  units: readonly ApartmentUnit[]
  /** Whether the 3D cadastre has been generated. */
  isGenerated: boolean
}

/** One length in metres, at panel precision. */
function metres(value: number): string {
  return value.toFixed(1)
}

function BuildingSummary({
  config,
  footprintMetrics,
  units,
  isGenerated,
}: BuildingSummaryProps) {
  const totalHeight = getTotalHeight(config)
  const unitsPerFloor = getUnitsPerFloor(config)
  // Every unit is identical under a uniform grid, so the first one is representative.
  const sampleUnit = units[0]

  return (
    <aside className="building-summary" aria-label="Building summary">
      <h2 className="summary-title">Footprint (source)</h2>
      <dl className="summary-list">
        <div className="summary-row">
          <dt>Plan</dt>
          <dd>
            {metres(footprintMetrics.widthM)} &times;{' '}
            {metres(footprintMetrics.depthM)} m
          </dd>
        </div>
        <div className="summary-row">
          <dt>Area</dt>
          <dd>{footprintMetrics.areaSqM.toFixed(0)} m&sup2;</dd>
        </div>
        <div className="summary-row">
          <dt>Vertices</dt>
          <dd>{footprintMetrics.vertexCount}</dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">Building</h2>
      <dl className="summary-list">
        <div className="summary-row">
          <dt>Floors</dt>
          <dd>{config.numberOfFloors}</dd>
        </div>
        <div className="summary-row">
          <dt>Floor height</dt>
          <dd>{config.floorHeight.toFixed(1)} m</dd>
        </div>
        <div className="summary-row">
          <dt>Total height</dt>
          <dd>{totalHeight.toFixed(1)} m</dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">Property units</h2>
      {isGenerated && sampleUnit ? (
        <dl className="summary-list">
          <div className="summary-row">
            <dt>Vertical units</dt>
            <dd>{units.length}</dd>
          </div>
          <div className="summary-row">
            <dt>Units per floor</dt>
            <dd>
              {unitsPerFloor} ({config.unitColumns} &times; {config.unitRows})
            </dd>
          </div>
          <div className="summary-row">
            <dt>Unit footprint</dt>
            <dd>
              {metres(sampleUnit.width)} &times; {metres(sampleUnit.depth)} m
            </dd>
          </div>
          <div className="summary-row">
            <dt>Area per unit</dt>
            <dd>{sampleUnit.areaSqM.toFixed(0)} m&sup2;</dd>
          </div>
          <div className="summary-row">
            <dt>Volume per unit</dt>
            <dd>{sampleUnit.volumeCubicM.toFixed(0)} m&sup3;</dd>
          </div>
        </dl>
      ) : (
        <p className="summary-pending">
          Not generated. {units.length} units will be cut from this footprint.
        </p>
      )}

      {/* The rectangular assumption, stated where the subdivision is described
          rather than buried in a comment. It is a real limitation of the
          prototype and the interface says so. */}
      {isGenerated && (
        <p className="summary-note" role="note">
          {footprintMetrics.isAxisAlignedRectangle
            ? 'Prototype: units are cut on a rectangular grid over the footprint’s bounding box.'
            : 'Warning: this footprint is not rectangular, so the prototype grid overhangs the plan.'}
        </p>
      )}
    </aside>
  )
}

export default BuildingSummary
