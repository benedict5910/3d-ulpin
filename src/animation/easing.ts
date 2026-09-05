/**
 * Easing curves and interval arithmetic — the whole of the project's animation
 * mathematics, in one dependency-free module.
 *
 * PHASE 9 ADDED ANIMATION, NOT AN ANIMATION LIBRARY.
 * The brief asked for a deliberate, polished 2D → 3D transition. That is a
 * *timing* problem: given one number between 0 and 1, decide how far along each
 * part of the sequence is. It is not a state-machine problem, a spring-physics
 * problem or a scene-graph problem, which is what React Spring, Framer Motion
 * and Theatre.js are for. Adding one of those would have brought a runtime, a
 * second reconciliation model and a second place animation state can live, in
 * exchange for functions that fit on one screen.
 *
 * So: no new dependencies in Phase 9, and the easing lives here rather than
 * being re-derived at each call site.
 *
 * Every function is pure, takes numbers and returns numbers, and has no React,
 * no Three.js and no DOM. That means the entire generation timeline built on top
 * of it (`generationTimeline.ts`) can be executed and checked in bare Node — the
 * same property that made the Phase 6 and Phase 8 self-checks possible.
 *
 * STABLE IDENTITIES MATTER HERE.
 * These are exported as module constants rather than created inline, because
 * they are passed to `useFadeProgress` as a dependency. An arrow function
 * written at a call site would be a new object on every render and would restart
 * the animation on every frame — the classic React animation bug. Exporting them
 * once makes that impossible.
 */

/** Clamp a value into `[0, 1]`. */
export function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Where `value` sits inside the window `[start, end]`, as `0`–`1`.
 *
 * **This is the function the whole generation sequence is built from.** One
 * master progress value runs 0 → 1 across the transition; each stage declares
 * the slice of that run it owns, and this turns the master value into that
 * stage's own local progress. Stages that overlap simply declare overlapping
 * windows, which is how the building can still be rising while the first floor
 * plates begin to appear.
 *
 * Outside the window it saturates rather than extrapolating: before `start` it
 * is 0, after `end` it is 1. That saturation is what makes the timeline
 * *deterministic* — asking for the visuals at progress 1 always gives exactly
 * the settled state, no matter how the frames happened to fall.
 *
 * A zero-width or inverted window returns 0 before `end` and 1 at or after it,
 * so a misconfigured stage degrades to an instant cut rather than to `NaN`.
 */
export function subProgress(value: number, start: number, end: number): number {
  if (end <= start) {
    return value >= end ? 1 : 0
  }
  return clamp01((value - start) / (end - start))
}

/** No easing. Used when a downstream timeline applies its own curves. */
export const LINEAR = (t: number): number => t

/**
 * Fast departure, gentle arrival.
 *
 * The right curve for something that *appears*: it commits immediately, so the
 * viewer sees the change begin the instant they click, and then settles rather
 * than stopping dead.
 */
export const EASE_OUT_CUBIC = (t: number): number => 1 - Math.pow(1 - t, 3)

/**
 * Gentle at both ends.
 *
 * The right curve for something that *moves between two resting places* — a
 * camera flying to a preset, floors sliding apart in the exploded view. Movement
 * that starts and stops abruptly reads as a jump cut; this reads as a decision.
 */
export const EASE_IN_OUT_CUBIC = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * A 0 → 1 → 0 pulse across the window, shaped as half a sine wave.
 *
 * Used once: to flash the source footprint at the very start of generation, so
 * the sequence visibly *begins at the 2D polygon* rather than simply beginning.
 * A pulse rather than a step because the footprint has to end up back where it
 * started — it is being pointed at, not changed.
 */
export function pulse(t: number): number {
  return Math.sin(Math.PI * clamp01(t))
}

/** Linear interpolation from `from` to `to`. */
export function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}
