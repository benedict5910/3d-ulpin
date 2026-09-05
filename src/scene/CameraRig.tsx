import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

import { EASE_IN_OUT_CUBIC } from '../animation/easing'
import { CAMERA_FLIGHT_MS, type CameraView } from './cameraPresets'

/**
 * Flies the camera to a requested view, then gives the controls back.
 *
 * WHY THIS IS A COMPONENT INSIDE THE CANVAS AND NOT A PROP ON `<OrbitControls>`
 * Camera motion is per-frame work. React re-renders when state changes;
 * `useFrame` runs on the render loop, which is the only place a smooth
 * interpolation can live without turning every animation frame into a React
 * commit. This component holds *no state at all* — its entire working memory is
 * refs — so a camera flight causes zero re-renders of the scene graph while it
 * is in progress.
 *
 * WHY IT OWNS THE ORBIT TARGET
 * Phase 8 passed `target` to `<OrbitControls>` as a prop. That cannot coexist
 * with an animated target: React re-applies the declarative prop on each render
 * and would yank the target back mid-flight. So the prop is gone and this
 * component is the single owner of `controls.target` — set once on mount, and
 * thereafter only by a flight. Everything the user does with the mouse still
 * goes straight to OrbitControls, untouched.
 *
 * HOW A FLIGHT DOES NOT FIGHT THE USER
 * `controls.enabled` is set to `false` for the duration and restored on arrival.
 * Without it, a user who nudges the mouse mid-flight gets two things writing to
 * the camera on the same frame, which reads as a stutter. Disabling for ~850 ms
 * is invisible in use — the camera is already moving — and it guarantees the
 * hand-off back to free orbit happens at a well-defined moment, from a known
 * position, with the target where the flight left it. That is what "preserve
 * OrbitControls after the motion" means in practice.
 *
 * REQUESTS ARE TOKENS, NOT VALUES
 * A preset can be pressed twice, and the second press must re-run the flight
 * even though the destination is identical. Comparing views would swallow it.
 * The request carries a monotonically increasing token; this component acts when
 * the token changes and ignores everything else.
 */

/**
 * The minimal surface of OrbitControls this component touches.
 *
 * Typed structurally rather than by importing the class: R3F types
 * `state.controls` loosely, and pulling the concrete `OrbitControls` type out of
 * `three-stdlib` would add an import path this project does not otherwise
 * depend on for the sake of three members.
 */
interface OrbitControlsLike {
  target: Vector3
  enabled: boolean
  update: () => void
}

/** A camera flight request. The token is what makes a repeat press re-fire. */
export interface CameraRequest {
  /** Increments on every request, including repeats of the same preset. */
  readonly token: number
  /** Where to fly to. */
  readonly view: CameraView
}

interface CameraRigProps {
  /** The current request, or `null` before the first one. */
  request: CameraRequest | null
  /** Where the orbit target starts, before any preset is pressed. */
  initialTarget: readonly [number, number, number]
}

/** An in-flight camera move. Refs only — never state. */
interface Flight {
  readonly fromPosition: Vector3
  readonly fromTarget: Vector3
  readonly toPosition: Vector3
  readonly toTarget: Vector3
  readonly startedAt: number
}

function CameraRig({ request, initialTarget }: CameraRigProps) {
  const camera = useThree((state) => state.camera)
  // `makeDefault` on <OrbitControls> is what publishes it here. It appears a
  // moment after mount, so every read below tolerates `null`.
  //
  // The double assertion is deliberate. R3F types `state.controls` as a bare
  // `EventDispatcher`, which shares no members with the three used here, so a
  // direct cast is rejected as "insufficiently overlapping" — correctly, since
  // the compiler has no way to know `makeDefault` put an OrbitControls there.
  // Going through `unknown` says that explicitly rather than widening the
  // structural type until it accidentally fits.
  const controls = useThree((state) => state.controls) as unknown as
    | OrbitControlsLike
    | null

  const flight = useRef<Flight | null>(null)
  const lastToken = useRef<number>(-1)
  const targetInitialised = useRef(false)

  useFrame(() => {
    if (controls === null) return

    // One-time hand-off: the orbit target starts on the building rather than at
    // the world origin. Done here rather than in an effect because `controls`
    // may not exist yet when effects first run.
    if (!targetInitialised.current) {
      controls.target.set(initialTarget[0], initialTarget[1], initialTarget[2])
      controls.update()
      targetInitialised.current = true
    }

    // A new request: capture where we are and begin.
    if (request !== null && request.token !== lastToken.current) {
      lastToken.current = request.token

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

      const toPosition = new Vector3(...request.view.position)
      const toTarget = new Vector3(...request.view.target)

      if (prefersReducedMotion) {
        // Same destination, no journey. A user who asked for less motion still
        // gets the preset; they simply arrive.
        camera.position.copy(toPosition)
        controls.target.copy(toTarget)
        controls.enabled = true
        controls.update()
        flight.current = null
        return
      }

      flight.current = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition,
        toTarget,
        startedAt: performance.now(),
      }
      controls.enabled = false
    }

    const current = flight.current
    if (current === null) return

    const linear = Math.min(1, (performance.now() - current.startedAt) / CAMERA_FLIGHT_MS)
    const eased = EASE_IN_OUT_CUBIC(linear)

    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased)
    controls.target.lerpVectors(current.fromTarget, current.toTarget, eased)
    controls.update()

    if (linear >= 1) {
      flight.current = null
      // The hand-off. From here the user is flying the camera again.
      controls.enabled = true
    }
  })

  return null
}

export default CameraRig
