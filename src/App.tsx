import { useCallback, useMemo, useRef, useState } from 'react'

import SceneViewer from './scene/SceneViewer'
import GISMap from './map/GISMap'
import ParcelInfoPanel from './map/ParcelInfoPanel'
import BuildingSummary from './ui/BuildingSummary'
import GenerateCadastreControl from './ui/GenerateCadastreControl'
import GenerationStatus from './ui/GenerationStatus'
import PipelineStatus from './ui/PipelineStatus'
import PropertyInspector from './ui/PropertyInspector'
import FloorIsolationPanel from './ui/FloorIsolationPanel'
import ConflictAlert from './ui/ConflictAlert'
import ConflictPanel from './ui/ConflictPanel'
import ValidationDetails from './ui/ValidationDetails'
import ValidationStatusBar from './ui/ValidationStatusBar'
import ViewControls from './ui/ViewControls'
import { useFadeProgress } from './ui/useFadeProgress'
import { EASE_IN_OUT_CUBIC, LINEAR } from './animation/easing'
import { runGenerationSelfCheck } from './animation/generationSelfCheck'
import { runExplodedViewSelfCheck } from './scene/explodedSelfCheck'
import { runFloorIsolationSelfCheck } from './scene/floorIsolationSelfCheck'
import {
  GENERATION_DURATION_MS,
  getGenerationVisuals,
  getStageMessage,
} from './animation/generationTimeline'
import { DEMO_PARCEL } from './data/demoParcel'
import { getFootprintMetrics } from './geometry/footprint'
import { runFootprintGeometrySelfCheck } from './geometry/footprintSelfCheck'
import {
  buildFloorLayouts,
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
  getTotalUnits,
  getUnitsPerFloor,
} from './scene/buildingConfig'
import {
  getPresetView,
  type CameraPresetId,
  type CameraView,
} from './scene/cameraPresets'
import type { CameraRequest } from './scene/CameraRig'
import {
  buildBasementPlanCentres,
  buildFloorPlanCentres,
  EXPLODE_FLOOR_DURATION_MS,
  EXPLODE_UNIT_DURATION_MS,
  getExplodedOffsetM,
  getSettledExplodeAmounts,
  NO_EXPLOSION,
  type ExplodeAmounts,
  type ExplodeMode,
} from './scene/explodedView'
import {
  getIsolationSummary,
  ISOLATION_DURATION_MS,
} from './scene/floorIsolation'
import { buildApartmentUnits, findUnitById } from './scene/unitLayout'
import {
  buildBasementLevels,
  DEFAULT_BASEMENT_CONFIG,
  getTotalDepthM,
  getTotalUndergroundSpaces,
  GROUND_DATUM_Y,
} from './underground/basementConfig'
import { buildUndergroundSpaces } from './underground/undergroundLayout'
import {
  getAboveGroundEmphasis,
  getUndergroundEmphasis,
  UNDERGROUND_DURATION_MS,
} from './underground/undergroundView'
import { runUndergroundSelfCheck } from './underground/undergroundSelfCheck'
import { resolveSelectedRecord } from './ui/spaceRecord'
import { runPrototypeUlpinSelfCheck } from './ulpin/ulpinSelfCheck'
import {
  applyConflictSimulation,
  CONFLICT_ANIMATION_MS,
  CONFLICT_RESTORE_MS,
  describeScenario,
  findEncroachmentPair,
} from './simulation/conflictSimulation'
import {
  buildConflictFocus,
  CONFLICT_FOCUS_MS,
  getConflictFraming,
} from './simulation/conflictPresentation'
import { runConflictSimulationSelfCheck } from './simulation/conflictSelfCheck'
import { runConflictPresentationSelfCheck } from './simulation/conflictPresentationSelfCheck'
import {
  findOwnershipConflicts,
  validateTopology,
} from './validation/validateTopology'
import { runTopologyValidationSelfCheck } from './validation/validationSelfCheck'
import { buildPipelineSteps } from './workflow/pipelineSteps'

/**
 * The application shell — and the owner of everything the whole app agrees on:
 * the footprint, the generated property units, and the workflow state.
 *
 * They live here for the same reason: this is the nearest component that
 * contains *every* reader. The map, the 3D scene, the summary, the pipeline and
 * the inspector are siblings, so nothing lower than `App` can serve them all,
 * and nothing higher would add anything but distance.
 *
 * THE DATA FLOW
 *
 *   DEMO_PARCEL.buildingFootprintMetric        ← the surveyed polygon, in metres
 *          │
 *          ├──► getFootprintMetrics ──► width / depth / area / centroid
 *          │            └──► BuildingSummary, ParcelInfoPanel, camera presets
 *          │
 *          ├──► GISMap  (via the projected lat/lng form of the same ring)
 *          │
 *          └──► buildApartmentUnits(config, footprint, floors)
 *                       │
 *                       ├──► FootprintPad     the plan, on the ground
 *                       ├──► BuildingShell    the plan, extruded and rising
 *                       ├──► FloorSlabs       the plan, once per level
 *                       └──► Building         the volume, cut into 20 units
 *                                    │ click
 *                                    ↓
 *                          selectedUnitId (state)
 *                                    ↓
 *                    findUnitById ──► PropertyInspector, SceneLabels, camera
 *
 * THE THREE KINDS OF GEOMETRY — THE PROJECT'S CENTRAL RULE
 *
 *   canonicalUnits  the record. Built once, never written to.
 *          │
 *          ├─ applyConflictSimulation ──► units          (the display record:
 *          │                                              canonical, or canonical
 *          │                                              with one hypothetical
 *          │                                              override applied)
 *          │        └──► validateTopology, PropertyInspector, the 3D scene
 *          │
 *          └─ buildFloorPlanCentres ──► the exploded view's directions
 *
 *   explodeAmounts / isolationAmount   a way of DRAWING the above. Offsets and
 *                                      opacity scalars only. They reach meshes
 *                                      and nothing else — never the inspector,
 *                                      and never, ever the validator.
 *
 * See ARCHITECTURE §10.0. The rule is that the record must never inherit a
 * coordinate that came from a visualisation transform, and the validator must
 * never be shown one — separating volumes on screen is exactly what makes
 * overlaps disappear.
 *
 * THE PRESENTATION STATE
 * Three pieces of view state, and two derived objects:
 *
 *   isGenerated      the workflow flag, unchanged since Phase 8
 *   explodeMode      'none' | 'floors' | 'units' — a visualisation level, never
 *                    a change to the model
 *   activePreset     which named camera view was last requested
 *
 *   visuals          = getGenerationVisuals(generationProgress, floorCount)
 *   explodeAmounts   = { floors, units }, two independent eased ramps
 *
 * `visuals` is the important one. **Every timing decision in the application is
 * a pure function of one number**, computed in `animation/generationTimeline.ts`
 * and distributed from here. There are no timers, no chained `setTimeout`s and
 * no per-component animation state, which is what makes a reset mid-transition,
 * a dropped frame or a re-render harmless: the scene at a given progress is
 * always the same scene.
 *
 * Note that no latitude or longitude ever reaches the 3D scene. Degrees are for
 * the map; the model works in metres from the parcel's reference point, which
 * is the same physical spot as the scene's origin.
 */

