import OwnershipHierarchy from './OwnershipHierarchy'
import type { SpaceRecord } from './spaceRecord'

/**
 * The property inspector: the cadastral record of whichever unit is selected.
 *
 * This panel is ordinary HTML sitting on top of the WebGL canvas — not a 3D
 * object, not a texture, not a label in the scene. It knows nothing about
 * Three.js, meshes, rays or cameras. It receives one `SpaceRecord` (or `null`)
 * and renders it.
 *
 * ONE INSPECTOR FOR BOTH SIDES OF THE GROUND DATUM.
 * An apartment on floor 3 and a parking bay in basement 1 are shown by this
 * component, in this layout, with these rows. There is no underground
 * inspector, no second panel and no branch inside this one — the two kinds of
 * record are flattened into a `SpaceRecord` by `ui/spaceRecord.ts` before they
 * arrive, so a person reads one register rather than two, and a row added here
 * cannot be forgotten on one side. The only thing an underground record
 * changes is the heading and the badge that says which side of the datum the
 * volume is on; every figure below them is produced by the same code.
 *
 * Every value below is read off that object or derived from its bounds. There
 * are no literals here for area, volume, elevation or extent — if the building
 * config changes, this panel changes with it, because it is reading the same
 * generated record the geometry was built from rather than a second description
 * of the same unit that someone has to remember to keep in step.
 *
 * WHICH GEOMETRY IT SHOWS
 * The record handed to this panel is a **display record** — canonical, or canonical
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
  'Select a property unit or underground space in the 3D model to inspect its spatial record.'

/** One length in metres, at the precision a cadastral read-out wants. */
function metres(value: number): string {
  return `${value.toFixed(1)} m`
}

/** A single axis of the unit's bounding box, as `min → max`. */
function span(min: number, max: number): string {
  return `${min.toFixed(1)} → ${max.toFixed(1)} m`
}

/**
 * The filled-in record for one 3D space.
 *
 * Split out from the panel so that `record` is non-nullable throughout: the
 * "nothing selected" case is handled once, by the parent, instead of guarding
 * every field.
 */
function UnitRecord({
  record,
  isConflicted,
}: {
  record: SpaceRecord
  isConflicted: boolean
}) {
  // Carried on the record, derived by the same function the renderer uses to
  // place the mesh, so the point named here is exactly the point the box is
  // centred on.
  const [centroidX, centroidY, centroidZ] = record.centroid

  return (
    <>
      {/* WHICH SIDE OF THE DATUM. Stated before anything else, because it is
          the fact that reframes every number underneath it: an elevation of
          −3.0 → 0.0 m is a mistake in a building and a correct basement, and
          the reader needs to know which they are looking at before they read
          it. Taken from the record's own marker rather than from the sign of an
          elevation — see `ui/spaceRecord.ts`. */}
      {record.isUnderground && (
        <p className="inspector-underground">
          <span className="inspector-underground-glyph" aria-hidden="true">
            ▼
          </span>
          Underground property / space — below the ground datum
        </p>
      )}

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
      <OwnershipHierarchy record={record} />

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
          <dd>{record.propertyType}</dd>
        </div>
        <div className="summary-row">
          <dt>Area</dt>
          <dd>{record.areaSqM.toFixed(0)} m&sup2;</dd>
        </div>
        <div className="summary-row">
          <dt>Volume</dt>
          <dd>{record.volumeCubicM.toFixed(0)} m&sup3;</dd>
        </div>
        <div className="summary-row">
          <dt>Elevation</dt>
          {/* The vertical extent is what makes this a *3D* property record:
              the same footprint at 6–9 m is a different property from the one
              at 9–12 m — and the same footprint at −3–0 m is a third property
              again, which is the whole argument for the underground layer. */}
          <dd>
            {metres(record.yMin)} &ndash; {metres(record.yMax)}
          </dd>
        </div>
      </dl>

      <h2 className="summary-title summary-title-secondary">3D bounds</h2>
      <dl className="summary-list">
        <div className="summary-row">
          <dt>X</dt>
          <dd>{span(record.xMin, record.xMax)}</dd>
        </div>
        <div className="summary-row">
          <dt>Y</dt>
          <dd>{span(record.yMin, record.yMax)}</dd>
        </div>
        <div className="summary-row">
          <dt>Z</dt>
          <dd>{span(record.zMin, record.zMax)}</dd>
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
  /** The selected space's record, or `null` when nothing is selected. */
  record: SpaceRecord | null
  /**
   * Whether the validation engine has flagged this volume.
   *
   * Passed in rather than derived: the inspector does not decide what a conflict
   * is, and this is the same `conflictedUnitIds` list the 3D scene colours from,
   * so a red box and a badged record can never disagree. It covers both sides
   * of the datum, because the engine's finding does.
   */
  isConflicted?: boolean
}

function PropertyInspector({ record, isConflicted = false }: PropertyInspectorProps) {
  return (
    // aria-live: screen readers announce the record when the selection changes.
    <aside
      className="property-inspector"
      aria-label="Property inspector"
      aria-live="polite"
    >
      {/* The heading names what is selected rather than what the panel is: a
          reader who has clicked a parking bay should not be told they are
          looking at a "Property Unit". Carried on the record so the wording is
          decided once, beside the rest of the record's shape. */}
      <h2 className="summary-title">{record?.title ?? 'Property Unit'}</h2>

      {record === null ? (
        <p className="inspector-empty">{EMPTY_MESSAGE}</p>
      ) : (
        <UnitRecord record={record} isConflicted={isConflicted} />
      )}
    </aside>
  )
}

export default PropertyInspector
