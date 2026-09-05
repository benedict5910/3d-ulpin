import { useEffect, useRef, useState } from 'react'

import { EASE_OUT_CUBIC } from '../animation/easing'

/**
 * A `0` ↔ `1` ramp that follows a boolean, on a `requestAnimationFrame` loop.
 *
 * **This is the only animation driver in the application.** Two things use it —
 * the 2D → 3D generation sequence and the exploded-view toggle — and they
 * differ only in the options they pass. Everything else about how those two look
 * over time is derived from the number this returns, by pure functions in
 * `animation/`.
 *
 * That arrangement is the reason Phase 9 added no animation dependency. React
 * Spring or Framer Motion would each supply a driver of about this size plus a
 * declarative layer this project has no use for, since the values being animated
 * are mesh scales and material opacities rather than DOM styles.
 *
 * WHY `requestAnimationFrame` AND NOT R3F's `useFrame`
 * `useFrame` only works inside a `<Canvas>`, which would tie both animations to
 * the 3D viewport. The same progress value drives HTML — the status line, the
 * progress bar, the pipeline card — as well as meshes, so it is owned above
 * both. Plain rAF also means this hook has no Three.js and no R3F import at all.
 *
 * WHY THE RAMP IS DISTANCE-SCALED
 * If the flag flips back before the ramp finishes, the return journey is
 * shortened in proportion to how far it actually has to travel. Without that, a
 * toggle pressed twice in quick succession takes the full duration to move a
 * tenth of the way, which reads as the interface having stopped responding.
 *
 * ACCESSIBILITY
 * `prefers-reduced-motion` is honoured by jumping straight to the target. A user
 * who has asked their system for less movement gets the destination state
 * immediately, with nothing else about the workflow changed.
 *
 * @param active whether the ramp should be heading to `1` or back to `0`.
 * @param options timing and shape. `easing` **must** be a stable reference —
 *   pass one of the module constants from `animation/easing.ts`, never an
 *   arrow function written at the call site, which would be a new object every
 *   render and would restart the animation on every frame.
 * @returns progress in `[0, 1]`.
 */
export interface FadeProgressOptions {
  /** How long the `0 → 1` direction takes, in milliseconds. */
  durationMs?: number
  /**
   * How long the `1 → 0` direction takes, in milliseconds.
   *
   * Defaults to `0`, which means **snap**. That is right for the generation
   * reset: returning to the source state should be instantaneous and total, so a
   * presenter can run the demo again immediately, and a reverse animation would
   * suggest the building is being *un-generated* rather than discarded. The
   * exploded view passes a real duration, because there both directions are
   * movements between two states the user is looking at.
   */
  reverseDurationMs?: number
  /** The curve. Must be a stable reference. */
  easing?: (t: number) => number
}

export function useFadeProgress(
  active: boolean,
  options: FadeProgressOptions = {},
): number {
  const { durationMs = 620, reverseDurationMs = 0, easing = EASE_OUT_CUBIC } = options

  const [progress, setProgress] = useState(active ? 1 : 0)

  /**
   * The last committed progress, readable without being a dependency.
   *
   * The animation effect needs to know *where it is starting from* when the flag
   * flips, but must not re-run every time progress changes — that would restart
   * the ramp on its own output. A ref updated by a separate effect gives the
   * value without the dependency.
   */
  const progressRef = useRef(progress)
  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    const target = active ? 1 : 0
    const from = progressRef.current
    if (from === target) return

    const duration = active ? durationMs : reverseDurationMs

    // `matchMedia` is absent in a non-browser render (tests, SSR); optional
    // chaining keeps the hook usable there rather than throwing.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    if (prefersReducedMotion || duration <= 0) {
      setProgress(target)
      return
    }

    // Scale the time by how far there actually is to go — see the note above.
    const scaledDuration = duration * Math.abs(target - from)
    let frameId = 0
    const startedAt = performance.now()

    const step = (now: number) => {
      const linear =
        scaledDuration <= 0 ? 1 : Math.min(1, (now - startedAt) / scaledDuration)
      setProgress(from + (target - from) * easing(linear))

      if (linear < 1) {
        frameId = requestAnimationFrame(step)
      }
    }

    frameId = requestAnimationFrame(step)

    // Cancel on unmount or on the flag flipping back, so an interrupted ramp
    // cannot leave a frame in flight that overwrites the new state.
    return () => cancelAnimationFrame(frameId)
  }, [active, durationMs, reverseDurationMs, easing])

  return progress
}
