import { PROTOTYPE_ENCODING_NOTE } from '../ulpin/parcelIdentity'
import type { SpaceRecord } from './spaceRecord'

/**
 * The ownership chain for one property, top to bottom.
 *
 * ```
 *   PARENT PARCEL
 *   KA-BLR-0482-001928
 *          ↓
 *   FLOOR                      LEVEL
 *   Floor 3                    Basement 1
 *          ↓                          ↓
 *   UNIT                       SPACE
 *   302                        Parking · B1-02
 *          ↓                          ↓
 *   PROTOTYPE 3D ULPIN         PROTOTYPE 3D ULPIN
 *   KA-BLR-0482-001928-F03-U02 KA-BLR-0482-001928-B01-U02
 * ```
 *
 * TWO DESCENTS, ONE COMPONENT.
 * The right-hand column is an underground space, and it is drawn by this same
 * component with no branch in it. The rungs arrive as data on the record — see
 * `ui/spaceRecord.ts` — so what differs between a floor and a basement level is
 * two labels and two values, not two renderers that have to be kept in step.
 * The *claim* is identical on both sides of the datum: a 3D identifier is a
 * parcel identifier narrowed twice.
 *
 * WHY THIS REPLACED THE STANDALONE IDENTIFIER BLOCK
 * Phase 6 gave the inspector a prominent ULPIN card, and it was right to: the
 * identifier is what the project is about. But shown alone it is a string, and a
 * string does not explain itself. `KA-BLR-0482-001928-F03-U02` looks like a
 * reference number until you can see that its first four segments *are* the
 * parcel above it, its `F03` *is* the floor above it, and its `U02` *is* the
 * unit above it.
 *
 * Laid out as a descent, the identifier stops being a label and becomes a
 * **derivation**: each rung narrows the one before it, and the last rung is the
 * first three joined. That is the single clearest statement the interface can
 * make about what a 3D ULPIN is, and it costs four lines.
 *
 * The identifier keeps all the visual weight it had — same monospace, same
 * accent card, same disclaimer travelling with it. It is now the *end* of
 * something rather than a thing on its own, which is what it always was.
 *
 * **Every rung is read off the record.** The parcel, the level and the number
 * are all fields on the object the geometry was built from. Nothing here parses
 * the identifier to recover its parts, which would be the tempting shortcut and
 * would invert the actual dependency: the segments were built *from* these
 * values, not the other way round.
 */

interface OwnershipHierarchyProps {
  /** The selected space's record — above ground or below it. */
  record: SpaceRecord
}

/** One rung of the descent. */
function Rung({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <li className="hierarchy-rung">
      <span className="hierarchy-label">{label}</span>
      <span className={mono ? 'hierarchy-value hierarchy-value-mono' : 'hierarchy-value'}>
        {value}
      </span>
    </li>
  )
}

function OwnershipHierarchy({ record }: OwnershipHierarchyProps) {
  return (
    <section className="hierarchy" aria-label="Ownership hierarchy">
      {/* An ordered list, because the order *is* the containment: each entry is
          inside the one above it. The connecting arrows are drawn in CSS from
          the list items rather than being characters in the markup, so a screen
          reader hears four labelled values instead of four arrows. */}
      <ol className="hierarchy-list">
        {record.chain.map((rung) => (
          <Rung
            key={rung.label}
            label={rung.label}
            value={rung.value}
            mono={rung.mono}
          />
        ))}
      </ol>

      {/* The terminus. Same weight the standalone identifier block always had —
          it is still the loudest thing in the panel, it simply now sits at the
          foot of the chain that produced it. */}
      <div className="hierarchy-terminus ulpin-block">
        <h3 className="ulpin-label">Prototype 3D ULPIN</h3>
        <p className="ulpin-value">{record.prototypeUlpin}</p>
        <p className="ulpin-note" role="note">
          {PROTOTYPE_ENCODING_NOTE}
        </p>
      </div>
    </section>
  )
}

export default OwnershipHierarchy
