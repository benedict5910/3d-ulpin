/**
 * The 2D → 3D generation sequence, expressed as a pure function of one number.
 *
 * WHAT THIS MODULE IS
 * `getGenerationVisuals(progress, floorCount)` takes the master progress of the
 * generation transition — a single value that runs 0 → 1 over about two
 * seconds — and returns *everything the scene needs to look right at that
 * instant*: how bright the footprint is, how tall the envelope has risen, how
 * far each floor plate has appeared, how far each floor's property units have
 * grown, and which stage the workflow should be reporting.
 *
 * WHY IT IS A FUNCTION AND NOT A STATE MACHINE
 * A sequence of timed `setState` calls — "after 300 ms show the shell, after
 * 900 ms show the floors" — is the obvious way to do this and the wrong one. It
 * produces state that can be *inconsistent with itself*: a timer that fires
 * after a reset, a stage that advances while an earlier one is still animating,
 * a component that re-mounts and no longer knows which timers already ran. Every
 * one of those shows up as the exact defect the brief rules out — janky
 * re-mount flicker.
 *
 * Deriving all of it from one number removes the possibility. There is one piece
 * of animation state in the application (the progress value), it only ever moves
 * forward, and every visual property is a *function* of it. The scene at
 * progress 0.63 is the same scene whether it was reached smoothly, after a
 * dropped frame, or by a reset and a second run. That is what "stable and
 * deterministic" means in the brief, and it is a property of the architecture
 * rather than something to be careful about.
 *
 * It also means the whole sequence can be executed in bare Node with no
 * renderer — no React, no Three.js, no DOM in this file.
 *
 * THE SEQUENCE, AND WHY THE STAGES OVERLAP
 *
 *   0.00 ┬─ highlight ──┐                       the source footprint pulses:
 *        │              │                       "this is what we start from"
 *   0.12 ┼──────── rise ────────┐               the envelope grows out of the
 *        │                      │               footprint, 0 m → 15 m
 *   0.46 ┼──────────── floors ──────────┐       floor plates appear, bottom-up
 *        │                              │
 *   0.70 ┼──────────────── units ───────────┐   each floor's property units
 *        │                                  │   grow into place, bottom-up,
 *   1.00 ┴──────────────────────────────────┘   as the envelope hands over
 *
 * The windows deliberately overlap. Strictly sequential stages read as four
 * separate animations played back to back; overlapping them by a few percent
 * reads as one continuous build, which is what a building actually looks like
 * going up. The overlap is small enough that the *order* is never in doubt.
 *
 * WHAT THE SEQUENCE IS NOT ALLOWED TO IMPLY
 * The units are not created floor by floor — `buildApartmentUnits` produces all
 * twenty in one pass, before the user presses anything (see `App.tsx`). The
 * staggered reveal is a *presentation* of a transformation that happens at once,
 * exactly as an architect's build-up diagram is. That is honest as long as the
 * interface never claims otherwise, which is why the pipeline card marks the
 * structure and unit steps as a single in-progress group rather than pretending
 * to five independently timed computations.
 */

import { clamp01, EASE_IN_OUT_CUBIC, EASE_OUT_CUBIC, pulse, subProgress } from './easing'

/**
 * How long the whole 2D → 3D transition takes, in milliseconds.
 *
 * The brief asks for 1.5–3 s. 2.2 s sits in the middle for a reason: below about
 * 1.5 s a five-floor stagger stops being readable as a stagger, and above about
 * 3 s a presenter has to fill silence. At 2.2 s each of the five floors gets
 * roughly 150 ms of its own, which is long enough to see and short enough that
 * nobody waits.
 */
export const GENERATION_DURATION_MS = 2200

/** Which part of the sequence a given progress value is in. */
export type GenerationStageId =
  | 'source'
  | 'highlight'
  | 'structure'
  | 'floors'
  | 'units'
  | 'ready'

/** A stage's slice of the master progress run. */
interface Window {
  readonly start: number
  readonly end: number
}

/** The footprint is pointed at. */
const HIGHLIGHT: Window = { start: 0, end: 0.16 }
/** The envelope grows out of the footprint. */
const RISE: Window = { start: 0.12, end: 0.54 }
/** Floor plates appear, bottom-up. */
const FLOORS: Window = { start: 0.46, end: 0.8 }
/** Property units grow into place, bottom-up, as the envelope hands over. */
const UNITS: Window = { start: 0.7, end: 1 }

/** How much of the rise window is spent fading the envelope *in*. */
const SHELL_FADE_IN = 0.1
/** How much of the units window is spent fading the envelope *out*. */
const SHELL_FADE_OUT = 0.22

/** The footprint's brightness once the building it produced is the subject. */
const FOOTPRINT_SETTLED_EMPHASIS = 0.42

/**
 * Human-readable status for each stage.
 *
 * Kept beside the stage definitions rather than in the component that shows
 * them, so a stage cannot be added without someone deciding what it says. The
 * wording describes what the *system* is doing, in the vocabulary a cadastral
 * audience uses — not "loading" or "please wait".
 */
const STAGE_MESSAGES: Record<GenerationStageId, string> = {
  source: 'Source geometry loaded',
  highlight: 'Reading source footprint',
  structure: 'Extruding 3D structure',
  floors: 'Creating floor plates',
  units: 'Creating vertical property units',
  ready: '3D cadastre ready',
}

/** The status line for a stage. */
export function getStageMessage(stage: GenerationStageId): string {
  return STAGE_MESSAGES[stage]
}

