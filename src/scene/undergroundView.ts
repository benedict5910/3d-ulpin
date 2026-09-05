/**
 * Underground view: bringing the subsurface forward without deleting the
 * surface.
 *
 * WHAT IT IS FOR
 * A basement is, by construction, the one part of a building nobody can see. The
 * ground plane that makes the rest of the scene legible — the thing the building
 * visibly stands on — is also an opaque lid over the entire below-ground half of
 * the register. A presenter who wants to say "and these four volumes are beneath
 * it" has no picture to point at.
 *
 * So one control lifts the lid: the surface structure fades to a ghost, the
 * ground plane becomes translucent, the basement volumes are left at full
 * strength, and the camera drops to the datum. It is the below-ground twin of
 * floor isolation, and it is built the same way and for the same reasons.
 *
 * WHY GHOSTING RATHER THAN HIDING — THE SAME ARGUMENT, MORE SHARPLY
 * `floorIsolation.ts` makes this case for one floor among five. Below ground it
 * is stronger still. Four boxes floating in a black void tell a viewer nothing:
 * not how deep they are, not that they sit under a building, not that their
 * ceiling *is* the ground the building stands on. **The relationship to the
 * surface is the entire content of the picture.** Hide the surface and the
 * remaining image says "here are four boxes"; ghost it and the image says "here
 * is what is underneath that building, and here is where the ground is".
 *
 * The brief for this phase put it directly: do not simply hide all context. A
 * judge must still understand where the basement sits relative to the parcel and
 * the building above it.
 *
 * HOW IT COMPOSES WITH EVERYTHING ELSE — BY MULTIPLICATION, LIKE THE REST
 *
 *     explosion          decides WHERE a volume is drawn            (position)
 *     floor isolation    decides HOW STRONGLY, per floor            (appearance)
 *     conflict focus     decides HOW STRONGLY, per conflict subject (appearance)
 *     underground view   decides HOW STRONGLY, per TIER             (appearance)
 *
 * The three appearance transforms multiply, so every combination is defined and
 * none is a special case: isolate floor 3 *and* switch to underground view and
 * both sets of ghosts compose, with floor 3 the strongest thing above ground and
 * the basement the strongest thing below it. Not one of the four modules imports
 * another.
 *
 * WHAT THIS MODULE IS NOT
 * It moves nothing, hides nothing, and does not touch the cadastral model. It
 * returns appearance scalars. The basement's volumes are at −3 → 0 m whether this
 * view is on or off; what changes is how much light falls on the things in front
 * of them. See ARCHITECTURE §10.0 for the separation this belongs to.
 *
 * No React, no Three.js.
 */

/** How long the underground view takes to arrive and leave, in milliseconds. */
export const UNDERGROUND_DURATION_MS = 620

/**
 * What the surface structure's fill opacity is multiplied by, fully underground.
 *
 * An eighth — slightly lower than floor isolation's tenth is high, because there
 * is more of it: five floors of ghost in front of one basement level would
 * accumulate into a haze if each were as strong as a single ghosted floor.
 */
const SURFACE_FILL_SCALE = 0.08

/**
 * And what its **edges** are multiplied by.
 *
 * Deliberately six times the fill, the same ratio floor isolation uses and for
 * the same reason: what has to survive is the building's *structure*, drawn in
 * line, because that outline is what tells the viewer the basement is under a
 * building rather than under nothing.
 */
const SURFACE_EDGE_SCALE = 0.5

/**
 * What the ground plane's opacity is multiplied by, fully underground.
 *
 * Not zero. A ground plane that vanished would take the horizon with it and the
 * scene would lose its sense of up; at a fifth it still reads as a surface, and
 * the basement reads as being *seen through* it, which is exactly the
 * relationship being shown. This is the closest thing the prototype has to a
 * cutaway, and a cutaway that removed the ground would be a diagram of four boxes.
 */
const GROUND_FILL_SCALE = 0.2

/**
 * What the basement volumes' fill is multiplied by when the view is **off**.
 *
 * One. The basement is not dimmed when the view is off, and that is deliberate:
 * it is not hidden by an opacity trick, it is hidden **by the ground**, which is
 * what hides a real basement. Nothing here fades the subsurface in and out; the
 * only thing that changes is what is in front of it.
 */
const BASEMENT_RESTING_SCALE = 1

