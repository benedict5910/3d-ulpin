import {
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  getUnitsPerFloor,
  type BuildingConfig,
} from '../scene/buildingConfig'
import { buildApartmentUnits } from '../scene/unitLayout'

/**
 * A small read-out of the building and its property units, overlaid on the viewer.
 *
 * Every value is computed from the same `BuildingConfig` the 3D geometry is
 * generated from, and the per-unit figures are read off the **same generated
 * `ApartmentUnit[]` the scene renders** — nothing here is typed in by hand. If
 * the config says eight floors of six units, the scene shows 48 boxes and this
 * panel says 48 units, with no third place to keep in step.
 */

interface BuildingSummaryProps {
  config?: BuildingConfig
}

function BuildingSummary({ config = DEFAULT_BUILDING_CONFIG }: BuildingSummaryProps) {
  const totalHeight = getTotalHeight(config)

  // The same generator the scene uses. The panel describes the geometry by
  // measuring it, not by repeating the numbers that produced it.
  const units = buildApartmentUnits(config)
  const unitsPerFloor = getUnitsPerFloor(config)
  // Every unit is identical under a uniform grid, so the first one is representative.
  const sampleUnit = units[0]

  return (
    <aside className="building-summary" aria-label="Building summary">
      <h2 className="summary-title">Building</h2>
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
        <div className="summary-row">
          <dt>Footprint</dt>
          <dd>
            {config.width} &times; {config.depth} m
          </dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">Property units</h2>
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
        {sampleUnit && (
          <>
            <div className="summary-row">
              <dt>Unit footprint</dt>
              <dd>
                {sampleUnit.width} &times; {sampleUnit.depth} m
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
          </>
        )}
      </dl>
    </aside>
  )
}

export default BuildingSummary
