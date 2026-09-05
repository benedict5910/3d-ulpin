import { CAMERA_PRESETS, type CameraPresetId } from '../scene/cameraPresets'
import { EXPLODED_VIEW_NOTE, type ExplodeMode } from '../scene/explodedView'
import {
  DATUM_LEGEND,
  UNDERGROUND_VIEW_NOTE,
} from '../underground/undergroundView'

/**
 * The presentation controls: four camera presets and the explosion level.
 *
 * WHY THESE TWO THINGS SHARE ONE CONTROL GROUP
 * They answer the same question — *how do I look at this* — as opposed to the
 * generate bar, which answers *what is on screen*. Keeping the two kinds of
 * control physically separate means a presenter never has to hunt: the thing
 * that changes the model is at the bottom of the viewer, the things that change
 * the view are at the top right, and nothing in either group can be mistaken for
 * the other.
 *
 * SUBPHASE A: THE TOGGLE BECAME A THREE-STEP CONTROL
 * A boolean could only say "apart or not". There are now two *levels* of
 * separation and they are ordered — units cannot disperse from a floor that has
 * not itself been lifted clear — so the natural control is a segmented one that
 * shows the ladder:
 *
 *     Stacked  →  Floors  →  Units
 *
 * Three buttons, mutually exclusive, in order. That both reads as a progression
 * and gives a presenter a fixed sequence of clicks to rehearse, which a toggle
 * plus a modifier would not.
 *
 * WHY CONTROLS ARE DISABLED RATHER THAN HIDDEN
 * "Selected Unit" before anything is selected, and the explosion levels before
 * anything is generated, are all disabled and still visible. A control that
 * appears and disappears makes the interface feel unstable and moves the buttons
 * beside it — during a live demo that is a presenter clicking the wrong thing. A
 * disabled control also *teaches*: it tells the viewer that selecting a unit will
 * unlock a view of it, before they have done so.
 *
 * A pure view. It reports which preset was pressed and which explosion level was
 * chosen; `App` decides what either means.
 */

/**
 * The three levels, in order, with the wording shown on each button.
 *
 * Declared here rather than in `explodedView.ts` because the *labels* are an
 * interface decision while the *transform* is geometry — the same reason the
 * camera presets keep their maths and their captions apart.
 */
const EXPLODE_LEVELS: readonly {
  id: ExplodeMode
  label: string
  title: string
}[] = [
  {
    id: 'none',
    label: 'Stacked',
    title: 'The building as built — floors and units in their true positions',
  },
  {
    id: 'floors',
    label: 'Floors',
    title: 'Separate the floors to show the ownership layers',
  },
  {
    id: 'units',
    label: 'Units',
    title: 'Separate each floor into its individual property volumes',
  },
]

interface ViewControlsProps {
  /** Floor levels available to isolate, ascending. Derived from the model. */
  floorLevels: readonly number[]
  /** The isolated floor's 1-based level, or `null` for all floors. */
  isolatedFloor: number | null
  /** Isolate a floor, or `null` to show them all. */
  onSelectIsolatedFloor: (floorLevel: number | null) => void
  /** Which preset was most recently applied — shown as the current view. */
  activePreset: CameraPresetId
  /** Fly the camera to a preset. Pressing the active one again re-frames it. */
  onSelectPreset: (preset: CameraPresetId) => void
  /** Whether a unit is selected, which gates the "Selected Unit" preset. */
  hasSelection: boolean
  /** The current explosion level. */
  explodeMode: ExplodeMode
  /** Choose an explosion level. */
  onSelectExplodeMode: (mode: ExplodeMode) => void
  /**
   * Whether the generated model has settled.
   *
   * Gates the explosion levels: exploding a building that is still assembling
   * itself would run two transforms on the same meshes at once, and neither
   * animation would read correctly.
   */
  isSettled: boolean
  /**
   * Whether the conflict presentation currently owns the view.
   *
   * It gates the explosion levels, and that is a considered restriction rather
   * than an oversight. The conflict overlay draws a disputed *region* — a box
   * that exists only where two property volumes interpenetrate. Separate those
   * two volumes on screen and the region no longer lies inside either of them: it
   * would hang in the gap between two boxes that visibly do not touch, which
   * states the opposite of what it means. Rather than draw something false or
   * silently hide it, the two presentations take turns.
   *
   * Disabled rather than hidden, with an explanation in the tooltip, exactly like
   * every other unavailable control here — and the previous explosion level is
   * restored when the conflict is dismissed, so nothing the presenter had set up
   * is lost.
   */
  conflictFocusActive: boolean
  /**
   * Whether the presenter is looking below the ground datum.
   *
   * A toggle rather than a third member of the explosion group or a sixth floor
   * button, because it is a different *kind* of setting: the explosion group
   * chooses how far apart the layers are drawn and the floor group chooses
   * which layer is in focus, while this chooses **which side of the datum the
   * model is being read from**. Folding it into either would make one control
   * answer two questions.
   */
  isUndergroundView: boolean
  /** Enter or leave the underground view. */
  onToggleUndergroundView: () => void
  /** Whether the model has an underground layer at all. Gates the toggle. */
  hasUnderground: boolean
}