/** How a tier should be drawn, given how far the underground view has arrived. */
export interface TierEmphasis {
  /** Multiplier for fill opacity. `1` when the view is off. */
  readonly fillScale: number
  /** Multiplier for edge opacity. `1` when the view is off. */
  readonly edgeScale: number
  /**
   * Whether volumes in this tier may be hovered and clicked.
   *
   * The stated priority rule, matching floor isolation's: **while the
   * underground view is on, only underground volumes are targets.** A ghost is
   * context, and clicking one would open the record of a property the presenter
   * has just deliberately pushed behind the ground.
   *
   * Like isolation's, it is a decision rather than a fade — it switches the
   * moment the view is requested, not at some threshold part-way through the
   * transition, because a target whose clickability flickered would be worse than
   * one that simply stops being a target.
   */
  readonly interactive: boolean
  /**
   * Whether volumes in this tier should cast shadows.
   *
   * Ghosts stop casting: a barely visible box throwing a solid shadow reads as a
   * rendering fault. The basement never casts in either state — it is below the
   * only shadow-casting light's ground plane, so its shadow would fall nowhere
   * meaningful.
   */
  readonly castsShadow: boolean
}

/** Everything at full strength: the resting state, and the transform's identity. */
const FULL_EMPHASIS: TierEmphasis = {
  fillScale: 1,
  edgeScale: 1,
  interactive: true,
  castsShadow: true,
}

/** Linear interpolation, kept local so this module imports nothing. */
function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * How strongly to draw the **above-ground** structure.
 *
 * @param amount how far the underground view has arrived, `0`–`1`. At `0` the
 *   result is indistinguishable from "the view is off", which is what lets one
 *   function drive every frame of the transition as well as both resting states —
 *   and what guarantees that with the control untouched, this phase renders the
 *   scene exactly as Phase 10 left it.
 */
export function getSurfaceEmphasis(amount: number): TierEmphasis {
  if (amount <= 0) return FULL_EMPHASIS

  return {
    fillScale: mix(1, SURFACE_FILL_SCALE, amount),
    edgeScale: mix(1, SURFACE_EDGE_SCALE, amount),
    interactive: false,
    castsShadow: false,
  }
}

/**
 * How strongly to draw the **below-ground** volumes.
 *
 * Constant, and that is the point — see `BASEMENT_RESTING_SCALE`. The basement is
 * always drawn at full strength; the underground view changes what stands in
 * front of it, not what it is made of. Returning an emphasis object anyway, rather
 * than having callers special-case the basement, keeps both tiers placed by the
 * same shaped call and gives a future "dim the deeper levels" decision an obvious
 * home.
 *
 * Clickability is the one thing that does vary. Below ground is targetable in
 * both states: a presenter who has switched the ground translucent should be able
 * to click a parking bay, and one who has not cannot reach it through the ground
 * anyway, because the ray stops at whatever is in front.
 */
export function getBasementEmphasis(_amount: number): TierEmphasis {
  return {
    fillScale: BASEMENT_RESTING_SCALE,
    edgeScale: 1,
    interactive: true,
    castsShadow: false,
  }
}

/**
 * How opaque the ground plane should be, `0`–`1`.
 *
 * The one scalar that makes the below-ground half of the register visible at all.
 * Multiplied into the plane's material opacity by `Ground.tsx`, which decides
 * nothing else.
 */
export function getGroundOpacityScale(amount: number): number {
  return mix(1, GROUND_FILL_SCALE, amount)
}

/**
 * How far below the horizon the camera may be orbited, in radians of polar angle.
 *
 * `OrbitControls` measures the polar angle from straight up, so `π/2` is the
 * horizon and anything larger is below it. The scene has always capped just short
 * of the horizon (`π / 2.05`) to stop the camera dropping through the ground
 * plane and showing the model from underneath, which — with an opaque ground and
 * nothing below it — was a view of nothing.
 *
 * With a basement there **is** something below it, and looking up at the
 * underside of a parcel is a legitimate thing to want. So the cap opens as the
 * underground view arrives, and closes again when it leaves. It is interpolated
 * rather than switched so that a camera already orbited low does not jump when
 * the mode is turned off; the controller clamps it back over the same ramp the
 * fade uses.
 *
 * The lower limit stops short of straight-up (`π`) for the same reason the top
 * view stops short of straight-down: an orbit controller with the eye exactly on
 * the axis has no unambiguous "up" and snaps through a rotation at the first
 * mouse movement.
 */
export function getMaxPolarAngle(amount: number): number {
  const closed = Math.PI / 2.05
  const open = Math.PI * 0.92
  return mix(closed, open, amount)
}

/**
 * The note shown wherever the underground view is active. Stated once.
 *
 * It says the one thing an audience must not be left to assume — that the
 * surface has been made translucent for the purpose of looking at what is under
 * it, and that nothing about the record has changed. Same role as
 * `EXPLODED_VIEW_NOTE`, same reason it lives beside the transform rather than in
 * a component.
 */
export const UNDERGROUND_VIEW_NOTE =
  'Surface ghosted for visibility — cadastral geometry unchanged'
