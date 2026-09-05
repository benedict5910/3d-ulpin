import { getUnitCenter, type ApartmentUnit } from '../scene/unitLayout'
import OwnershipHierarchy from './OwnershipHierarchy'

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
 *
 * WHICH GEOMETRY IT SHOWS
 * The unit handed to this panel is a **display unit** — canonical, or canonical
 * with a simulated conflict override applied (see
 * `simulation/conflictSimulation.ts`). That is correct and deliberate: a
 * simulated encroachment is a hypothetical *record*, so the record panel should
 * show it, and it is the same geometry the validator was pointed at. The
 * exploded view and floor isolation are a different kind of thing entirely —
 * they change where a box is *drawn* and never reach this panel, which is why
 * the elevation here reads 6.0–9.0 m whether or not the floors are separated on
 * screen. ARCHITECTURE §10.0 has the full separation.
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
function UnitRecord({ unit, isConflicted }: { unit: ApartmentUnit; isConflicted: boolean }) {
  // Derived from the bounds by the same function the renderer uses to place the
  // mesh, so the point named here is exactly the point the box is centred on.
  const [centroidX, centroidY, centroidZ] = getUnitCenter(unit)

  return (
    <>
      {/* The dispute badge, when the validation engine has flagged this unit.
          It sits *above* the record and **replaces nothing**: a contested
          property still has an identifier, an area, a volume and an elevation,
          and a register that hid them the moment a dispute arose would be
          useless at exactly the moment it was needed. The badge adds a fact;
          it does not censor the others. */}
      {isConflicted && (
        <p className="inspector-conflict" role="alert">
          <span className="inspector-conflict-glyph" aria-hidden="true">
            ⚠
          </span>
          Conflict — disputed volume
        </p>
      )}

      {/* The ownership chain leads the panel: parcel → floor → unit →
          identifier. It carries the same display weight the standalone ULPIN
          card used to, and it earns more of it — the identifier laid out as the
          foot of a descent reads as a *derivation* rather than a reference
          number. See `OwnershipHierarchy.tsx`. */}
      <OwnershipHierarchy unit={unit} />

      {/* The validation status of this one volume, immediately under the chain
          that names it. Two words when there is nothing wrong: the default state
          of a register is that it is consistent, and a panel that celebrated
          validity would make the unremarkable case the loudest one. */}
      {!isConflicted && (
        <p className="inspector-validated">
          <span className="inspector-validated-glyph" aria-hidden="true">
            ✓
          </span>
          No conflicts on this volume
        </p>
      )}

      <dl className="summary-list">
        {/* Parent parcel, floor and unit are the ownership chain above and are
            deliberately not repeated here — one fact, one place on the panel. */}
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
  /**
   * Whether the validation engine has flagged this unit.
   *
   * Passed in rather than derived: the inspector does not decide what a conflict
   * is, and this is the same `conflictedUnitIds` list the 3D scene colours from,
   * so a red box and a badged record can never disagree.
   */
  isConflicted?: boolean
}

function PropertyInspector({ unit, isConflicted = false }: PropertyInspectorProps) {
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
        <UnitRecord unit={unit} isConflicted={isConflicted} />
      )}
    </aside>
  )
}

export default PropertyInspector
