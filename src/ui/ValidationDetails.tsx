import type { TopologyReport } from '../validation/types'

/**
 * The validation details panel — every check, its verdict, and its figures.
 *
 * Opened from the status bar, closed by default. The bar answers "is this record
 * sound?"; this answers "how do you know?", which is the question a judge asks
 * second and the one a decorative validator cannot answer at all.
 *
 * Each row shows the rule's own sentence and the `details` record it produced —
 * the pairs tested, the disputed volume, the vertices outside the parcel.
 * **Nothing here is composed by this component.** It iterates over what the
 * engine returned. That is deliberate: a details panel that reworded its input
 * would be a second, unchecked account of the same finding, and the two would
 * eventually disagree.
 *
 * Failing checks are listed first. A panel that made a presenter scroll past
 * four passes to reach the failure would be actively unhelpful at the one moment
 * it matters.
 */

interface ValidationDetailsProps {
  /** The engine's report. */
  report: TopologyReport
}

/** Failures, then warnings, then passes. Stable within each group. */
const ORDER = { fail: 0, warning: 1, pass: 2 } as const

function ValidationDetails({ report }: ValidationDetailsProps) {
  const ordered = [...report.results].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status],
  )

  return (
    <section className="validation-details" aria-label="Validation checks">
      <h2 className="summary-title">
        Topology checks
        <span className="pipeline-count">
          {report.passCount}/{report.results.length}
        </span>
      </h2>

      <ol className="validation-list">
        {ordered.map((result) => (
          <li
            key={result.id}
            className={`validation-item validation-item-${result.status}`}
          >
            <p className="validation-item-message">{result.message}</p>

            {/* The figures the rule computed. A definition list rather than a
                sentence, because these are values a judge may want to read off
                and compare — and because the same shape serialises. */}
            <dl className="validation-item-details">
              {Object.entries(result.details).map(([key, value]) => (
                <div className="summary-row" key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ValidationDetails
