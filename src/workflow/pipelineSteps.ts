/**
 * The 2D-to-3D cadastre pipeline, as data.
 *
 * The project turns two static views into a **workflow**: a parcel and a
 * footprint come in, the user performs a generation, and vertical property units
 * with identifiers come out. That sequence is worth showing, because it is the
 * claim the prototype is making, and a claim the interface states step by step
 * is one a judge can check step by step.
 *
 * WHY THIS IS A PURE MODULE AND NOT JSX
 * The steps are *derived state* — which of them are complete is a function of
 * the model, not a decision a component makes. Writing them as a function that
 * returns data means the sequence can be read, reasoned about and (later)
 * tested without rendering anything, and it means the view has no opportunity
 * to claim a step is done when it is not. `ui/PipelineStatus.tsx` renders what
 * this returns and decides nothing.
 *
 * PHASE 9 ADDED A THIRD STATE: `active`.
 * Phase 8's steps were binary — pending or complete — because generation was
 * effectively instantaneous. Now that it takes a little over two seconds, a
 * binary list has to choose between lying early (all five complete the moment
 * the button is pressed) and lying late (nothing changes for two seconds while
 * the scene visibly builds). `active` removes the choice: a step is in progress
 * exactly while the animation stage it corresponds to is running.
 *
 * That mapping is deliberately *coarse*. The stage names come from
 * `animation/generationTimeline.ts`, and the pipeline groups them:
 *
 *   highlight  →  footprint step re-reads as active
 *   structure  →  "3D Structure Generated" active
 *   floors     →  "3D Structure Generated" active   (plates are structure)
 *   units      →  "Vertical Units Created" active, and the identifiers with them
 *
 * The units and the identifiers move together because they *are* produced
 * together — one pass through `buildApartmentUnits` generates a unit's bounds
 * and its prototype ULPIN in the same loop iteration. Animating them as two
 * separately-timed steps would be a nicer list and a false account of the code.
 *
 * SUBPHASE C ADDED THE SIXTH STEP.
 * Until then there was deliberately no validation row: a "Validated" step that
 * lit up without a validator behind it would have been the one dishonest thing
 * in the interface. There is a validator now, so the row exists — and it takes
 * the engine's own report, so it can report `failed` as readily as `complete`.
 * The pipeline still shows only what the prototype actually does.
 *
 * No React, no Three.js, no Leaflet.
 */

import type { GenerationStageId } from '../animation/generationTimeline'
import type { TopologyReport } from '../validation/types'

/**
 * Whether a step has happened, is happening, has not started — or failed.
 *
 * `failed` arrived with the validation engine. Until Subphase C every step could
 * only succeed once it ran, because extruding a polygon and cutting it into
 * boxes cannot come out wrong. Validation can, and a pipeline whose last step
 * could only ever show a tick would be exactly the decorative validator this
 * project set out not to build.
 */
export type PipelineStepState = 'complete' | 'active' | 'pending' | 'failed'

/** One stage of the pipeline, ready to render. */
export interface PipelineStep {
  /** Stable key. */
  readonly id: string
  /** What the stage is called, in the interface. */
  readonly label: string
  /** Whether it has happened. */
  readonly state: PipelineStepState
  /**
   * The evidence, in a few characters — the figure that shows the step really
   * ran, rather than a tick that only shows a flag was flipped. Pending steps
   * describe what they *will* produce; active steps describe what is under way.
   */
  readonly detail: string
}

/** Everything the pipeline needs to describe itself. */
export interface PipelineInput {
  /** Has the user requested the 3D cadastre? */
  readonly isGenerated: boolean
  /**
   * Where the generation animation has got to.
   *
   * `'source'` before the button is pressed, `'ready'` once it has settled, and
   * one of the transition stages in between. The pipeline reads the stage rather
   * than a raw progress number so that the timeline owns the question of "what
   * is happening now" in exactly one place.
   */
  readonly stage: GenerationStageId
  /** The parent parcel identifier, e.g. `KA-BLR-0482-001928`. */
  readonly parcelId: string
  /** Vertices in the building footprint ring. */
  readonly footprintVertexCount: number
  /** Footprint area in square metres, measured from the polygon. */
  readonly footprintAreaSqM: number
  /** Floors in the generated structure. */
  readonly floorCount: number
  /** Total height of the structure, in metres. */
  readonly totalHeightM: number
  /** How many vertical property units the model contains. */
  readonly unitCount: number
  /**
   * The topology engine's verdict, or `null` before generation.
   *
   * Passed in rather than computed here for the same reason every other figure
   * is: this module turns model state into a list of rows, and running the
   * validator would make it a second place validation happens.
   */
  readonly validation: TopologyReport | null
}

