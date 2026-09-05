import { countCompletedSteps, type PipelineStep } from '../workflow/pipelineSteps'

/**
 * The 2D-to-3D pipeline, shown as a five-step list.
 *
 * A pure view. Every step, its state and its detail line are computed by
 * `workflow/pipelineSteps.ts` from the model; this component decides only how
 * they look. It cannot show a step as complete that the model says is pending,
 * which is the property that makes the list worth trusting.
 *
 * The steps read top to bottom as source → transformation → result, which is the
 * same order the 3D viewer draws them in, the same order the generation
 * animation runs, and the same order the phase's explanation goes. Four tellings
 * of one sequence, deliberately aligned.
 *
 * PHASE 9 ADDED THE `active` APPEARANCE, SUBPHASE C ADDED `failed`.
 * A step under way gets a filled-but-hollow marker with a slow pulse; a failed
 * one gets a solid red marker with a ring. Four states need four appearances
 * that survive being seen on a projector — hence differences of *shape* as well
 * as colour, and a `visually-hidden` word for each so the meaning never rests on
 * either.
 */

interface PipelineStatusProps {
  /** The steps, already derived. */
  steps: PipelineStep[]
  /** A one-line description of what the system is doing right now. */
  statusMessage: string
}

/** The word a screen reader hears for each state. */
const STATE_WORDS: Record<PipelineStep['state'], string> = {
  complete: ' — complete',
  active: ' — in progress',
  pending: ' — pending',
  failed: ' — failed',
}

function PipelineStatus({ steps, statusMessage }: PipelineStatusProps) {
  const completed = countCompletedSteps(steps)

  return (
    <section className="pipeline" aria-label="Cadastre pipeline status">
      <h2 className="summary-title">
        Pipeline
        <span className="pipeline-count">
          {completed}/{steps.length}
        </span>
      </h2>

      {/* The current state of the system in words, above the list rather than
          inside it: the list says what the steps *are*, this says where the
          system is. It is present in both resting states as well as during the
          transition, so the card always answers "what now?". */}
      <p className="pipeline-status-line">{statusMessage}</p>

      {/* An ordered list, because the order is the meaning. `aria-live` so a
          screen reader announces the steps as they change rather than leaving
          the change silent. */}
      <ol className="pipeline-list" aria-live="polite">
        {steps.map((step) => (
          <li key={step.id} className={`pipeline-step pipeline-step-${step.state}`}>
            {/* The marker carries the state visually; the text below carries it
                for assistive technology, so the meaning never rests on colour
                or on a glyph alone. */}
            <span className="pipeline-marker" aria-hidden="true" />
            <span className="pipeline-body">
              <span className="pipeline-label">{step.label}</span>
              <span className="pipeline-detail">{step.detail}</span>
            </span>
            <span className="visually-hidden">{STATE_WORDS[step.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default PipelineStatus
