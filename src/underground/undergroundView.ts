/**
 * Underground view mode: how strongly each half of the model is drawn when the
 * presenter is looking below the ground datum.
 *
 * A **presentation** module. It decides opacity multipliers and interactivity,
 * nothing else — no elevation is changed, no bound is written, no record moves.
 * It is the third member of the family `scene/floorIsolation.ts` and
 * `simulation/conflictPresentation.ts` already belong to, and it follows their
 * rule exactly: emphasis values **multiply** with the others rather than
 * overriding them, so every combination of underground view, floor isolation,
 * conflict focus and exploded view is defined and none is a special case.
 *
 * THE THING THE MODE HAS TO MAKE OBVIOUS
 * A cadastral audience has to leave the demonstration able to say three
 * sentences without being told them:
 *
 *   above ground   y > 0
 *   ground datum   y = 0
 *   underground    y < 0
 *
 * So the mode does not merely "show the basement". It ghosts the tower back to
 * a wireframe, thins the ground plane until the datum reads as a *surface*
 * rather than a floor, and brings the four underground volumes to full
 * strength. What is left on screen is the relationship, with the datum as its
 * hinge — which is the one picture a 2D cadastre cannot draw.
 *
 * No React, no Three.js: plain arithmetic over one scalar, so the self-check
 * can run it under bare Node.
 */

/**
 * How much fill survives on an above-ground unit at full underground view.
 *
 * Lower than floor isolation's ghost (0.18): isolation keeps four floors as
 * *context for a fifth of the same kind*, while this pushes an entire
 * twenty-unit building back to make room for a layer it would otherwise
 * completely hide. At 0.10 the tower reads as a translucent envelope with its
 * edges intact — present enough to say "the basement is under this building",
 * faint enough that the basement is unambiguously the subject.
 */
const ABOVE_GROUND_FILL_SCALE = 0.1

/**
 * And how much of its edges survive. Much higher than the fill, deliberately.
 *
 * The same reasoning floor isolation uses: what should survive a ghosting is
 * the *structure*, drawn in line. Edges at 0.45 keep the tower's twenty boxes
 * legible as a stack, which is exactly the information the viewer needs in
 * order to locate the basement underneath it.
 */
const ABOVE_GROUND_EDGE_SCALE = 0.45

/**
 * How opaque the ground plane is at full underground view.
 *
 * Not zero. A ground plane that vanished would leave the basement floating in
 * space and would delete the datum from the picture at the exact moment the
 * picture is about it. At 0.16 the plane is still a plane — it still catches
 * the grid and still reads as the surface of the earth — and the volumes below
 * it are plainly visible through it. The datum stays; it stops being opaque.
 */
const GROUND_PLANE_UNDERGROUND_OPACITY = 0.16

/** The ground plane's ordinary opacity, when the view is above ground. */
const GROUND_PLANE_OPACITY = 1

/**
 * How much fill an underground volume has when the view is *not* underground.
 *
 * Non-zero, and this is a considered choice rather than a leftover. The
 * basement is part of the record from the moment the cadastre is generated, so
 * it is drawn from that moment — it does not spring into existence when a
 * button is pressed, because that would suggest the button creates it. What it
 * gets instead is enough presence to be seen as a shadow under the plan when
 * the camera is low, and nothing like the prominence it has in its own mode.
 */
const UNDERGROUND_RESTING_FILL_SCALE = 0.55

/** Linear interpolation, kept local so this module imports nothing. */
function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** How strongly one side of the datum should be drawn. */
export interface DatumEmphasis {
  /** Multiplier for fill opacity. */
  readonly fillScale: number
  /** Multiplier for edge opacity. */
  readonly edgeScale: number
  /**
   * Whether these volumes may be hovered and clicked.
   *
   * **The stated priority rule: the side of the datum you are looking at is the
   * side you can select on.** In underground view the four basement spaces are
   * the targets and the tower is context; out of it, the twenty units are the
   * targets and the basement is context.
   *
   * It is the same rule floor isolation states — "while a floor is isolated,
   * only that floor is a target" — applied to the other axis of the model, and
   * it is a decision rather than a fade: interactivity switches the moment the
   * mode is entered, not gradually as the opacity ramps, because a target whose
   * clickability flickered on the way in would be worse than one that simply
   * stops being a target.
   *
   * Without it, a ray cast at the ghosted ground plane would pass through and
   * select a basement space the presenter cannot see, and the inspector would
   * open a record for a property nobody pointed at.
   */
  readonly interactive: boolean
  /** Whether these volumes should cast shadows. Ghosts stop casting. */
  readonly castsShadow: boolean
}

/** Nothing suppressed: the resting state, and the identity of the transform. */
const FULL_EMPHASIS: DatumEmphasis = {
  fillScale: 1,
  edgeScale: 1,
  interactive: true,
  castsShadow: true,
}

/**
 * How strongly to draw the **above-ground** building, given the mode.
 *
 * At `amount === 0` this returns exactly `FULL_EMPHASIS`, which is what makes
 * entering and leaving the mode a smooth animation rather than a cut, and what
 * lets the same function drive every frame of it. It is also the guarantee that
 * with the mode off the scene renders precisely what it rendered before this
 * phase existed.
 */
export function getAboveGroundEmphasis(amount: number): DatumEmphasis {
  if (amount <= 0) return FULL_EMPHASIS

  return {
    fillScale: mix(1, ABOVE_GROUND_FILL_SCALE, amount),
    edgeScale: mix(1, ABOVE_GROUND_EDGE_SCALE, amount),
    interactive: false,
    castsShadow: false,
  }
}

/**
 * How strongly to draw the **underground** spaces, given the mode.
 *
 * The inverse ramp: from a resting presence to full strength, with
 * interactivity switching on as the mode is entered.
 */
export function getUndergroundEmphasis(amount: number): DatumEmphasis {
  if (amount <= 0) {
    return {
      fillScale: UNDERGROUND_RESTING_FILL_SCALE,
      edgeScale: 1,
      interactive: false,
      castsShadow: false,
    }
  }

  return {
    fillScale: mix(UNDERGROUND_RESTING_FILL_SCALE, 1, amount),
    edgeScale: 1,
    interactive: true,
    castsShadow: true,
  }
}

/**
 * How opaque the ground plane should be, given the mode.
 *
 * Interpolated rather than switched, because the plane is the datum and a datum
 * that blinked would read as a rendering fault at the exact moment the view is
 * making a claim about it.
 */
export function getGroundPlaneOpacity(amount: number): number {
  if (amount <= 0) return GROUND_PLANE_OPACITY
  return mix(GROUND_PLANE_OPACITY, GROUND_PLANE_UNDERGROUND_OPACITY, amount)
}

/** How long the underground transition takes, in milliseconds. */
export const UNDERGROUND_DURATION_MS = 620

/**
 * The wording shown while the underground view is active.
 *
 * Stated once, as a constant, for the same reason `EXPLODED_VIEW_NOTE` is: the
 * mode and the sentence that explains it cannot drift apart if there is only
 * one of the sentence.
 */
export const UNDERGROUND_VIEW_NOTE =
  'Below the ground datum — y = 0 is ground level; underground volumes are y < 0'

/** The three-line legend the mode puts on screen. Data, so the panel is dumb. */
export const DATUM_LEGEND: readonly { readonly label: string; readonly rule: string }[] =
  [
    { label: 'Above ground', rule: 'y > 0' },
    { label: 'Ground datum', rule: 'y = 0' },
    { label: 'Underground', rule: 'y < 0' },
  ]
