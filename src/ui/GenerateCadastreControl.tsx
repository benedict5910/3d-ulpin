/**
 * The "Generate 3D Cadastre" control — the one deliberate action in the app.
 *
 * WHY A BUTTON AT ALL
 * Everything this button does could happen at page load; the units are pure
 * data and cost nothing to build. It exists because the *point* of the project
 * is that a 2D cadastral record can be transformed into a 3D one, and a
 * transformation nobody performs is indistinguishable from two pictures drawn
 * side by side. Making the user press it turns a claim into a demonstration:
 * before, a plot with a surveyed outline and nothing above it; after, twenty
 * identified vertical properties standing on that same outline.
 *
 * It also makes the interface honest about what the prototype is. The building
 * is *generated* from the footprint. Showing it fully formed on arrival would
 * quietly suggest the 3D model is itself source data, which is the exact
 * misunderstanding the project is built to dispel.
 *
 * PHASE 9: THE BUTTON DISABLES ITSELF WHILE THE TRANSITION RUNS.
 * Two seconds is long enough to click again. A second press during the sequence
 * would do nothing (the flag is already set) which is worse than it sounds: a
 * control that visibly accepts a press and produces no change reads as broken.
 * It goes to a `generating` state instead, and says so.
 *
 * "Reset to source" appears only once the model has settled, for the same
 * reason — resetting mid-animation is well defined in the code (the progress
 * snaps to zero) but it asks the audience to watch a half-built building vanish,
 * which is not a thing this demo ever needs to show.
 *
 * The control sits over the 3D viewer rather than in a side panel because the
 * viewer is what changes when it is pressed.
 */

interface GenerateCadastreControlProps {
  /** Whether generation has been requested. */
  isGenerated: boolean
  /** Whether the generated model has finished arriving. */
  isSettled: boolean
  /** Perform the generation. */
  onGenerate: () => void
  /** Return to the source state, so the transformation can be shown again. */
  onReset: () => void
  /** Footprint area in m², quoted before generation so the input is visible. */
  footprintAreaSqM: number
  /** How many units the generation produced. Quoted afterwards. */
  unitCount: number
  /** Floors in the generated structure. */
  floorCount: number
}

function GenerateCadastreControl({
  isGenerated,
  isSettled,
  onGenerate,
  onReset,
  footprintAreaSqM,
  unitCount,
  floorCount,
}: GenerateCadastreControlProps) {
  // SOURCE STATE — the input is described, and the action offered.
  if (!isGenerated) {
    return (
      <div className="generate-bar" role="group" aria-label="Cadastre generation">
        <p className="generate-caption">
          Source geometry loaded — {Math.round(footprintAreaSqM)} m&sup2; footprint
          on the parcel. No 3D structure yet.
        </p>
        <button type="button" className="generate-button" onClick={onGenerate}>
          Generate 3D Cadastre
        </button>
      </div>
    )
  }

  // TRANSITION — the action is spent. The button stays in place, disabled, so
  // the bar does not change size mid-animation and move the reset button under
  // the presenter's cursor.
  if (!isSettled) {
    return (
      <div className="generate-bar" role="group" aria-label="Cadastre generation">
        <p className="generate-caption">
          Generating vertical cadastre from the footprint polygon…
        </p>
        <button type="button" className="generate-button" disabled>
          Generating…
        </button>
      </div>
    )
  }

  // GENERATED STATE — the outcome is reported, and the demo can be run again.
  return (
    <div className="generate-bar" role="group" aria-label="Cadastre generation">
      {/* `role="status"` so the outcome is announced once, rather than the
          whole bar being re-read. */}
      <p className="generate-caption generate-caption-done" role="status">
        <span className="status-dot" aria-hidden="true" />
        3D cadastre generated — {floorCount} floors, {unitCount} vertical property
        units from the footprint polygon
      </p>
      <button type="button" className="generate-reset" onClick={onReset}>
        Reset to source
      </button>
    </div>
  )
}

export default GenerateCadastreControl