/**
 * Which stage a progress value falls in.
 *
 * The boundaries are the *midpoints of the overlaps*, not the window edges: at
 * progress 0.5 both the rise and the floor plates are moving, and the honest
 * answer to "what is the system doing" is whichever has more of the viewer's
 * attention. Reporting the later stage the moment its window opens would make
 * the status line run ahead of the picture.
 */
export function getGenerationStage(progress: number, isGenerating: boolean): GenerationStageId {
  if (!isGenerating) return 'source'
  if (progress >= 1) return 'ready'
  if (progress < HIGHLIGHT.end) return 'highlight'
  if (progress < 0.5) return 'structure'
  if (progress < 0.74) return 'floors'
  return 'units'
}

/**
 * Everything the scene needs to draw one frame of the transition.
 *
 * All of it derived, none of it stored. A component that receives this object
 * has no decisions left to make about timing — which is the point.
 */
export interface GenerationVisuals {
  /** Which stage the workflow is reporting. */
  readonly stage: GenerationStageId
  /** Master progress, clamped — passed through so views can show a bar. */
  readonly progress: number
  /** `0` → `1` → `0` flash on the source footprint at the very start. */
  readonly footprintPulse: number
  /** How strongly the footprint is drawn: `1` as the subject, less once built on. */
  readonly footprintEmphasis: number
  /** How far the envelope has risen, `0`–`1` of the building's full height. */
  readonly shellHeightFraction: number
  /** How present the envelope is: fades in as it rises, out as units take over. */
  readonly shellPresence: number
  /** Per-floor plate reveal, `0`–`1`, indexed by 0-based floor index. */
  readonly floorReveal: readonly number[]
  /** Per-floor unit reveal, `0`–`1`, indexed by 0-based floor index. */
  readonly unitReveal: readonly number[]
  /** Whether units may be clicked. False for every frame of the transition. */
  readonly unitsInteractive: boolean
  /** Whether the building has fully settled — the ordinary, opaque model. */
  readonly isSettled: boolean
}

/**
 * Spread `count` reveals across a window, bottom-up, with overlap.
 *
 * Each item gets a slot of `span / (count + 1)` and a duration of two slots, so
 * consecutive items overlap by half their length. That overlap is what turns
 * five separate pops into one wave travelling up the building.
 *
 * Returns eased values, not linear ones: each floor should arrive the way a
 * single element arrives, and easing the master progress instead would ease the
 * *wave* while leaving every individual floor linear.
 */
function staggeredReveal(
  progress: number,
  window: Window,
  count: number,
  easing: (t: number) => number,
): number[] {
  if (count <= 0) return []

  const span = window.end - window.start
  const slot = span / (count + 1)

  const reveals: number[] = []
  for (let index = 0; index < count; index++) {
    const start = window.start + index * slot
    reveals.push(easing(subProgress(progress, start, start + slot * 2)))
  }
  return reveals
}

/**
 * The whole sequence at one instant.
 *
 * @param progress master progress, `0`–`1`. Values outside are clamped, so a
 *   caller cannot produce a state the sequence does not define.
 * @param floorCount how many floors the building has — the stagger adapts, so a
 *   twelve-storey building animates as twelve steps with no change here.
 */
export function getGenerationVisuals(
  progress: number,
  floorCount: number,
): GenerationVisuals {
  const p = clamp01(progress)
  const isGenerating = p > 0

  // The envelope fades in shortly after it starts rising, and back out as the
  // units replace it. Two independent ramps multiplied together, rather than one
  // curve with a hump in it, because they mean different things: one is "the
  // volume is being formed", the other is "the volume has been subdivided".
  const shellIn = subProgress(p, RISE.start, RISE.start + SHELL_FADE_IN)
  const shellOut = subProgress(p, UNITS.start, UNITS.start + SHELL_FADE_OUT)

  return {
    stage: getGenerationStage(p, isGenerating),
    progress: p,

    footprintPulse: pulse(subProgress(p, HIGHLIGHT.start, HIGHLIGHT.end)),
    // Full emphasis until the building starts to exist, then down to a level
    // where it still reads as the surveyed line the walls landed on.
    footprintEmphasis:
      1 - (1 - FOOTPRINT_SETTLED_EMPHASIS) * subProgress(p, RISE.start, FLOORS.end),

    // Ease-out: the building leaps off the ground and settles into its height,
    // which is how a extrusion reads as decisive rather than as a slow inflate.
    shellHeightFraction: EASE_OUT_CUBIC(subProgress(p, RISE.start, RISE.end)),
    shellPresence: shellIn * (1 - shellOut),

    floorReveal: staggeredReveal(p, FLOORS, floorCount, EASE_OUT_CUBIC),
    unitReveal: staggeredReveal(p, UNITS, floorCount, EASE_IN_OUT_CUBIC),

    // Not "isGenerated" — *settled*. A click during the transition would open a
    // record for a property the animation has not finished drawing, which looks
    // like a bug even though the data was ready all along.
    unitsInteractive: p >= 1,
    isSettled: p >= 1,
  }
}

/**
 * The settled, fully generated state — the visuals at progress 1.
 *
 * Named rather than open-coded so the several places that need "the ordinary
 * model, no transition running" cannot drift from what the timeline actually
 * produces at its end.
 */
export function getSettledVisuals(floorCount: number): GenerationVisuals {
  return getGenerationVisuals(1, floorCount)
}
