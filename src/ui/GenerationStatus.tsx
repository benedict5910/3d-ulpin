import {
  getStageMessage,
  type GenerationVisuals,
} from '../animation/generationTimeline'

/**
 * The live status of the generation, shown across the top of the 3D viewer while
 * it runs.
 *
 * WHY A STATUS LINE AT ALL, WHEN THE ANIMATION IS RIGHT THERE
 * Because the animation shows *what is happening* and this says *what the system
 * calls it*. A judge watching a box grow out of a polygon can see that something
 * is being built; the words "Extruding 3D structure" then "Creating vertical
 * property units" tell them the system understands those as two different
 * operations on cadastral data, which is the claim being made. It converts a
 * pretty transition into a legible process — and it gives a presenter a caption
 * to speak along with, which is worth more in a live demo than any amount of
 * additional geometry.
 *
 * WHY IT APPEARS ONLY DURING THE TRANSITION
 * A permanent status strip is chrome. The two resting states already report
 * themselves — the generate bar says "source geometry loaded" or "3D cadastre
 * generated", and the pipeline card carries the full five steps. This exists for
 * the two seconds in between, when neither of those is telling the whole story,
 * and then it leaves.
 *
 * A pure view. The stage, its wording and the bar's fill are all computed by
 * `animation/generationTimeline.ts` from the master progress value; nothing here
 * decides anything.
 */

interface GenerationStatusProps {
  /** The transition at this instant. */
  visuals: GenerationVisuals
  /** Whether generation has been requested at all. */
  isGenerated: boolean
}

function GenerationStatus({ visuals, isGenerated }: GenerationStatusProps) {
  // Only while something is actually in flight.
  if (!isGenerated || visuals.isSettled) return null

  const percent = Math.round(visuals.progress * 100)

  return (
    // `role="status"` and `aria-live="polite"` so the stage changes are
    // announced as they happen rather than being a purely visual event.
    <div className="generation-status" role="status" aria-live="polite">
      <span className="generation-status-label">
        {getStageMessage(visuals.stage)}
        <span className="generation-status-percent">{percent}%</span>
      </span>

      {/* A determinate bar, driven by the same progress value as the scene, so
          it cannot disagree with what the viewer is watching. `scaleX` rather
          than `width` because a transform is composited and a width is a
          layout — sixty width changes a second on a bar sitting over a WebGL
          canvas is exactly the wrong place to spend a reflow. */}
      <span className="generation-status-track" aria-hidden="true">
        <span
          className="generation-status-fill"
          style={{ transform: `scaleX(${visuals.progress})` }}
        />
      </span>
    </div>
  )
}

export default GenerationStatus
