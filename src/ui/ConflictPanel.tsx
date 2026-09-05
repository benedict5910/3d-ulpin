import {
  CONFLICT_DISCLAIMER,
  CONFLICT_RESOLUTION_WORKFLOW,
  CONFLICT_RULE,
  CONFLICT_STATUS,
  type ConflictFocus,
} from '../simulation/conflictPresentation'
import type { ConflictScenario } from '../simulation/conflictSimulation'
import type {
  OwnershipConflict,
  ValidatableUnit,
} from '../validation/validateTopology'

/**
 * The spatial ownership conflict panel — docked in the right-hand column.
 *
 * ```
 *   ⚠  SPATIAL OWNERSHIP CONFLICT
 *
 *   Unit A                  301 · KA-BLR-0482-001928-F03-U01
 *   Unit B                  302 · KA-BLR-0482-001928-F03-U02
 *   Floor                   3
 *   Intersection volume     84.0 m³
 *   Overlap dimensions      4.00 × 7.00 × 3.00 m
 *   Simulated displacement  4.00 m
 *   Rule                    3D ownership volumes must not positively overlap
 *   Status                  Requires cadastral review
 *
 *   Detected → Source records compared → Officer review required
 *            → Correct geometry → Revalidate
 *
 *   The system detects the conflict but does not decide legal ownership.
 * ```
 *
 * WHERE IT SITS, AND WHY THAT CHANGED
 * Through Subphase F this component was `ConflictBanner`, and it floated over the
 * middle of the 3D canvas. Everything in it was factual and none of it deserved
 * to be there: a 430 px card with eight fields, a five-step chain and two notes
 * occupied precisely the region of the viewport the audience needed in order to
 * see the two red units, the red intersection volume, the colourless ghost and
 * the displacement arrow — the entire visual argument the card was describing.
 * The strongest moment of the demonstration was competing with its own caption.
 *
 * Subphase G split the finding along the line between **that** and **what**:
 *
 *   · `ConflictAlert` — one line, top-centre over the canvas. That there is a
 *     conflict, and how large it is. It occludes almost nothing.
 *   · this panel — what the conflict consists of, docked in the right column
 *     above the pipeline and the inspector.
 *
 * DOCKED, NOT A DRAWER
 * A drawer sliding in from the right would have been the more theatrical choice
 * and it was rejected for three reasons. It would introduce a second overlay in
 * an interface that has just removed one. It would cover the pipeline status and
 * the property inspector — the two panels that give the finding its context, and
 * which a viewer will want to read *beside* it rather than instead of it. And a
 * drawer implies a thing that can be dismissed independently, whereas this panel
 * is present exactly when the engine has found a conflict and absent otherwise:
 * it has no state of its own to open or close, so a control that suggested it did
 * would be lying about the model.
 *
 * The right column already scrolls (`.inspector-panel { overflow-y: auto }`), it
 * already stacks cards at their natural heights, and it is already where every
 * *statement about the record* lives. A conflict is a statement about the record.
 * It belongs with the others, at the top of them, because it outranks them.
 *
 * WHY IT LOOKS LIKE THIS
 * This is the one moment the interface is allowed to raise its voice, and it earns
 * that by being **entirely factual**. Every figure is read off an
 * `OwnershipConflict` the engine produced by intersecting two boxes, or off the
 * `ConflictFocus` derived from it: the two units, their identifiers, the floor,
 * the intersection volume, the three extents spelled out so a judge can multiply
 * them, and how far the simulated boundary was moved. No adjective, no severity
 * score, no advice.
 *
 * A panel that said "⚠ PROBLEM DETECTED" would be theatre. A panel that shows the
 * disputed volume in cubic metres, beside a translucent red box occupying exactly
 * that volume in the 3D view, is a system demonstrating that it computed
 * something — and now the reader can see both at once.
 *
 * THE TWO ROWS THAT MATTER MOST ARE NOT FIGURES
 * `Status` and the workflow chain are the difference between a validator and a
 * pretend registry. Everything above them is a finding of fact about geometry;
 * everything below them concedes that a finding of fact about geometry is not a
 * finding of law about people. The system can prove two records describe
 * overlapping volumes. It cannot know which survey was wrong, which deed is older,
 * or what a tribunal would decide — so it refers, and the chain shows exactly
 * where the human is: steps two, three and four are a cadastral officer's, and
 * only the first and the last are the machine's.
 *
 * Omitting that would win the demonstration by overclaiming, which is the one way
 * a cadastral prototype can fail an expert audience outright.
 *
 * IT DOES NOT REPLACE THE VALIDATION BAR
 * The bar keeps reporting the standing condition of the whole record; this reports
 * the specific finding. Two levels of the same truth, neither derived from the
 * other by hand. And unlike the old floating card, this one is real UI: it takes
 * pointer events, so its text can be selected and read out.
 */