/**
 * A shared empty array for "no units are in conflict".
 *
 * A module constant rather than a `[]` literal at the point of use: the value is
 * passed as a prop to the scene, and a fresh array every render would defeat
 * memoisation on a component that re-renders sixty times a second during a
 * transition.
 */
const EMPTY_IDS: readonly string[] = []

function App() {
  const config = DEFAULT_BUILDING_CONFIG
  const parcel = DEMO_PARCEL

  /**
   * The building footprint: the authoritative horizontal geometry.
   *
   * Read off the parcel, not built here. `App` is the wiring, not a second
   * place geometry could be invented.
   */
  const footprint = parcel.buildingFootprintMetric

  /**
   * The footprint, measured once.
   *
   * Every consumer that wants a width, a depth, an area or a centroid reads
   * this object. Measuring in one place is what stops the summary panel, the
   * parcel panel and the camera from each computing the extent slightly
   * differently.
   */
  const footprintMetrics = useMemo(() => getFootprintMetrics(footprint), [footprint])

  const totalHeightM = getTotalHeight(config)

  /**
   * The floors, built once and shared.
   *
   * Phase 9 needs them in three places — the unit generator, the floor plates
   * and the floor labels — so they are built here rather than three times.
   * Passing them into `buildApartmentUnits` as well means the plate at floor 3's
   * `baseY` and the units whose `yMin` is floor 3's `baseY` are reading the same
   * object, not two equal ones.
   */
  const floors = useMemo(() => buildFloorLayouts(config), [config])

  /* ── Below the ground datum ───────────────────────────────────────────────
     The same three lines the building above needs — a config, a set of level
     layouts, and the volumes generated from them — and they read the SAME
     footprint. That is the cadastral claim: the excavation lies under the
     building's own plan, so it is cut from the building's own ring rather than
     from a second polygon that would have to be kept in step by hand. */

  const basementConfig = DEFAULT_BASEMENT_CONFIG
  const totalDepthM = getTotalDepthM(basementConfig)

  const basementLevels = useMemo(
    () => buildBasementLevels(basementConfig),
    [basementConfig],
  )

  /**
   * The four underground spaces, generated once from the footprint and the
   * basement config.
   *
   * Generated eagerly beside the twenty units above, and for the same reason:
   * they are pure data, they cost nothing, and building them at page load means
   * the basement is part of *the cadastre that gets generated* rather than a
   * second thing that appears later. Nothing renders them until the workflow
   * says so.
   */
  const undergroundSpaces = useMemo(
    () => buildUndergroundSpaces(basementConfig, footprint, basementLevels),
    [basementConfig, footprint, basementLevels],
  )

  /**
   * The twenty property units, generated once from the footprint and the config.
   *
   * Generated eagerly, before the user presses anything: they are pure data and
   * cost nothing, and building them at page load means the "Generate" action is
   * a *reveal of a transformation* rather than a spinner. Nothing renders them
   * until the workflow says so.
   *
   * This is also why the staggered floor-by-floor reveal is a presentational
   * choice and not a claim: all twenty units exist from the first frame. The
   * animation shows the *shape* of the transformation, not its schedule.
   */
  const canonicalUnits = useMemo(() => {
    const generated = buildApartmentUnits(config, footprint, floors)

    // Development-only. `import.meta.env.DEV` is a compile-time constant, so
    // this whole branch is removed from the production bundle.
    if (import.meta.env.DEV) {
      // The identifier check, run against the identifiers *actually attached to
      // these units* rather than a freshly generated look-alike set.
      runPrototypeUlpinSelfCheck(generated.map((unit) => unit.prototypeUlpin))

      // The footprint-driven geometry still produces the 18 × 14 m, 252 m²,
      // 20-unit building it produced before the rewiring.
      runFootprintGeometrySelfCheck()

      // The generation sequence is monotonic, travels bottom-up, and is exact
      // at both ends — the properties an animation cannot be eyeballed for.
      // See `animation/generationSelfCheck.ts`.
      runGenerationSelfCheck()

      // The exploded view's offsets are derived correctly *and* the transform
      // never writes to the model it reads. See `scene/explodedSelfCheck.ts`.
      runExplodedViewSelfCheck()

      // Floor isolation's priority rule holds, and the layer indicator's figures
      // are derived rather than typed. See `scene/floorIsolationSelfCheck.ts`.
      runFloorIsolationSelfCheck()

      // The topology engine passes a valid model AND catches six kinds of
      // deliberately broken one — the half that proves the validator is real.
      // See `validation/validationSelfCheck.ts`.
      runTopologyValidationSelfCheck()

      // The simulation never writes to the canonical record, the engine
      // *discovers* the staged conflict, and restoring is exact.
      // See `simulation/conflictSelfCheck.ts`.
      runConflictSimulationSelfCheck()

      // And the *presentation* of that conflict is derived rather than drawn
      // from imagination: the ghost stands exactly where the record says, the
      // displacement is proportional at every point of the animation, and the
      // red volume on screen is the engine's own intersection bounds.
      // See `simulation/conflictPresentationSelfCheck.ts`.
      runConflictPresentationSelfCheck()

      // The basement is where the model claims it is, it is cut from the same
      // footprint as the building, its identifiers cannot collide with the
      // ones above ground, and touching the datum is valid where crossing it
      // is not. See `underground/undergroundSelfCheck.ts`.
      runUndergroundSelfCheck()

      // The prototype's grid subdivision assumes a rectangular plan (see
      // `scene/unitLayout.ts`). Warn rather than fail: an irregular footprint
      // renders correctly, it is only the *internal* subdivision that would be
      // approximate, and that is a known limitation rather than a fault.
      if (!footprintMetrics.isAxisAlignedRectangle) {
        console.warn(
          '[3D ULPIN] the building footprint is not an axis-aligned rectangle. ' +
            'The prototype cuts units on the footprint’s bounding box, so some ' +
            'units will overhang the plan. Arbitrary polygon subdivision is future work.',
        )
      }
    }

    return generated
  }, [config, footprint, floors, footprintMetrics])

  /* ── The simulation layer ───────────────────────────────────────────────
     canonicalUnits ──► applyConflictSimulation ──► displayUnits

     The middle arrow is off by default and, when on, produces a NEW array with
     one record translated across a shared wall. The canonical array is never
     written to and is still in memory, which is what makes "Restore Valid
     Geometry" a matter of pointing at it again — not an undo, not an inverse
     translation, not a regeneration. It cannot drift, because nothing changed.

     `displayUnits` is what the scene draws, what the inspector reports, and —
     critically — what the validation engine is handed. A simulated conflict is a
     hypothetical *record*, not a way of drawing one. See ARCHITECTURE §10.0. */

  /** Whether the simulated encroachment is applied. */
  const [isSimulatingConflict, setIsSimulatingConflict] = useState(false)

  /**
   * Two wall-sharing neighbours to stage the conflict between.
   *
   * **Found, not named.** `findEncroachmentPair` tests adjacency geometrically —
   * same floor, touching on one horizontal axis, genuinely overlapping on the
   * others — so the demo works on any grid rather than depending on unit 302
   * existing. See `simulation/conflictSimulation.ts`.
   */
  const encroachmentPair = useMemo(
    () => findEncroachmentPair(canonicalUnits),
    [canonicalUnits],
  )

  /** The scenario in words, derived from the pair actually found. */
  const conflictScenario = useMemo(
    () => describeScenario(encroachmentPair),
    [encroachmentPair],
  )

  /**
   * The building at the *end* of the simulation, and what the engine finds in it.
   *
   * Computed once and independently of the animation, for one purpose: the camera
   * has to know where it is flying before the property has finished moving. A
   * framing derived from the live, animating record would be a destination that
   * moved for a second and a half while the camera chased it.
   *
   * It is also the cheapest possible way to answer "is there anything to
   * demonstrate?" — if the engine finds no conflict in the fully simulated
   * building, there is nothing to focus on and the control stays inert.
   */
  const settledSimulatedUnits = useMemo(
    () => applyConflictSimulation(canonicalUnits, encroachmentPair, true),
    [canonicalUnits, encroachmentPair],
  )

  const settledConflictFocus = useMemo(
    () =>
      buildConflictFocus({
        pair: encroachmentPair,
        canonicalUnits,
        displayUnits: settledSimulatedUnits,
        // The engine's finding, not a prediction of it.
        conflicts: findOwnershipConflicts(settledSimulatedUnits),
        progress: 1,
      }),
    [canonicalUnits, encroachmentPair, settledSimulatedUnits],
  )

  /** Where the camera must look to see both properties and the ghost. */
  const conflictFraming = useMemo(
    () => getConflictFraming(settledConflictFocus),
    [settledConflictFocus],
  )

  /**
   * Has the user generated the 3D cadastre?
   *
   * The one piece of *workflow* state in the application, and the thing that
   * turns two static views into a demonstrated transformation.
   */
  const [isGenerated, setIsGenerated] = useState(false)

  /**
   * The master progress of the 2D → 3D transition, `0`–`1`.
   *
   * Linear on purpose: the curves belong to the individual stages, which apply
   * their own easing inside `generationTimeline.ts`. Easing this value as well
   * would ease the *sequence* and leave every stage inside it linear — the
   * opposite of what is wanted.
   *
   * `reverseDurationMs: 0` makes reset a snap rather than a rewind. Undoing the
   * demonstration should be instantaneous and total; a reverse animation would
   * read as the building being un-built, which is not a thing a cadastre does.
   */
  const generationProgress = useFadeProgress(isGenerated, {
    durationMs: GENERATION_DURATION_MS,
    reverseDurationMs: 0,
    easing: LINEAR,
  })

  /**
   * The entire transition at this instant — every opacity, height, reveal and
   * stage name the scene and the panels need.
   *
   * One call, one object, distributed downward. No component below this line
   * computes any timing of its own.
   */
  const visuals = useMemo(
    () => getGenerationVisuals(generationProgress, config.numberOfFloors),
    [generationProgress, config.numberOfFloors],
  )

  /* ── The conflict animation ─────────────────────────────────────────────
     TWO RAMPS, BECAUSE TWO DIFFERENT THINGS ARE BEING ANIMATED.

       conflictProgress     how far the PROPERTY has slid, 0–1.
                            Drives the record itself: the array handed to the
                            validator, the inspector and the scene.

       conflictFocusAmount  how far the PRESENTATION has arrived, 0–1.
                            Drives opacity only: the dimming of the other
                            eighteen units, the ghost, the arrow, the red
                            volume.

     They are separate because they answer to different clocks. The framing
     should land quickly and get out of the way; the property's journey is the
     thing being watched and deserves the full second and a half. Merging them
     would force one compromise duration on both.

     `visuals.isSettled` gates both, so a conflict cannot be staged into a
     building that is still assembling itself. */

  const conflictProgress = useFadeProgress(isSimulatingConflict && visuals.isSettled, {
    durationMs: CONFLICT_ANIMATION_MS,
    reverseDurationMs: CONFLICT_RESTORE_MS,
    // Eased in both directions: this is a movement between two resting places
    // the viewer is looking at, exactly like the exploded view — not an
    // appearance. A linear slide reads as a machine dragging a box.
    easing: EASE_IN_OUT_CUBIC,
  })

  const conflictFocusAmount = useFadeProgress(
    isSimulatingConflict && visuals.isSettled,
    {
      durationMs: CONFLICT_FOCUS_MS,
      reverseDurationMs: CONFLICT_FOCUS_MS,
      easing: EASE_IN_OUT_CUBIC,
    },
  )

  /**
   * What the scene draws, the inspector reports, and the engine validates.
   *
   * PHASE 10: THE OVERRIDE IS APPLIED AT THE ANIMATION'S CURRENT PROGRESS.
   * Not a display offset on a settled override — a genuinely intermediate
   * hypothetical record, revalidated on every frame. That is what makes the
   * disputed volume grow from nothing to 84 m³ in front of the audience with
   * nobody interpolating the number: the same `findOwnershipConflicts` that
   * measures the settled overlap measures each intermediate one.
   *
   * `conflictProgress > 0` rather than `isSimulatingConflict` is the condition,
   * and the difference matters on the way back: the flag clears the instant
   * "Restore" is pressed, while the property still has 900 ms of travel left. At
   * progress exactly 0 the simulation returns the canonical array **by
   * reference**, so the end of the restore is not merely equal to the original
   * record but is the original record.
   */
  const units = useMemo(
    () =>
      applyConflictSimulation(
        canonicalUnits,
        encroachmentPair,
        conflictProgress > 0,
        undefined,
        conflictProgress,
      ),
    [canonicalUnits, encroachmentPair, conflictProgress],
  )

  /** True while the conflict presentation owns the view, in either direction. */
  const isConflictFocusActive = conflictProgress > 0 || conflictFocusAmount > 0

  /**
   * Exploded view: a visualisation mode, not a change to the model.
   *
   * See `scene/explodedView.ts`. The floors are *drawn* apart and, at the second
   * level, each floor's units are *drawn* pushed outward. Every recorded bound is
   * untouched, and the property inspector goes on reporting the real ones.
   *
   * One mode value, not two booleans, because the levels are ordered: units
   * cannot disperse from a floor that has not been lifted clear, so a state that
   * could say "units apart, floors together" is a state the interface should not
   * be able to reach.
   */
  const [explodeMode, setExplodeMode] = useState<ExplodeMode>('none')

  /**
   * How far each of the two separations currently is, `0`–`1`.
   *
   * Two ramps, because both are animated and during a transition they genuinely
   * differ. Both are eased in *both* directions, unlike the generation ramp:
   * these are movements between two states the user is looking at, so the
   * regrouping has to be as watchable as the separation.
   *
   * `'units'` drives the floor ramp as well — choosing the deepest level implies
   * every level beneath it. The unit ramp is slightly the longer of the two, so
   * going from stacked straight to fully exploded reads as "layers, then
   * properties" rather than as one scatter. That ordering costs one constant and
   * no sequencing logic; see `EXPLODE_UNIT_DURATION_MS`.
   */
  const floorsApart =
    visuals.isSettled && (explodeMode === 'floors' || explodeMode === 'units')
  const unitsApart = visuals.isSettled && explodeMode === 'units'

  const floorExplodeAmount = useFadeProgress(floorsApart, {
    durationMs: EXPLODE_FLOOR_DURATION_MS,
    reverseDurationMs: EXPLODE_FLOOR_DURATION_MS,
    easing: EASE_IN_OUT_CUBIC,
  })
  const unitExplodeAmount = useFadeProgress(unitsApart, {
    durationMs: EXPLODE_UNIT_DURATION_MS,
    reverseDurationMs: EXPLODE_UNIT_DURATION_MS,
    easing: EASE_IN_OUT_CUBIC,
  })

  const explodeAmounts: ExplodeAmounts = useMemo(
    () => ({ floors: floorExplodeAmount, units: unitExplodeAmount }),
    [floorExplodeAmount, unitExplodeAmount],
  )

  /**
   * The plan centre of every floor, measured once from the units themselves.
   *
   * A unit's outward direction is derived from where it sits relative to this
   * point — see `scene/explodedView.ts`. Measured here rather than inside the
   * renderer so twenty meshes do not each re-measure their floor on every frame
   * of the explosion, and so the camera preset that frames an exploded unit
   * reads the same centres the mesh did.
   */
  const floorPlanCentres = useMemo(
    // Canonical, deliberately. The plan centres are a property of the building's
    // *layout*, and deriving them from the simulated array would make the
    // exploded view's directions shift the moment a conflict was staged — a
    // visualisation quietly changing because a hypothetical record changed.
    () => buildFloorPlanCentres(canonicalUnits),
    [canonicalUnits],
  )

  /**
   * And the plan centre of every basement level, measured the same way.
   *
   * The below-ground half of the same fact, from the same shared helper, so a
   * volume below the datum disperses about the middle of its own level exactly
   * as a flat disperses about the middle of its floor. The excavation carries no
   * conflict simulation, so there is only one array to measure.
   */
  const basementPlanCentres = useMemo(
    () => buildBasementPlanCentres(undergroundSpaces),
    [undergroundSpaces],
  )

  /**
   * Floor isolation: one layer brought forward, the rest ghosted.
   *
   * A 1-based floor level, or `null` for "all floors". Independent of
   * `explodeMode` on purpose — see `scene/floorIsolation.ts` for the priority
   * rule. Isolation decides *how strongly* each floor is drawn and whether it can
   * be clicked; the explosion decides *where* it is drawn. Neither reads the
   * other, so all six combinations are defined and none is a special case.
   */
  const [isolatedFloor, setIsolatedFloor] = useState<number | null>(null)

  /** How far the ghosting has got, `0`–`1`. Eased both ways, like the explosion. */
  const isolationAmount = useFadeProgress(
    isolatedFloor !== null && visuals.isSettled,
    {
      durationMs: ISOLATION_DURATION_MS,
      reverseDurationMs: ISOLATION_DURATION_MS,
      easing: EASE_IN_OUT_CUBIC,
    },
  )

  /** The floor levels the model actually has. Derived, so a taller building just works. */
  const floorLevels = useMemo(() => floors.map((floor) => floor.level), [floors])

  /** The isolated floor's layout, resolved — used by the `floor` camera preset. */
  const isolatedFloorLayout = useMemo(
    () => floors.find((floor) => floor.level === isolatedFloor) ?? null,
    [floors, isolatedFloor],
  )

  /**
   * The isolated layer's own facts, for the indicator.
   *
   * Derived from the units on that floor, not from the config: the panel reports
   * the elevation of *the property volumes it is counting*, so if those ever
   * disagreed with the floor layout the panel would show it rather than paper
   * over it. See `scene/floorIsolation.ts`.
   */
  const isolationSummary = useMemo(
    () => (isolatedFloor === null ? null : getIsolationSummary(isolatedFloor, units)),
    [isolatedFloor, units],
  )

  /* ── Underground view: which side of the datum is being read ─────────────
     A presentation state, like floor isolation and the exploded view, and it
     obeys the same two rules they do: emphasis MULTIPLIES rather than
     overrides, and not one recorded bound changes. The basement stays at
     −3.0 → 0.0 m whether the mode is on or off; what changes is how strongly
     each half of the model is drawn, which half is clickable, how far the
     camera may tip, and how opaque the ground plane is. */

  const [isUndergroundView, setIsUndergroundView] = useState(false)

  /**
   * How far the transition has got, `0`–`1`. Eased both ways.
   *
   * Gated on `visuals.isSettled` for the same reason the explosion and the
   * isolation are: running a second transform over meshes that are still
   * arriving makes neither animation readable.
   */
  const undergroundAmount = useFadeProgress(
    isUndergroundView && visuals.isSettled,
    {
      durationMs: UNDERGROUND_DURATION_MS,
      reverseDurationMs: UNDERGROUND_DURATION_MS,
      easing: EASE_IN_OUT_CUBIC,
    },
  )

  /**
   * How strongly each half of the model is drawn, from that one scalar.
   *
   * Derived here and passed down rather than computed per mesh: twenty-four
   * boxes would otherwise each re-derive the same two objects on every frame of
   * the transition. See `underground/undergroundView.ts` for the values and for
   * the stated priority rule — the side of the datum you are looking at is the
   * side you can select on.
   */
  const aboveGroundEmphasis = useMemo(
    () => getAboveGroundEmphasis(undergroundAmount),
    [undergroundAmount],
  )
  const undergroundEmphasis = useMemo(
    () => getUndergroundEmphasis(undergroundAmount),
    [undergroundAmount],
  )

  /* ── Topology validation ────────────────────────────────────────────────
     THE ENGINE IS POINTED AT LOGICAL GEOMETRY AND NOTHING ELSE.

     `units` here are the canonical cadastral records. Not one exploded offset,
     not one isolation scalar, and no camera state reaches this call — and the
     validation module has no import path to any of them, so the mistake is not
     available rather than merely avoided. See ARCHITECTURE §10.0.

     Separating volumes on screen is exactly what makes overlaps disappear, so a
     validator handed display coordinates would pass an invalid building and fail
     a valid one. */

  /** Whether the checks panel is open. Closed by default; the bar is the summary. */
  const [isValidationDetailOpen, setIsValidationDetailOpen] = useState(false)

  /**
   * The engine's verdict on the current model, or `null` before generation.
   *
   * `null` rather than a passing report while the scene is empty: a bar reading
   * "valid" over a plot with no building on it would be claiming something about
   * nothing. Recomputed only when the model changes — this is a state change,
   * not a frame, so the ~190-pair sweep costs nothing worth measuring.
   */
  const validationReport = useMemo(() => {
    if (!isGenerated) return null

    return validateTopology({
      parcelBoundary: parcel.parcelBoundaryMetric,
      footprint,
      units,
      floors,
      totalHeightM,
      expectedUnitsPerFloor: getUnitsPerFloor(config),
      expectedTotalUnits: getTotalUnits(config),

      // Below the datum. The engine validates the whole record in one pass —
      // there is no second validator for the basement, and no way for the
      // status bar to be describing one half of a model while the scene shows
      // the other. The generated excavation is canonical here, exactly as
      // `units` are: the conflict simulation stages an above-ground
      // encroachment and has nothing to say about the excavation.
      undergroundUnits: undergroundSpaces,
      basementLevels,
      groundDatumY: GROUND_DATUM_Y,
      expectedUndergroundSpaces: getTotalUndergroundSpaces(basementConfig),
      // Stated once, by the layer that owns the parcel, so the
      // parcel-consistency rule compares against a fact rather than against
      // whichever record it happened to see first.
      parentParcelId: parcel.parcelId,
    })
  }, [
    isGenerated,
    parcel.parcelBoundaryMetric,
    parcel.parcelId,
    footprint,
    units,
    floors,
    totalHeightM,
    config,
    undergroundSpaces,
    basementLevels,
    basementConfig,
  ])

  /**
   * The conflicting pairs themselves, for the alert and the conflict panel.
   *
   * The report says *that* there is a conflict and which units; the alert needs
   * the intersection volume and the panel needs the whole pair. `findOwnershipConflicts` is exported
   * from the engine for exactly this — one computation, two consumers, no second
   * implementation that could disagree with the first.
   */
  const ownershipConflicts = useMemo(
    () => (validationReport === null ? [] : findOwnershipConflicts(units)),
    [validationReport, units],
  )

  /** Ids the scene paints red. Empty when the report is clean. */
  const conflictedUnitIds = validationReport?.conflictedUnitIds ?? EMPTY_IDS

  /**
   * The live conflict presentation record — the ghost, the arrow, the disputed
   * volume, and the wording that goes with them.
   *
   * Rebuilt on every frame of the slide, from the engine's finding *for that
   * frame*. `null` the rest of the time, which is what makes every piece of
   * conflict geometry in the scene vanish completely rather than lingering at
   * zero opacity. See `simulation/conflictPresentation.ts`.
   */
  const conflictFocus = useMemo(
    () =>
      !isConflictFocusActive
        ? null
        : buildConflictFocus({
            pair: encroachmentPair,
            canonicalUnits,
            displayUnits: units,
            conflicts: ownershipConflicts,
            progress: conflictProgress,
          }),
    [
      isConflictFocusActive,
      encroachmentPair,
      canonicalUnits,
      units,
      ownershipConflicts,
      conflictProgress,
    ],
  )

  /**
   * Where the conflict's own floor is being *drawn*, vertically.
   *
   * The one visualisation value the overlay is given. Everything it draws sits at
   * true cadastral coordinates plus this, so the ghost and the disputed volume
   * ride with the layer they belong to rather than being left at the elevation
   * the register records. It is the same `getExplodedOffsetM` the floor's plate
   * and its units call, so the three cannot disagree.
   */
  const conflictFloorOffsetY =
    conflictFocus === null
      ? 0
      : getExplodedOffsetM(conflictFocus.floorLevel - 1, floorExplodeAmount)

  /**
   * Which unit is selected — stored as an **id**, not as the unit object.
   *
   * A string is a stable, comparable primitive: React can tell "unchanged" from
   * "changed" without a deep compare, and `unit.id === selectedUnitId` inside
   * the render loop is a cheap test that each of the twenty meshes can make for
   * itself. Storing the object would mean the app held a second reference to a
   * unit that also lives in `units`, and if the config ever changed, that
   * reference would keep pointing at a unit the scene no longer draws — a
   * selection of something invisible. An id cannot go stale in that way: it
   * either still resolves, or resolves to `null` and the panel returns to its
   * empty state. The id is the *question*; `units` remains the only place with
   * the answer.
   */
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  /**
   * Resolve the id back to the one generated *unit* it names, or `null`.
   *
   * Still above-ground-only, deliberately: the three things that read it — the
   * `unit` camera preset, the exploded-view framing and the conflict handler's
   * bookkeeping — are all about the upward stack, and handing them an
   * underground space would make each of them quietly wrong. The panel that
   * shows *whatever* is selected reads `selectedRecord` below instead.
   */
  const selectedUnit = useMemo(
    () => findUnitById(units, selectedUnitId),
    [units, selectedUnitId],
  )

  /**
   * The selected volume's cadastral record, on either side of the datum.
   *
   * **One selection, one resolver, one inspector.** `selectedUnitId` is the
   * same single string it has been since Phase 5; `resolveSelectedRecord` asks
   * both arrays what it points at and flattens the answer into the shape the
   * inspector renders. There is no second selection state and no combination in
   * which a unit and a space are both selected. See `ui/spaceRecord.ts`.
   */
  const selectedRecord = useMemo(
    () => resolveSelectedRecord(units, undergroundSpaces, selectedUnitId),
    [units, undergroundSpaces, selectedUnitId],
  )

  /* ── Camera ─────────────────────────────────────────────────────────────
     `activePreset` is which named view was last asked for — it drives the
     pressed state of the buttons. `cameraRequest` is the instruction sent into
     the canvas, and it carries a token so that pressing the same preset twice
     re-frames rather than being swallowed as "no change". The rig consumes the
     token; nothing has to clear the request. */

  const [activePreset, setActivePreset] = useState<CameraPresetId>('building')
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null)

  /**
   * The request counter.
   *
   * A ref rather than state: it must increment exactly once per press, and a
   * counter held in state would have to be incremented from inside an updater
   * that also raises a second state change — which React's StrictMode
   * double-invokes in development, producing two tokens for one click. A ref is
   * incremented once, imperatively, at the moment of the event.
   */
  const cameraToken = useRef(0)

  /**
   * Everything a preset needs to frame the *current* model.
   *
   * Rebuilt when the selection or the explosion changes, because both move what
   * is on screen. `getPresetView` is pure, so this object is the only input a
   * view depends on.
   */
  const presetContext = useMemo(
    () => ({
      footprintMetrics,
      totalHeightM,
      floorCount: config.numberOfFloors,
      selectedUnit,
      explodeAmounts,
      floorPlanCentres,
      isolatedFloor: isolatedFloorLayout,
      // The settled framing, not the animating one — the camera flies to one
      // destination rather than chasing the property while it slides.
      conflictFraming,
      // The excavation, so the `underground` preset frames the volumes' own
      // recorded bounds rather than a depth read off the config.
      undergroundSpaces,
      basementLevelCount: basementConfig.numberOfLevels,
      totalDepthM,
    }),
    [
      footprintMetrics,
      totalHeightM,
      config.numberOfFloors,
      selectedUnit,
      explodeAmounts,
      floorPlanCentres,
      isolatedFloorLayout,
      conflictFraming,
      undergroundSpaces,
      basementConfig.numberOfLevels,
      totalDepthM,
    ],
  )

  /**
   * Fly to a named view.
   *
   * The view is computed *here*, at the moment of the request, rather than in
   * the canvas: that way the destination is a snapshot of the model as it was
   * when the button was pressed, and the flight cannot be redirected mid-air by
   * an unrelated re-render.
   */
  const applyCameraView = useCallback((preset: CameraPresetId, view: CameraView) => {
    setActivePreset(preset)
    cameraToken.current += 1
    setCameraRequest({ token: cameraToken.current, view })
  }, [])

  const requestCamera = useCallback(
    (preset: CameraPresetId) => {
      applyCameraView(preset, getPresetView(preset, presetContext))
    },
    [applyCameraView, presetContext],
  )

  /** The opening view — the same 'building' preset, before anything is pressed. */
  const openingView = useMemo(
    () =>
      getPresetView('building', {
        footprintMetrics,
        totalHeightM,
        floorCount: config.numberOfFloors,
        selectedUnit: null,
        explodeAmounts: NO_EXPLOSION,
        floorPlanCentres,
        isolatedFloor: null,
        conflictFraming: null,
        undergroundSpaces,
        basementLevelCount: basementConfig.numberOfLevels,
        totalDepthM,
      }),
    [
      footprintMetrics,
      totalHeightM,
      config.numberOfFloors,
      floorPlanCentres,
      undergroundSpaces,
      basementConfig.numberOfLevels,
      totalDepthM,
    ],
  )

  /* ── Workflow actions ───────────────────────────────────────────────────── */

  const handleGenerate = useCallback(() => setIsGenerated(true), [])

  /**
   * Isolate a floor — or `null` to show them all.
   *
   * Three things happen together, and doing them in one place is what makes the
   * control feel like one action rather than three that must be remembered:
   *
   *   1. **The mode changes.**
   *   2. **A selection on another floor is cleared.** Ghosted floors are not
   *      clickable, so a unit selected before isolating would leave the inspector
   *      describing a property the presenter has just deliberately pushed into
   *      the background — and the "Unit" camera preset would fly to it.
   *   3. **The camera frames the new subject.** Choosing a floor is a
   *      presentation instruction, so it puts the camera where that floor reads
   *      best; choosing "All" returns to the building view. This is the
   *      "automatic framing" the subphase asked for, and it makes the isolation
   *      control a single rehearsable click.
   *
   * The view is computed here with the *new* floor spliced into the context,
   * because `isolatedFloorLayout` still holds the old value on this tick — state
   * set in this callback is not readable until the next render.
   */
  const handleIsolateFloor = useCallback(
    (level: number | null) => {
      setIsolatedFloor(level)

      if (level !== null && selectedUnit !== null && selectedUnit.floorLevel !== level) {
        setSelectedUnitId(null)
      }

      const layout =
        level === null ? null : (floors.find((floor) => floor.level === level) ?? null)

      if (layout === null) {
        applyCameraView(
          'building',
          getPresetView('building', { ...presetContext, isolatedFloor: null }),
        )
      } else {
        applyCameraView(
          'floor',
          getPresetView('floor', { ...presetContext, isolatedFloor: layout }),
        )
      }
    },
    [applyCameraView, floors, presetContext, selectedUnit],
  )

  /**
   * Enter or leave the underground view — one action, three consequences.
   *
   * Modelled directly on `handleIsolateFloor`, because it is the same kind of
   * control: a presentation instruction that would be three things to remember
   * if the interface did not do them together.
   *
   *   1. **The mode changes.**
   *   2. **A selection on the wrong side of the datum is cleared.** The stated
   *      priority rule is that the side you are looking at is the side you can
   *      select on (see `underground/undergroundView.ts`), so a selection made
   *      on the other side would leave the inspector describing a property the
   *      presenter has just pushed into the background — and the `unit` camera
   *      preset would fly to it.
   *   3. **The camera frames the new subject.** Entering goes to the
   *      `underground` preset, which puts the eye just above the datum and aims
   *      below it so the tower, the datum and the basement are in one frame.
   *      Leaving returns to the building view. That is what makes this a single
   *      rehearsable click rather than a mode change followed by a hunt.
   *
   * The camera view is computed with the *new* state spliced in where it
   * matters, because state set in this callback is not readable until the next
   * render — the same trick `handleIsolateFloor` and the conflict handler use.
   */
  const handleToggleUndergroundView = useCallback(() => {
    const entering = !isUndergroundView
    setIsUndergroundView(entering)

    // Whichever side is about to become context loses its selection.
    if (entering) {
      if (selectedUnit !== null) setSelectedUnitId(null)
    } else if (selectedRecord !== null && selectedRecord.isUnderground) {
      setSelectedUnitId(null)
    }

    if (entering) {
      applyCameraView(
        'underground',
        getPresetView('underground', { ...presetContext, selectedUnit: null }),
      )
    } else {
      applyCameraView(
        'building',
        getPresetView('building', { ...presetContext, selectedUnit: null }),
      )
    }
  }, [isUndergroundView, selectedUnit, selectedRecord, applyCameraView, presetContext])

  /* ── Conflict focus: a presentation state, entered and left as one action ──
     THE PROBLEM THIS SOLVES
     Before Phase 10 the simulate button changed the record and left the
     presenter to find the consequence: somewhere in a twenty-box building, on
     one of five floors, two boxes had gone red. From the default three-quarter
     view that is a colour change of a few dozen pixels, usually behind another
     floor. The demonstration's strongest moment required the audience to be told
     where to look.

     So triggering the simulation now enters a dedicated presentation state, in
     one click and with no hunting:

       · the conflict's own floor is isolated, so the other four ghost away
       · the exploded view is stood down (see `ViewControls` for why)
       · any selection is cleared, so an amber cage cannot compete with the red
       · the camera flies to frame both properties AND the ghost position
       · the two innocent units on that floor fade almost out (see `Building`)

     THE STATE IT DISPLACES IS REMEMBERED, NOT DISCARDED
     A presenter who had isolated floor 2, exploded the floors and selected a
     unit should get all three back when the conflict is dismissed — otherwise
     the simulation is a one-way door in the middle of a live demo. The four
     displaced values are captured in a ref on the way in and reapplied on the
     way out, together with the camera view that framed them. */

  /** The view state the conflict presentation displaced, or `null`. */
  const preConflictView = useRef<{
    explodeMode: ExplodeMode
    isolatedFloor: number | null
    preset: CameraPresetId
    selectedUnitId: string | null
    isUndergroundView: boolean
  } | null>(null)

  const handleToggleSimulation = useCallback(() => {
    if (!isSimulatingConflict) {
      // ── Entering. Capture first, then displace.
      // Guarded: a second press while the animation is still running must not
      // overwrite the remembered state with the conflict's own state.
      if (preConflictView.current === null) {
        preConflictView.current = {
          explodeMode,
          isolatedFloor,
          preset: activePreset,
          selectedUnitId,
          isUndergroundView,
        }
      }

      setIsSimulatingConflict(true)
      setExplodeMode('none')
      // The staged conflict is between two apartments on one floor above
      // ground. Presenting it from below the datum would put the ghosted tower
      // between the camera and the thing it is meant to be showing, so the
      // underground view stands down for the same reason the explosion does.
      // It is remembered and restored with the rest of the displaced state.
      setIsUndergroundView(false)
      setSelectedUnitId(null)

      const conflictFloor = settledConflictFocus?.floorLevel ?? null
      setIsolatedFloor(conflictFloor)

      const layout =
        conflictFloor === null
          ? null
          : (floors.find((floor) => floor.level === conflictFloor) ?? null)

      // Computed with the *new* isolation and explosion spliced in, because the
      // state set above is not readable until the next render — the same trick
      // `handleIsolateFloor` uses.
      applyCameraView(
        'conflict',
        getPresetView('conflict', {
          ...presetContext,
          selectedUnit: null,
          isolatedFloor: layout,
          explodeAmounts: NO_EXPLOSION,
        }),
      )
      return
    }

    // ── Leaving. Put back exactly what was displaced.
    const previous = preConflictView.current
    preConflictView.current = null

    setIsSimulatingConflict(false)

    if (previous === null) {
      // Nothing was captured — only reachable if the state was cleared by a
      // reset mid-conflict. Fall back to the building view rather than guessing.
      setIsolatedFloor(null)
      applyCameraView('building', getPresetView('building', presetContext))
      return
    }

    setExplodeMode(previous.explodeMode)
    setIsolatedFloor(previous.isolatedFloor)
    setSelectedUnitId(previous.selectedUnitId)
    setIsUndergroundView(previous.isUndergroundView)

    const layout =
      previous.isolatedFloor === null
        ? null
        : (floors.find((floor) => floor.level === previous.isolatedFloor) ?? null)

    // `conflict` is not a view anything can return *to*, so a presenter who
    // triggered the simulation straight from the opening state goes back to the
    // building view. And the explosion is framed by where it is *heading* rather
    // than where it currently is — its ramp has not started yet on this tick.
    const restoredPreset: CameraPresetId =
      previous.preset === 'conflict' ? 'building' : previous.preset

    applyCameraView(
      restoredPreset,
      getPresetView(restoredPreset, {
        ...presetContext,
        selectedUnit: findUnitById(canonicalUnits, previous.selectedUnitId),
        isolatedFloor: layout,
        explodeAmounts: getSettledExplodeAmounts(previous.explodeMode),
      }),
    )
  }, [
    isSimulatingConflict,
    explodeMode,
    isolatedFloor,
    activePreset,
    selectedUnitId,
    settledConflictFocus,
    floors,
    presetContext,
    applyCameraView,
    canonicalUnits,
  ])

  /**
   * Return to the source state so the transformation can be shown again.
   *
   * **Everything the generation produced is undone in this one action.** The
   * selection is cleared because a selected unit that is no longer rendered
   * would leave the inspector describing a property that is not on screen; the
   * exploded view is returned to `'none'` because it is a mode that only
   * applies to a generated building, and leaving it on would mean the next
   * generation animated into an already-separated stack; and the camera returns
   * to the building view so the demo starts from the same picture every time.
   *
   * Doing all four here rather than guarding each one where it is read is what
   * makes reset feel *clean* in a live demo: one press, one known state, no
   * residue from the previous run.
   */
  const handleReset = useCallback(() => {
    setIsGenerated(false)
    setSelectedUnitId(null)
    setExplodeMode('none')
    setIsolatedFloor(null)
    setIsUndergroundView(false)
    setIsValidationDetailOpen(false)
    setIsSimulatingConflict(false)
    // The remembered pre-conflict view describes a building that is about to
    // stop existing, so it is dropped rather than restored.
    preConflictView.current = null
    // The *opening* view, not `getPresetView('building', presetContext)`: at the
    // instant reset is pressed the context still describes an exploded, selected
    // model, and framing that would send the camera somewhere the scene is about
    // to stop being. The opening view is the source state's view by definition.
    applyCameraView('building', openingView)
  }, [applyCameraView, openingView])

  /**
   * The pipeline, derived from the model rather than tracked alongside it.
   *
   * No step can report "complete" because a flag was set somewhere; each is a
   * function of what the model actually contains and of where the animation has
   * got to. See `workflow/pipelineSteps.ts`.
   */
  const pipelineSteps = useMemo(
    () =>
      buildPipelineSteps({
        isGenerated,
        stage: visuals.stage,
        parcelId: parcel.parcelId,
        footprintVertexCount: footprintMetrics.vertexCount,
        footprintAreaSqM: footprintMetrics.areaSqM,
        floorCount: config.numberOfFloors,
        totalHeightM,
        unitCount: units.length,
        // Both below-ground figures are read off the model that is actually
        // rendered and validated, never restated: the count is the length of
        // the generated array, and the depth is the same `getTotalDepthM` the
        // scene and the camera presets measure the excavation with.
        undergroundCount: undergroundSpaces.length,
        basementDepthM: totalDepthM,
        validation: validationReport,
      }),
    [
      isGenerated,
      visuals.stage,
      validationReport,
      parcel.parcelId,
      footprintMetrics,
      config.numberOfFloors,
      totalHeightM,
      units.length,
      undergroundSpaces.length,
      totalDepthM,
    ],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">3D ULPIN</h1>
        <p className="subtitle">Vertical Property &amp; Spatial Cadastre Platform</p>
      </header>

      {/* The standing condition of the record, on one line. It sits between the
          header and the working columns because it is true of everything below
          it — see `ui/ValidationStatusBar.tsx` for why a bar and not a panel. */}
      <ValidationStatusBar
        report={validationReport}
        isDetailOpen={isValidationDetailOpen}
        onToggleDetail={() => setIsValidationDetailOpen((open) => !open)}
        canSimulate={visuals.isSettled && settledConflictFocus !== null}
        isSimulating={isSimulatingConflict}
        onToggleSimulation={handleToggleSimulation}
      />

      {/* Three columns, left to right: where the property is on the ground,
          what it becomes in space, and what the record says about it — input →
          transformation → output. */}
      <main className="viewer">
        <section className="map-panel" aria-label="Cadastral parcel map">
          <GISMap parcel={parcel} />
          <ParcelInfoPanel parcel={parcel} footprintMetrics={footprintMetrics} />
        </section>

        <section className="scene-panel">
          <SceneViewer
            units={units}
            footprint={footprint}
            footprintMetrics={footprintMetrics}
            floors={floors}
            totalHeightM={totalHeightM}
            visuals={visuals}
            explodeAmounts={explodeAmounts}
            floorPlanCentres={floorPlanCentres}
            isolatedFloor={isolatedFloor}
            isolationAmount={isolationAmount}
            conflictedUnitIds={conflictedUnitIds}
            conflictFocus={conflictFocus}
            conflictFocusAmount={conflictFocusAmount}
            conflictFloorOffsetY={conflictFloorOffsetY}
            cameraRequest={cameraRequest}
            initialCameraTarget={openingView.target}
            initialCameraPosition={openingView.position}
            selectedUnitId={selectedUnitId}
            selectedUnit={selectedUnit}
            onSelectUnit={setSelectedUnitId}
            undergroundSpaces={undergroundSpaces}
            aboveGroundEmphasis={aboveGroundEmphasis}
            undergroundEmphasis={undergroundEmphasis}
            undergroundAmount={undergroundAmount}
            basementLevels={basementLevels}
            basementPlanCentres={basementPlanCentres}
          />

          {/* The left-hand read-outs, stacked in one overlay rail rather than
              each pinned at its own absolute offset. The summary is now a
              compact card that grows when its details are expanded, so a fixed
              `top` for the isolation panel beneath it would either overlap the
              expanded card or float clear of the collapsed one. One flow
              container, and the two keep their order in every state. */}
          <div className="scene-overlay-left">
            {/* Still an overlay, and still deliberately so: the summary describes
                the scene it sits on. */}
            <BuildingSummary
              config={config}
              footprintMetrics={footprintMetrics}
              units={units}
              basementConfig={basementConfig}
              undergroundSpaces={undergroundSpaces}
              isGenerated={isGenerated}
            />

            {/* The layer currently in focus, under the summary it narrows. */}
            <FloorIsolationPanel summary={isolationSummary} />
          </div>

          {/* How to look at it — top right, away from what changes it. */}
          <ViewControls
            floorLevels={floorLevels}
            isolatedFloor={isolatedFloor}
            onSelectIsolatedFloor={handleIsolateFloor}
            activePreset={activePreset}
            onSelectPreset={requestCamera}
            hasSelection={selectedUnit !== null}
            explodeMode={explodeMode}
            onSelectExplodeMode={setExplodeMode}
            isSettled={visuals.isSettled}
            conflictFocusActive={isConflictFocusActive}
            isUndergroundView={isUndergroundView}
            onToggleUndergroundView={handleToggleUndergroundView}
            hasUnderground={undergroundSpaces.length > 0}
          />

          {/* What the system is doing, for the two seconds it is doing it. */}
          <GenerationStatus visuals={visuals} isGenerated={isGenerated} />

          {/* THAT there is a finding — one line, top-centre, over the geometry
              it is about. Subphase G: this used to be a 430 px card carrying the
              whole finding, and it sat over the middle of the canvas covering the
              two red units, the intersection volume, the ghost and the arrow —
              the entire visual argument it was describing. The details moved to
              `ConflictPanel` in the right column; what stays over the scene is
              the announcement and the one figure that makes it a measurement
              rather than an alarm. See `ui/ConflictAlert.tsx`. */}
          <ConflictAlert conflicts={ownershipConflicts} />

          {/* The action belongs over the view it changes. */}
          <GenerateCadastreControl
            isGenerated={isGenerated}
            isSettled={visuals.isSettled}
            onGenerate={handleGenerate}
            onReset={handleReset}
            footprintAreaSqM={footprintMetrics.areaSqM}
            unitCount={units.length}
            floorCount={config.numberOfFloors}
          />
        </section>

        <section className="inspector-panel">
          {/* WHAT the finding consists of — docked at the top of the right
              column, above the pipeline and the record, because it outranks
              both and because it is a statement about the record like they are.
              Present only when the engine has actually found something, so the
              column returns to two cards the moment the geometry is restored.
              See `ui/ConflictPanel.tsx` for why a dock rather than a drawer. */}
          <ConflictPanel
            conflicts={ownershipConflicts}
            scenario={isSimulatingConflict ? conflictScenario : null}
            focus={conflictFocus}
          />

          <PipelineStatus
            steps={pipelineSteps}
            statusMessage={getStageMessage(visuals.stage)}
          />
          {/* Opened from the status bar. The bar says whether the record is
              sound; this says how the engine knows. */}
          {isValidationDetailOpen && validationReport !== null && (
            <ValidationDetails report={validationReport} />
          )}
          {/* One inspector for both sides of the datum. It is handed a
              `SpaceRecord`, so it neither knows nor asks which kind of volume
              it is describing — see `ui/spaceRecord.ts`. */}
          <PropertyInspector
            record={selectedRecord}
            isConflicted={
              selectedRecord !== null &&
              conflictedUnitIds.includes(selectedRecord.id)
            }
          />
        </section>
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          {isGenerated
            ? visuals.isSettled
              ? 'Vertical Property Units Active'
              : 'Generating Vertical Cadastre'
            : 'Source Geometry Loaded — Awaiting Generation'}
        </p>
        <p className="hint">
          {isGenerated && visuals.isSettled
            ? 'Click a unit to inspect · Presets to reframe · Exploded view to separate floors · Underground to read below the y = 0 datum · Basemap © OpenStreetMap contributors'
            : 'Press Generate 3D Cadastre to extrude the footprint · Drag to orbit · Basemap © OpenStreetMap contributors'}
        </p>
      </footer>
    </div>
  )
}

export default App
