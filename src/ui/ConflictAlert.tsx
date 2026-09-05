import type {
  OwnershipConflict,
  ValidatableUnit,
} from '../validation/validateTopology'

/**
 * The compact conflict alert, top-centre over the 3D viewer.
 *
 * ```
 *   ⚠  SPATIAL OWNERSHIP CONFLICT DETECTED · 84.0 m³ overlap
 * ```
 *
 * One line. That is the whole component.
 *
 * WHY IT IS ONE LINE
 * Until Subphase G the finding was presented as a 430 px card floating over the
 * middle of the canvas: eight fields, a five-step chain and two notes, sitting
 * exactly where the building is. Every figure in it was true and every one of
 * them was covering the thing it described. The audience was asked to read a
 * proof of an overlap while the overlap itself was behind the proof.
 *
 * So the finding was split in two, along the line between **that** and **what**:
 *
 *   · **that** there is a conflict, and how big it is — this component. It is an
 *     announcement, it belongs where the eye already is, and it earns its place
 *     over the canvas by being a single line that occludes almost nothing.
 *   · **what** the conflict consists of — `ConflictPanel`, docked in the right
 *     column with the rest of the record. See that file for why a dock rather
 *     than a drawer.
 *
 * The volume is carried up here rather than left below because it is the one
 * figure that makes the announcement a *finding* instead of an alarm: "conflict
 * detected" is a claim, "84.0 m³ overlap" is a measurement, and the measurement
 * costs eighteen characters.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It does not pulse, it does not slide in, and it does not grow. The intersection
 * volume in the scene behind it is already the strongest thing on screen, and a
 * second element competing for attention with the geometry it is annotating would
 * undo the point of moving the details out of the way.
 *
 * `pointer-events: none`: it is a read-out, and every pixel of the viewer that can
 * be dragged should be.
 */

interface ConflictAlertProps {
  /**
   * The conflicts the engine found, in the order it found them.
   *
   * The alert reports the first one's volume and, if there are others, says how
   * many — the same rule the panel follows, so the two never disagree about how
   * much was found.
   */
  // Above-ground conflicts specifically: this panel prints a floor and an
  // identifier, and only an apartment carries those. The engine's own
  // register-wide sweep produces the narrower `OwnershipConflict` shape, which
  // this deliberately does not accept.
  conflicts: readonly OwnershipConflict<ValidatableUnit>[]
}

function ConflictAlert({ conflicts }: ConflictAlertProps) {
  if (conflicts.length === 0) return null

  // The FIRST conflict's volume, not the sum of all of them — because the panel
  // below describes the first conflict, and an alert quoting a total beside a
  // panel quoting a part would be two numbers for one finding. The count of the
  // rest is carried separately, which is the honest way to say "and more".
  const { intersectionVolumeCubicM } = conflicts[0]

  return (
    // `role="alert"` rather than `status`: this is the assertive announcement,
    // and it is announced *here* rather than in the panel so a screen reader
    // hears one interruption rather than two. The panel is a region the user
    // navigates to; this is the thing that tells them to.
    <div className="conflict-alert" role="alert">
      <span className="conflict-alert-glyph" aria-hidden="true">
        ⚠
      </span>
      <span className="conflict-alert-text">Spatial ownership conflict detected</span>
      <span className="conflict-alert-sep" aria-hidden="true">
        ·
      </span>
      <span className="conflict-alert-volume">
        {intersectionVolumeCubicM.toFixed(1)} m&sup3; overlap
      </span>
      {conflicts.length > 1 && (
        <span className="conflict-alert-count">
          +{conflicts.length - 1} more
        </span>
      )}
    </div>
  )
}

export default ConflictAlert