interface ConflictPanelProps {
  /**
   * The conflicts the engine found, in the order it found them.
   *
   * Usually one — the simulation stages a single encroachment. The component
   * renders the first and says how many others there are, rather than growing an
   * unbounded list in a column that also has to hold the pipeline and the record.
   */
  // Above-ground conflicts specifically: this panel prints a floor and an
  // identifier, and only an apartment carries those. The engine's own
  // register-wide sweep produces the narrower `OwnershipConflict` shape, which
  // this deliberately does not accept.
  conflicts: readonly OwnershipConflict<ValidatableUnit>[]
  /**
   * The staged scenario, when the conflict came from the simulation rather than
   * from the data.
   *
   * `null` when nothing is being simulated — in which case the engine found a
   * genuine defect in the record and the panel says only what it found.
   */
  scenario: ConflictScenario | null
  /**
   * The derived presentation record, or `null`.
   *
   * Supplies the one figure the engine cannot know: how far the simulated
   * boundary was moved. The engine measures the *consequence* (an intersection);
   * the displacement is the *cause*, and it belongs to the simulation. Reading it
   * from the focus rather than from the scenario means the panel counts up with
   * the animation instead of stating the destination while the box is still
   * travelling.
   */
  focus: ConflictFocus | null
}

/** Metres, at the precision a dispute would be argued in. */
function m(value: number): string {
  return value.toFixed(2)
}

function ConflictPanel({ conflicts, scenario, focus }: ConflictPanelProps) {
  if (conflicts.length === 0) return null

  const conflict = conflicts[0]
  const { unitA, unitB, extents, intersectionVolumeCubicM } = conflict

  return (
    // `role="region"`, not `role="alert"`. The alert over the canvas already
    // announced the finding assertively; a second assertive live region would
    // interrupt a screen reader twice for one event. This is the place the
    // listener is being sent *to*, so it is a landmark with a name.
    <section
      className="conflict-panel"
      role="region"
      aria-label="Spatial ownership conflict details"
    >
      <p className="conflict-panel-title">
        <span className="conflict-panel-glyph" aria-hidden="true">
          ⚠
        </span>
        Spatial ownership conflict
      </p>

      <dl className="summary-list conflict-panel-fields">
        <div className="summary-row">
          <dt>Unit A</dt>
          <dd>
            {unitA.unitNumber}
            <span className="conflict-panel-id">{unitA.prototypeUlpin}</span>
          </dd>
        </div>
        <div className="summary-row">
          <dt>Unit B</dt>
          <dd>
            {unitB.unitNumber}
            <span className="conflict-panel-id">{unitB.prototypeUlpin}</span>
          </dd>
        </div>
        <div className="summary-row">
          <dt>Floor</dt>
          {/* Both units are on the same floor for any overlap with a positive
              Y extent between single-storey properties; A's is quoted. */}
          <dd>{unitA.floorLevel}</dd>
        </div>
        <div className="summary-row">
          <dt>Intersection volume</dt>
          <dd className="conflict-panel-volume">
            {intersectionVolumeCubicM.toFixed(1)} m&sup3;
          </dd>
        </div>
        <div className="summary-row">
          {/* The three extents beside the product, so the figure above can be
              checked rather than believed. */}
          <dt>Overlap dimensions</dt>
          <dd className="conflict-panel-mono">
            {m(extents.x)} × {m(extents.y)} × {m(extents.z)} m
          </dd>
        </div>
        {focus !== null && (
          <div className="summary-row">
            <dt>Simulated displacement</dt>
            <dd className="conflict-panel-mono">
              {m(focus.displacementM)} m
              <span className="conflict-panel-id">{focus.displacementLabel}</span>
            </dd>
          </div>
        )}
        <div className="summary-row">
          <dt>Rule violated</dt>
          <dd className="conflict-panel-rule">{CONFLICT_RULE}</dd>
        </div>
        <div className="summary-row">
          <dt>Status</dt>
          <dd className="conflict-panel-status">{CONFLICT_STATUS}</dd>
        </div>
      </dl>

      {/* THE RESOLUTION PATH. Rendered from the data in
          `conflictPresentation.ts` rather than written out here, so the claim
          about process lives next to the claim about the rule and the two can be
          reviewed together. The steps the prototype actually performs are marked;
          the three in the middle are a person's. */}
      <ol className="conflict-workflow" aria-label="Conflict resolution workflow">
        {CONFLICT_RESOLUTION_WORKFLOW.map((step) => (
          <li
            key={step.label}
            className={
              step.automated
                ? 'conflict-workflow-step conflict-workflow-auto'
                : 'conflict-workflow-step conflict-workflow-manual'
            }
            title={step.actor}
          >
            {step.label}
          </li>
        ))}
      </ol>

      {/* THE HONESTY LINES. Two of them, and they say different things.

          The first: when the conflict was staged, say so — and say that the real
          record is untouched. A demonstration that let an audience believe the
          demo data contains a genuine ownership dispute would be winning the
          point by misleading them.

          The second: what the system does *not* claim. It is stated whether or
          not the conflict was simulated, because it is true of any conflict this
          engine will ever find. */}
      {scenario !== null && (
        <p className="conflict-panel-note" role="note">
          Simulated override — unit {scenario.encroacherNumber} moved{' '}
          {scenario.encroachmentM.toFixed(2)} m {scenario.axisLabel} across its shared
          wall with {scenario.ownerNumber} on floor {scenario.floorLevel}. The
          canonical cadastral record is unchanged.
        </p>
      )}

      <p className="conflict-panel-disclaimer" role="note">
        {CONFLICT_DISCLAIMER}
      </p>

      {conflicts.length > 1 && (
        <p className="conflict-panel-more">
          and {conflicts.length - 1} further conflicting pair
          {conflicts.length - 1 === 1 ? '' : 's'}
        </p>
      )}
    </section>
  )
}

export default ConflictPanel
