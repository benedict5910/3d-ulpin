import type { TopologyReport, TopologyStatus } from '../validation/types'

/**
 * The topology status bar — a slim strip under the header.
 *
 * ```
 *   ✓ Parcel valid  ✓ 5 floors valid  ✓ Geometry valid  ✓ 20 unique IDs
 *   ✓ No conflicts  ✓ 20 units                       [ TOPOLOGY VALID ]  Details
 * ```
 *
 * WHY A BAR AND NOT A PANEL
 * Validation is a *standing condition*, not an event: it is true continuously and
 * the presenter needs it visible without spending screen on it. A panel large
 * enough to list six rules would take a column the 3D viewer needs; a bar of
 * chips takes one line and still shows every rule, because a chip only has to
 * say which rule it is and whether it passed. The detail — the figures, the
 * sentences, which units — lives in a panel the user opens, which is where
 * detail belongs.
 *
 * Since Subphase D the bar also carries the conflict-simulation control — see
 * the note beside it for why it belongs here and not next to the generate
 * button.
 *
 * **EVERY WORD ON THIS BAR COMES FROM THE ENGINE.** The chip text is written by
 * the rule that produced it (`ValidationResult.chip`), the status is the rule's
 * own verdict, and the headline is `report.status`. This component formats
 * nothing and computes nothing — it cannot say "20 units" while the engine
 * counted nineteen, and it cannot show green while a rule is failing. That is
 * the difference between a validation display and a decorative one, and it is
 * enforced by there being no numbers in this file.
 */

/** Wording for the overall verdict, and the class that colours it. */
const HEADLINE: Record<TopologyStatus, { label: string; className: string }> = {
  valid: { label: 'Topology valid', className: 'validation-headline-valid' },
  warning: { label: 'Topology warning', className: 'validation-headline-warning' },
  conflict: { label: 'Topology invalid', className: 'validation-headline-conflict' },
}

/**
 * A glyph per status.
 *
 * A second, non-colour channel for the same information — the project's
 * standing rule, and the reason the pipeline markers differ in shape as well as
 * hue. A demo projector that flattens green and red to the same grey still
 * shows a tick against a cross.
 */
const GLYPH = { pass: '✓', warning: '!', fail: '✕' } as const

interface ValidationStatusBarProps {
  /** The engine's report, or `null` before the cadastre has been generated. */
  report: TopologyReport | null
  /** Whether the details panel is open. */
  isDetailOpen: boolean
  /** Toggle the details panel. */
  onToggleDetail: () => void
  /**
   * Whether the conflict simulation can be run — the model must exist and a
   * wall-sharing pair must have been found to stage it between.
   */
  canSimulate: boolean
  /** Whether the simulated override is currently applied. */
  isSimulating: boolean
  /** Apply or remove the simulated conflict. */
  onToggleSimulation: () => void
}

function ValidationStatusBar({
  report,
  isDetailOpen,
  onToggleDetail,
  canSimulate,
  isSimulating,
  onToggleSimulation,
}: ValidationStatusBarProps) {
  // Before generation there is no 3D model to validate, and a bar reading
  // "valid" over an empty scene would be claiming something about nothing.
  if (report === null) {
    return (
      <div className="validation-bar validation-bar-idle" aria-label="Topology validation">
        <span className="validation-idle">
          Topology validation runs on the generated 3D cadastre
        </span>
      </div>
    )
  }

  const headline = HEADLINE[report.status]

  return (
    <div className="validation-bar" aria-label="Topology validation">
      <ul className="validation-chips">
        {report.chips.map((chip) => (
          <li
            key={chip.category}
            className={`validation-chip validation-chip-${chip.status}`}
            title={chip.message}
          >
            <span className="validation-glyph" aria-hidden="true">
              {GLYPH[chip.status]}
            </span>
            {chip.chip}
            {/* The status in words, for assistive technology — the meaning never
                rests on a colour or a glyph alone. */}
            <span className="visually-hidden">
              {chip.status === 'pass'
                ? ' — passed'
                : chip.status === 'warning'
                  ? ' — warning'
                  : ' — failed'}
            </span>
          </li>
        ))}
      </ul>

      {/* `role="status"` so a change of verdict is announced once, rather than
          the whole bar being re-read every time a chip's number changes. */}
      <p className={`validation-headline ${headline.className}`} role="status">
        {headline.label}
      </p>

      <button
        type="button"
        className="validation-detail-toggle"
        aria-expanded={isDetailOpen}
        onClick={onToggleDetail}
      >
        {isDetailOpen ? 'Hide checks' : `${report.results.length} checks`}
      </button>

      {/* The simulation control lives on the validation bar rather than beside
          the generate button, because what it demonstrates is *this bar*: press
          it and the verdict two centimetres to the left flips from valid to
          invalid, computed rather than announced. Putting the cause next to the
          effect is the whole argument for its position. */}
      <button
        type="button"
        className={
          isSimulating
            ? 'validation-simulate validation-simulate-active'
            : 'validation-simulate'
        }
        disabled={!canSimulate}
        aria-pressed={isSimulating}
        title={
          canSimulate
            ? isSimulating
              ? 'Discard the simulated override and return to the canonical record'
              : 'Move one property across a shared wall and re-run the validation engine'
            : 'Available once the 3D cadastre is generated'
        }
        onClick={onToggleSimulation}
      >
        {isSimulating ? 'Restore valid geometry' : 'Simulate ownership conflict'}
      </button>
    </div>
  )
}

export default ValidationStatusBar
