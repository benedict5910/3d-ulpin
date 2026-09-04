import { getUnitCenter, type ApartmentUnit } from '../scene/unitLayout'
import { PROTOTYPE_ENCODING_NOTE } from '../ulpin/parcelIdentity'

/**
 * The property inspector: the cadastral record of whichever unit is selected.
 *
 * This panel is ordinary HTML sitting on top of the WebGL canvas — not a 3D
 * object, not a texture, not a label in the scene. It knows nothing about
 * Three.js, meshes, rays or cameras. It receives one `ApartmentUnit` (or
 * `null`) and renders it.
 *
 * Every value below is read off that object or derived from its bounds. There
 * are no literals here for area, volume, elevation or extent — if the building
 * config changes, this panel changes with it, because it is reading the same
 * generated record the geometry was built from rather than a second description
 * of the same unit that someone has to remember to keep in step.
 */

const EMPTY_MESSAGE =
  'Select a property unit in the 3D model to inspect its spatial record.'

/** One length in metres, at the precision a cadastral read-out wants. */
function metres(value: number): string {
  return `${value.toFixed(1)} m`
}

/** A single axis of the unit's bounding box, as `min → max`. */
function span(min: number, max: number): string {
  return `${min.toFixed(1)} → ${max.toFixed(1)} m`
}

/**
 * The filled-in record for one unit.
 *
 * Split out from the panel so that `unit` is non-nullable throughout: the
 * "nothing selected" case is handled once, by the parent, instead of guarding
 * every field.
 */
function UnitRecord({ unit }: { unit: ApartmentUnit }) {
  // Derived from the bounds by the same function the renderer uses to place the
  // mesh, so the point named here is exactly the point the box is centred on.
  const [centroidX, centroidY, centroidZ] = getUnitCenter(unit)

  return (
    <>
      {/* The identifier block leads the panel and is the only element given
          display weight: everything below it *describes* the property, this
          *names* it. Note that both strings are read straight off the unit —
          the inspector displays an identifier, it never builds one. */}
      <section className="ulpin-block">
        <h3 className="ulpin-label">Prototype 3D ULPIN</h3>
        <p className="ulpin-value">{unit.prototypeUlpin}</p>
        <p className="ulpin-note" role="note">
          {PROTOTYPE_ENCODING_NOTE}
        </p>
      </section>

      <dl className="summary-list">
        <div className="summary-row">
          <dt>Parent parcel</dt>
          <dd className="mono">{unit.parentParcelId}</dd>
        </div>
        <div className="summary-row">
          <dt>Unit</dt>
          <dd>{unit.unitNumber}</dd>
        </div>
        <div className="summary-row">
          <dt>Floor</dt>
          <dd>{unit.floorLevel}</dd>
        </div>
        <div className="summary-row">
          <dt>Property type</dt>
          <dd>{unit.propertyType}</dd>
        </div>
        <div className="summary-row">
          <dt>Area</dt>
          <dd>{unit.areaSqM.toFixed(0)} m&sup2;</dd>
        </div>
        <div className="summary-row">
          <dt>Volume</dt>
          <dd>{unit.volumeCubicM.toFixed(0)} m&sup3;</dd>
        </div>
        <div className="summary-row">
          <dt>Elevation</dt>
          {/* The vertical extent is what makes this a *3D* property record:
              the same footprint at 6–9 m is a different property from the one
              at 9–12 m. */}
          <dd>
            {metres(unit.yMin)} &ndash; {metres(unit.yMax)}
          </dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">3D bounds</h2>
      <dl className="summary-list">
        <div className="summary-row">
          <dt>X</dt>
          <dd>{span(unit.xMin, unit.xMax)}</dd>
        </div>
        <div className="summary-row">
          <dt>Y</dt>
          <dd>{span(unit.yMin, unit.yMax)}</dd>
        </div>
        <div className="summary-row">
          <dt>Z</dt>
          <dd>{span(unit.zMin, unit.zMax)}</dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">Centroid</h2>
      <dl className="summary-list">
        <div className="summary-row">
          <dt>X</dt>
          <dd>{metres(centroidX)}</dd>
        </div>
        <div className="summary-row">
          <dt>Y</dt>
          <dd>{metres(centroidY)}</dd>
        </div>
        <div className="summary-row">
          <dt>Z</dt>
          <dd>{metres(centroidZ)}</dd>
        </div>
      </dl>
    </>
  )
}

interface PropertyInspectorProps {
  /** The selected unit, or `null` when nothing is selected. */
  unit: ApartmentUnit | null
}

function PropertyInspector({ unit }: PropertyInspectorProps) {
  return (
    // aria-live: screen readers announce the record when the selection changes.
    <aside
      className="property-inspector"
      aria-label="Property inspector"
      aria-live="polite"
    >
      <h2 className="summary-title">Property Unit</h2>

      {unit === null ? (
        <p className="inspector-empty">{EMPTY_MESSAGE}</p>
      ) : (
        <UnitRecord unit={unit} />
      )}
    </aside>
  )
}

export default PropertyInspector
