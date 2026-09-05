import type { FootprintMetrics } from '../geometry/footprint'
import {
  getTotalHeight,
  getUnitsPerFloor,
  type BuildingConfig,
} from '../scene/buildingConfig'
import type { ApartmentUnit } from '../scene/unitLayout'
import {
  getSpacesPerLevel,
  getTotalDepthM,
  type BasementConfig,
} from '../underground/basementConfig'
import type { UndergroundSpace } from '../underground/undergroundLayout'

/**
 * A small read-out of the building and its property units, overlaid on the viewer.
 *
 * LAYOUT REFINEMENT: HEADLINE FIRST, EVIDENCE ON REQUEST.
 * This panel used to print four full sections — footprint, building, property
 * units, underground — permanently, over the 3D scene it describes. That is a
 * tall card in the most valuable rectangle in the application: the one the
 * building is standing in. The information was right and the priority was
 * wrong, so the *presentation* changed and nothing else did. Five headline
 * figures stay visible because they are what a viewer checks against the model
 * in front of them; every detailed field is still here, one disclosure away,
 * in the same groups and the same wording as before.
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
 * panel claiming the workflow had run. The headline rows for the generated
 * quantities print an em dash until they exist, for the same reason.
 *
 * THE TOTAL IS A SUM, NOT A NUMBER.
 * `Total spaces` is `units.length + undergroundSpaces.length`, computed in
 * the render from the two arrays the scene is drawing. It is worth saying why
 * that matters more than it looks: the moment a headline figure like "24" is
 * typed anywhere, it becomes a claim the software makes about itself rather
 * than a measurement of what it produced — and it stays 24 through the config
 * change that makes it wrong. Every count in this panel is `.length` on
 * generated data, so a second basement level or a 3 × 2 grid changes the
 * numbers here with no edit to this file.
 */

interface BuildingSummaryProps {
  /** The building's vertical description. */
  config: BuildingConfig
  /** The footprint, measured once by `App`. */
  footprintMetrics: FootprintMetrics
  /** The generated units, as rendered by the scene. */
  units: readonly ApartmentUnit[]
  /** The basement's vertical description. */
  basementConfig: BasementConfig
  /** The generated underground spaces, as rendered by the scene. */
  undergroundSpaces: readonly UndergroundSpace[]
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
  basementConfig,
  undergroundSpaces,
  isGenerated,
}: BuildingSummaryProps) {
  const totalHeight = getTotalHeight(config)
  const unitsPerFloor = getUnitsPerFloor(config)
  // Every unit is identical under a uniform grid, so the first one is representative.
  const sampleUnit = units[0]
  const sampleSpace = undergroundSpaces[0]
  const totalDepth = getTotalDepthM(basementConfig)
  // Derived by addition from the two arrays the scene actually draws — see the
  // note in this file's header for why it is a sum rather than a figure.
  const totalSpaces = units.length + undergroundSpaces.length

  /** A count that only means something once the workflow has run. */
  const generated = (value: number): string => (isGenerated ? String(value) : '—')

  return (
    <aside className="building-summary" aria-label="Model summary">
      <h2 className="summary-title">Model summary</h2>

      {/* The five figures worth permanent space over the scene: what the plan
          is, how tall it is, and how many things the record now contains above
          and below the datum. Everything else is behind the disclosure. */}
      <dl className="summary-list summary-headline">
        <div className="summary-row">
          <dt>Footprint</dt>
          <dd>{footprintMetrics.areaSqM.toFixed(0)} m&sup2;</dd>
        </div>
        <div className="summary-row">
          <dt>Floors</dt>
          <dd>{config.numberOfFloors}</dd>
        </div>
        <div className="summary-row">
          <dt>Above ground</dt>
          <dd>{generated(units.length)}</dd>
        </div>
        <div className="summary-row">
          <dt>Underground</dt>
          <dd>{generated(undergroundSpaces.length)}</dd>
        </div>
        <div className="summary-row summary-row-total">
          <dt>Total spaces</dt>
          <dd>{generated(totalSpaces)}</dd>
        </div>
      </dl>

      {!isGenerated && (
        <p className="summary-pending">
          Not generated. {units.length} units and {undergroundSpaces.length}{' '}
          underground space(s) will be cut from this footprint.
        </p>
      )}

      {/* The detailed read-out, unchanged in content and grouping. `details`
          rather than a hand-rolled toggle: the open/closed state, the keyboard
          behaviour and the accessible name all come from the element, and the
          panel gains no state of its own. */}
      <details className="summary-details">
        <summary className="summary-details-toggle">More details</summary>
        <div className="summary-details-body">
          <h3 className="summary-title summary-title-secondary">Footprint (source)</h3>
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

          <h3 className="summary-title summary-title-secondary">Building</h3>
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

          <h3 className="summary-title summary-title-secondary">Property units</h3>
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

          {/* Below the ground datum. A section of its own rather than more rows in
              the one above, because "how many storeys" and "how deep" are different
              sanctions and a reader scanning for one should not have to filter the
              other out of a single list. */}
          <h3 className="summary-title summary-title-secondary">Underground</h3>
          {isGenerated && sampleSpace ? (
            <dl className="summary-list">
              <div className="summary-row">
                <dt>Basement levels</dt>
                <dd>{basementConfig.numberOfLevels}</dd>
              </div>
              <div className="summary-row">
                <dt>Excavated depth</dt>
                <dd>{totalDepth.toFixed(1)} m</dd>
              </div>
              <div className="summary-row">
                <dt>Elevation</dt>
                {/* Read off the deepest and shallowest generated spaces rather than
                    from the config: the panel reports the interval the *record*
                    occupies, so a generator that disagreed with its own config
                    would be visible here instead of papered over. */}
                <dd>
                  {Math.min(...undergroundSpaces.map((space) => space.yMin)).toFixed(1)}{' '}
                  &rarr;{' '}
                  {Math.max(...undergroundSpaces.map((space) => space.yMax)).toFixed(1)} m
                </dd>
              </div>
              <div className="summary-row">
                <dt>Underground spaces</dt>
                <dd>{undergroundSpaces.length}</dd>
              </div>
              <div className="summary-row">
                <dt>Spaces per level</dt>
                <dd>
                  {getSpacesPerLevel(basementConfig)} ({basementConfig.spaceColumns}{' '}
                  &times; {basementConfig.spaceRows})
                </dd>
              </div>
              <div className="summary-row summary-row-total">
                <dt>Total 3D spaces</dt>
                <dd>
                  {totalSpaces} ({units.length} above &middot;{' '}
                  {undergroundSpaces.length} below)
                </dd>
              </div>
            </dl>
          ) : (
            <p className="summary-pending">
              Not generated. {undergroundSpaces.length} underground space(s) will be
              cut beneath this footprint.
            </p>
          )}

          {/* The rectangular assumption, stated where the subdivision is described
              rather than buried in a comment. It is a real limitation of the
              prototype and the interface still says so — moved into the expanded
              panel as a footnote rather than deleted, because it qualifies the
              detailed figures above it and not the headline count. */}
          {isGenerated && (
            <p className="summary-note" role="note">
              {footprintMetrics.isAxisAlignedRectangle
                ? 'Prototype: units and underground spaces are cut on a rectangular grid over the footprint’s bounding box.'
                : 'Warning: this footprint is not rectangular, so the prototype grid overhangs the plan above and below ground.'}
            </p>
          )}
        </div>
      </details>
    </aside>
  )
}

export default BuildingSummary
