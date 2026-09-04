import {
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  type BuildingConfig,
} from '../scene/buildingConfig'

/**
 * A small read-out of the building's dimensions, overlaid on the viewer.
 *
 * Every value is computed from the same `BuildingConfig` the 3D geometry is
 * generated from — nothing here is typed in by hand. If the config says eight
 * floors, the scene shows eight floors and this panel says eight floors, with
 * no third place to keep in step.
 */

interface BuildingSummaryProps {
  config?: BuildingConfig
}

function BuildingSummary({ config = DEFAULT_BUILDING_CONFIG }: BuildingSummaryProps) {
  const totalHeight = getTotalHeight(config)

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
    </aside>
  )
}

export default BuildingSummary