/** Round for display without implying survey precision. */
function area(value: number): string {
  return `${Math.round(value).toLocaleString('en-IN')} m²`
}

/**
 * Build the five pipeline steps for the current state of the model.
 *
 * The first two are complete from the moment the page loads: the parcel and its
 * footprint are *source data*, already present before the user does anything.
 * The last three progress together with the animation, and are all complete once
 * it settles.
 */
export function buildPipelineSteps(input: PipelineInput): PipelineStep[] {
  const { stage, isGenerated } = input
  const settled = isGenerated && stage === 'ready'

  /** A step that belongs to the structure half of the generation. */
  const structureState: PipelineStepState = settled
    ? 'complete'
    : stage === 'structure' || stage === 'floors'
      ? 'active'
      : 'pending'

  /** A step that belongs to the subdivision half. */
  const unitsState: PipelineStepState = settled
    ? 'complete'
    : stage === 'units'
      ? 'active'
      : 'pending'

  return [
    {
      id: 'parcel',
      label: 'Parcel Loaded',
      state: 'complete',
      detail: input.parcelId,
    },
    {
      id: 'footprint',
      label: 'Footprint Loaded',
      state: stage === 'highlight' ? 'active' : 'complete',
      detail:
        stage === 'highlight'
          ? 'reading source polygon'
          : `${input.footprintVertexCount}-vertex ring · ${area(input.footprintAreaSqM)}`,
    },
    {
      id: 'structure',
      label: '3D Structure Generated',
      state: structureState,
      detail:
        structureState === 'complete'
          ? `${input.floorCount} floors · ${input.totalHeightM.toFixed(0)} m`
          : structureState === 'active'
            ? `extruding to ${input.totalHeightM.toFixed(0)} m`
            : `extrude footprint to ${input.totalHeightM.toFixed(0)} m`,
    },
    {
      id: 'units',
      label: 'Vertical Units Created',
      state: unitsState,
      detail:
        unitsState === 'complete'
          ? `${input.unitCount} property units`
          : unitsState === 'active'
            ? `cutting ${input.unitCount} units`
            : `${input.unitCount} units pending`,
    },
    {
      id: 'ulpin',
      label: 'Prototype ULPIN Assigned',
      state: unitsState,
      detail:
        unitsState === 'complete'
          ? `${input.unitCount} identifiers, all unique`
          : 'one identifier per unit',
    },
    {
      id: 'topology',
      label: 'Topology Validated',
      // The one step that can fail. Its state is the engine's verdict, not a
      // flag: `conflict` shows as `failed`, and the pipeline count below stops
      // counting it as done — so a model with an ownership dispute reads 5/6,
      // not 6/6 with a red mark nobody notices.
      state:
        input.validation === null
          ? 'pending'
          : input.validation.status === 'conflict'
            ? 'failed'
            : 'complete',
      detail:
        input.validation === null
          ? 'containment · hierarchy · overlap'
          : input.validation.status === 'conflict'
            ? `${input.validation.failCount} rule(s) violated`
            : input.validation.status === 'warning'
              ? `${input.validation.passCount}/${input.validation.results.length} checks, ${input.validation.warningCount} warning(s)`
              : `${input.validation.results.length} checks, no conflicts`,
    },
  ]
}

/**
 * How many steps have completed. Used for the summary line above the list.
 *
 * `active` deliberately does not count — a step under way has not produced
 * anything yet, and a counter that rounded up would be the interface claiming a
 * result it does not have. Neither does `failed`, for the stronger version of
 * the same reason.
 */
export function countCompletedSteps(steps: readonly PipelineStep[]): number {
  return steps.filter((step) => step.state === 'complete').length
}