function ViewControls({
  floorLevels,
  isolatedFloor,
  onSelectIsolatedFloor,
  activePreset,
  onSelectPreset,
  hasSelection,
  explodeMode,
  onSelectExplodeMode,
  isSettled,
  conflictFocusActive,
  isUndergroundView,
  onToggleUndergroundView,
  hasUnderground,
}: ViewControlsProps) {
  return (
    <div className="view-controls" role="group" aria-label="View controls">
      <div className="view-preset-group" role="group" aria-label="Camera presets">
        {CAMERA_PRESETS.map((preset) => {
          // Two presets depend on something being chosen first. Both stay
          // visible and disabled rather than appearing and disappearing — see
          // the note above.
          const unmetRequirement =
            preset.id === 'unit' && !hasSelection
              ? 'Select a property unit first'
              : preset.id === 'floor' && isolatedFloor === null
                ? 'Isolate a floor first'
                : null

          return (
            <button
              key={preset.id}
              type="button"
              className="view-preset"
              // The current view is carried by `aria-pressed` as well as by the
              // class, so the state is not conveyed by colour alone.
              aria-pressed={activePreset === preset.id}
              disabled={unmetRequirement !== null}
              title={unmetRequirement ?? `Camera: ${preset.label}`}
              onClick={() => onSelectPreset(preset.id)}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div
        className="view-preset-group view-explode-group"
        role="group"
        aria-label="Exploded view level"
      >
        {EXPLODE_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className="view-preset"
            aria-pressed={explodeMode === level.id}
            disabled={!isSettled || conflictFocusActive}
            title={
              !isSettled
                ? 'Available once the 3D cadastre is generated'
                : conflictFocusActive
                  ? 'Unavailable while a conflict is being presented — the disputed volume only exists where the two properties actually overlap'
                  : level.title
            }
            onClick={() => onSelectExplodeMode(level.id)}
          >
            {level.label}
          </button>
        ))}
      </div>

      {/* Floor isolation. A segmented control like the two above it, because it
          is the same kind of thing: one setting with a small set of ordered
          values. "All" first so the resting state is the leftmost, which is
          where the resting state is in both other groups.

          The levels come from the model rather than being written out, so a
          twelve-storey building gets twelve buttons with no edit here. */}
      <div
        className="view-preset-group view-floor-group"
        role="group"
        aria-label="Floor isolation"
      >
        <button
          type="button"
          className="view-preset"
          aria-pressed={isolatedFloor === null}
          disabled={!isSettled}
          title={isSettled ? 'Show every floor' : 'Available once the 3D cadastre is generated'}
          onClick={() => onSelectIsolatedFloor(null)}
        >
          All
        </button>
        {floorLevels.map((level) => (
          <button
            key={level}
            type="button"
            className="view-preset"
            aria-pressed={isolatedFloor === level}
            disabled={!isSettled}
            title={
              isSettled
                ? `Isolate floor ${level} — the others become ghosted context`
                : 'Available once the 3D cadastre is generated'
            }
            onClick={() => onSelectIsolatedFloor(level)}
          >
            F{level}
          </button>
        ))}
      </div>

      {/* Below the datum. Its own group, one button, sitting after the floor
          isolation group because it is the widest-scoped of the three: floors
          narrow the model, this changes which half of it you are reading.

          Disabled rather than hidden when the model has no basement or has not
          been generated, like every other unavailable control here, with the
          reason in the tooltip. */}
      <div
        className="view-preset-group view-underground-group"
        role="group"
        aria-label="Ground datum"
      >
        <button
          type="button"
          className="view-preset view-preset-underground"
          aria-pressed={isUndergroundView}
          disabled={!isSettled || !hasUnderground}
          title={
            !isSettled
              ? 'Available once the 3D cadastre is generated'
              : !hasUnderground
                ? 'This model has no underground layer'
                : isUndergroundView
                  ? 'Return to the above-ground view'
                  : 'Look below the ground datum — the building ghosts back and the basement volumes come forward'
          }
          onClick={onToggleUndergroundView}
        >
          Underground
        </button>
      </div>

      {/* The datum rule, shown while the underground view is active. Three
          lines, because the point of the mode is the relationship between them
          and a viewer should not have to infer it from box positions. Stated as
          a constant in `underground/undergroundView.ts` so the mode and its
          explanation cannot drift apart. */}
      {isUndergroundView && isSettled && hasUnderground && (
        <div className="view-datum-legend" role="note">
          <ul className="datum-legend-list">
            {DATUM_LEGEND.map((entry) => (
              <li key={entry.label} className="datum-legend-row">
                <span className="datum-legend-label">{entry.label}</span>
                <span className="datum-legend-rule">{entry.rule}</span>
              </li>
            ))}
          </ul>
          <p className="view-note">{UNDERGROUND_VIEW_NOTE}</p>
        </div>
      )}

      {/* The honesty line. It appears only while an explosion is active, and it
          says the one thing a cadastral audience must not be left to assume: the
          separation on screen is a way of drawing the record, not the record.
          Stated as a constant in `explodedView.ts` so the transform and its
          disclaimer cannot drift apart. */}
      {explodeMode !== 'none' && isSettled && (
        <p className="view-note" role="note">
          {EXPLODED_VIEW_NOTE}
        </p>
      )}
    </div>
  )
}

export default ViewControls
