/**
 * Camera presets: named viewpoints, computed from the model.
 *
 * WHY PRESETS EXIST AT ALL
 * A live demo has a script and about ninety seconds. Orbiting by hand to find
 * the top view, then finding the selected apartment again, then getting back to
 * a view that shows the parcel — every one of those is a few seconds of the
 * presenter fighting a trackpad while the audience watches an aimless camera.
 * Four buttons remove that entirely, and they make the demo *repeatable*: the
 * same story shows the same pictures every time it is told.
 *
 * WHY THE VIEWS ARE DERIVED, NOT HARD-CODED
 * Every position below is a multiple of the building's own extent, exactly like
 * the default framing Phase 8 derived from the footprint. Nothing here contains
 * an 18, a 14 or a 15. Change the footprint or add floors and the four presets
 * still frame the building, because they are described in terms of the building
 * rather than in terms of this one building. That is also what lets the
 * "Selected Unit" view work: it frames a box whose position is not known until
 * the user clicks it.
 *
 * WHY THIS FILE HAS NO `three` IMPORT
 * The presets are arithmetic on tuples. Keeping `Vector3` out of them means the
 * whole set of viewpoints can be reasoned about, logged and checked without a
 * renderer; `CameraRig.tsx` is the only file that turns them into camera motion.
 * It is the same split as `geometry/` versus `scene/footprintGeometry.ts`.
 */

import type { FloorLayout } from './buildingConfig'
import type { FootprintMetrics } from '../geometry/footprint'
import type { ConflictFraming } from '../simulation/conflictPresentation'
import {
  getExplodedApparentDepthM,
  getExplodedApparentHeightM,
  getExplodedApparentSpreadM,
  getExplodedOffsetM,
  getUnitDisplayOffsetM,
  type ExplodeAmounts,
  type PlanPoint,
} from './explodedView'
import type { UndergroundSpace } from '../underground/undergroundLayout'
import type { ApartmentUnit } from './unitLayout'

/**
 * The viewpoints the application can fly to.
 *
 * Five of them are buttons (see `CAMERA_PRESETS` at the foot of this file).
 * `conflict` deliberately is not: it is applied *by* the conflict simulation
 * rather than chosen, because the whole point of Phase 10's auto-focus is that a
 * presenter should not have to hunt for the overlap after triggering it. It is
 * still a preset rather than a bespoke camera call, so that it is derived from
 * the model by the same function as every other view and inherits the same
 * flight, the same easing and the same hand-back to OrbitControls.
 */
export type CameraPresetId =
  | 'parcel'
  | 'building'
  | 'top'
  | 'unit'
  | 'floor'
  | 'conflict'
  /**
   * Below the datum. Chosen from the control group like the other five, and
   * applied automatically when the underground view is entered — one press,
   * one arrival, rather than a mode change followed by a hunt for the layer it
   * revealed.
   */
  | 'underground'

/** A camera placement: where the eye is, and what it looks at. Metres. */
export interface CameraView {
  readonly position: readonly [number, number, number]
  readonly target: readonly [number, number, number]
}

/** Everything a preset needs to frame the current model. */
export interface CameraPresetContext {
  /** The footprint, measured once by `App`. Supplies extent and centre. */
  readonly footprintMetrics: FootprintMetrics
  /** Total height of the building, in metres. */
  readonly totalHeightM: number
  /** How many floors are stacked — the exploded view's apparent height needs it. */
  readonly floorCount: number
  /** The selected unit, or `null`. Only the `unit` preset reads it. */
  readonly selectedUnit: ApartmentUnit | null
  /**
   * How far each of the two explosions has got.
   *
   * Views frame what is *drawn*, not what is stored — a building whose floors
   * have separated is twice as tall on screen and a floor whose units have
   * dispersed is eight metres wider, and a preset that ignored that would frame
   * the middle of a model that no longer fits. This is one of only two places
   * the visualisation transform is allowed to influence anything but a mesh
   * position, and it is still a display question: "how much viewport does this
   * need".
   */
  readonly explodeAmounts: ExplodeAmounts
  /**
   * Plan centre of each floor, keyed by 1-based floor level.
   *
   * Needed only by the `unit` preset, which frames the selected unit *where it
   * is drawn*. It calls the same `getUnitDisplayOffsetM` the mesh, the selection
   * cage and the label call, so the camera cannot end up looking at where the
   * unit would have been.
   */
  readonly floorPlanCentres: ReadonlyMap<number, PlanPoint>
  /**
   * The isolated floor's layout, or `null` when nothing is isolated.
   *
   * The resolved `FloorLayout` rather than a level number, so the preset can
   * read the floor's own recorded elevations instead of recomputing them from
   * the config — the same reason the isolation indicator reads them off the
   * units. Only the `floor` preset uses it.
   */
  readonly isolatedFloor: FloorLayout | null
  /**
   * Where the staged conflict is and how much room it needs, or `null`.
   *
   * Computed by `simulation/conflictPresentation.ts` from the **settled** focus,
   * so the camera flies to one destination rather than chasing the property while
   * it slides. Only the `conflict` preset reads it, and like `selectedUnit` it
   * falls back to the building view when absent — the function stays total.
   */
  readonly conflictFraming: ConflictFraming | null
  /**
   * The underground spaces, or an empty list when the model has no basement.
   *
   * Only the `underground` preset reads it, and — like `selectedUnit` and
   * `isolatedFloor` — an empty list falls back to the building view, so the
   * function stays total. It takes the *spaces* rather than a depth number
   * because the view is framed on the volumes' own recorded bounds: the camera
   * looks at what the register contains, not at what the config permits.
   */
  readonly undergroundSpaces: readonly UndergroundSpace[]
  /** How many basement levels there are — the apparent-depth calculation needs it. */
  readonly basementLevelCount: number
  /** Total excavated depth in metres, positive. `0` with no basement. */
  readonly totalDepthM: number
}

/**
 * How long the camera takes to fly to a preset, in milliseconds.
 *
 * Slower than the 620 ms interface transitions on purpose. A camera move is the
 * one animation the viewer is asked to *follow* rather than merely notice: it
 * has to be slow enough to preserve the viewer's sense of where the building is,
 * or the preset becomes a cut and they have to re-orient. Under about 600 ms
 * that spatial continuity breaks; much over a second and it feels sluggish to
 * press.
 */
export const CAMERA_FLIGHT_MS = 850

/**
 * The default framing — Phase 8's derived opening view, unchanged.
 *
 * The multipliers reproduce the hand-tuned `[26, 18, 30]` for the demo's
 * 18 × 14 × 15 m building, which is why they are these numbers and not round
 * ones. See `SceneViewer.tsx` in Phase 8 for the original derivation.
 */
const BUILDING_X_FACTOR = 1.45
const BUILDING_Y_FACTOR = 1.2
const BUILDING_Z_FACTOR = 1.65

/** The parcel view pulls back and drops the eye, so the ground reads as ground. */
const PARCEL_DISTANCE_FACTOR = 2.35
const PARCEL_HEIGHT_FACTOR = 0.95

/** Straight down, at a height that fits the plan comfortably in frame. */
const TOP_HEIGHT_FACTOR = 2.6

/**
 * A hair of Z offset on the top view.
 *
 * An orbit controller looking *exactly* straight down has no unambiguous "up"
 * direction, and the resulting singularity shows up as the view snapping through
 * a rotation the moment the user touches the mouse. Two centimetres of offset
 * is invisible at this scale and removes it.
 */
const TOP_VIEW_EPSILON_M = 0.02

/** How far the eye sits from a selected unit, as a multiple of its own size. */
const UNIT_DISTANCE_FACTOR = 3.1
/** And how far above it, so the view looks slightly down onto the property. */
const UNIT_HEIGHT_FACTOR = 1.35

/**
 * How far back the isolated-floor view sits, as a multiple of the plan extent.
 *
 * Closer than the building view: the subject is one 3 m-thick layer rather than
 * a 15 m building, so the same distance would waste most of the frame on sky.
 */
const FLOOR_DISTANCE_FACTOR = 1.15
/**
 * And how far above the layer's own mid-height, again as a multiple of extent.
 *
 * Low. A floor is a flat thing; looking steeply down at it collapses the four
 * property volumes into a plan and loses exactly the third dimension the view is
 * meant to be showing. Just enough elevation to see the tops.
 */
const FLOOR_HEIGHT_FACTOR = 0.42

/**
 * How far the conflict view sits from the disputed region, as a multiple of the
 * region's own bounding radius.
 *
 * Close. The subject is two apartments and the volume between them — about
 * 22 × 7 × 3 m for the demo pair — and this is the one view in the application
 * whose job is to make something *small* unmissable rather than to show a
 * building in context. Anything further back and the overlap is a detail again.
 */
const CONFLICT_DISTANCE_FACTOR = 1.85

/**
 * And how far above the region's own centre, as a multiple of the same radius.
 *
 * A three-quarter view rather than a plan view, on purpose. Looking down at an
 * ownership overlap collapses it into a plan, which is exactly the projection a
 * 2D cadastre already offers and exactly the projection in which this defect is
 * invisible. The whole argument of the phase is that the dispute is about a
 * *volume*, so the camera has to see three dimensions of it.
 */
const CONFLICT_HEIGHT_FACTOR = 0.78

/**
 * How far back the underground view sits, as a multiple of the plan extent.
 *
 * A little closer than the parcel view and further than the floor view: the
 * subject is one 3 m layer, but it has to be seen *with the datum above it and
 * the tower above that*, or the picture says "here is a box" rather than "here
 * is a box under a building".
 */
const UNDERGROUND_DISTANCE_FACTOR = 1.55

/**
 * And where the eye sits vertically, as a multiple of the plan extent — a small
 * positive lift **above the datum**, not below it.
 *
 * This is the one number in the file most likely to be got wrong, so it is
 * worth saying why it is not negative. The instinct is to put the camera
 * underground to look at underground things. Do that and the ground plane fills
 * the top of the frame, the tower disappears behind it, and the shot loses the
 * relationship it exists to show. Keeping the eye just above the datum and
 * *aiming* below it gives the view that actually reads: the building rising
 * away, the datum as a line across the middle, and the basement volumes sitting
 * under it. The audience sees `y > 0`, `y = 0` and `y < 0` in one frame.
 */
const UNDERGROUND_HEIGHT_FACTOR = 0.30

/**
 * How far below the datum the view aims, as a fraction of the apparent depth.
 *
 * Not the basement's centre — a touch above it, so the datum plane stays inside
 * the frame rather than sitting on its upper edge.
 */
const UNDERGROUND_TARGET_FRACTION = 0.55

/**
 * Compute the view for a preset.
 *
 * `unit` falls back to the building view when nothing is selected, so the
 * function is total: there is no context in which it cannot answer. The
 * interface disables the button as well, but a preset that could return
 * `null` would push that decision into every caller.
 */
export function getPresetView(
  preset: CameraPresetId,
  context: CameraPresetContext,
): CameraView {
  const { footprintMetrics, totalHeightM, floorCount, explodeAmounts } = context
  const centreX = footprintMetrics.centroid.x
  const centreZ = footprintMetrics.centroid.z

  // What is on screen, not what the model records — see `explodedView.ts`.
  const apparentHeight = getExplodedApparentHeightM(
    totalHeightM,
    floorCount,
    explodeAmounts.floors,
  )
  const extent = getExplodedApparentSpreadM(
    Math.max(footprintMetrics.widthM, footprintMetrics.depthM),
    explodeAmounts.units,
  )

  switch (preset) {
    /**
     * PARCEL VIEW — the property in its context.
     *
     * Low and far back, targeted at the ground rather than at the building's
     * waist, so the footprint, the plot around it and the building's relationship
     * to both are all in frame. This is the view the demo opens the story on:
     * "here is a parcel of land".
     */
    case 'parcel':
      return {
        position: [
          centreX + extent * PARCEL_DISTANCE_FACTOR,
          apparentHeight * PARCEL_HEIGHT_FACTOR + extent * 0.35,
          centreZ + extent * PARCEL_DISTANCE_FACTOR,
        ],
        target: [centreX, 0, centreZ],
      }

    /**
     * TOP VIEW — the cadastral plan view.
     *
     * Directly overhead, which is the projection every 2D cadastre in the world
     * is drawn in. Its value in this demo is the comparison it invites: the top
     * view of the generated building is the footprint on the map, and being able
     * to put those side by side is the clearest possible statement of what the
     * prototype does.
     */
    case 'top':
      return {
        position: [
          centreX,
          Math.max(apparentHeight * 1.8, extent * TOP_HEIGHT_FACTOR),
          centreZ + TOP_VIEW_EPSILON_M,
        ],
        target: [centreX, 0, centreZ],
      }

    /**
     * SELECTED UNIT — the individual property.
     *
     * Framed on the unit's own centre, at a distance derived from the unit's own
     * size, and lifted by the exploded offset so it follows the box the user can
     * actually see. This is the view that makes the point of a *3D* cadastre:
     * the record is not the building, it is this box inside it.
     */
    case 'unit': {
      const unit = context.selectedUnit
      if (unit === null) {
        return getPresetView('building', context)
      }

      // The one shared offset function — see `explodedView.ts`. The camera looks
      // at the box the user can see, not at the box the register records.
      const [offsetX, offsetY, offsetZ] = getUnitDisplayOffsetM(
        unit,
        context.floorPlanCentres.get(unit.floorLevel) ?? { x: 0, z: 0 },
        explodeAmounts,
      )

      const unitCentreX = (unit.xMin + unit.xMax) / 2 + offsetX
      const unitCentreZ = (unit.zMin + unit.zMax) / 2 + offsetZ
      const unitCentreY = (unit.yMin + unit.yMax) / 2 + offsetY

      const unitExtent = Math.max(unit.width, unit.depth, unit.height)
      const distance = unitExtent * UNIT_DISTANCE_FACTOR

      return {
        position: [
          unitCentreX + distance,
          unitCentreY + unitExtent * UNIT_HEIGHT_FACTOR,
          unitCentreZ + distance,
        ],
        target: [unitCentreX, unitCentreY, unitCentreZ],
      }
    }

    /**
     * ISOLATED FLOOR — one ownership layer, filling the frame.
     *
     * Framed on the isolated floor's own mid-height, lifted by whatever the
     * exploded view has done to that floor so the camera follows the layer
     * rather than the elevation the register records. Falls back to the building
     * view when nothing is isolated, so — like `unit` — the function stays
     * total.
     *
     * This is what makes isolation a *presentation* feature rather than a
     * rendering one: choosing a floor both dims the others and puts the camera
     * where that floor reads best, in one action, repeatably.
     */
    case 'floor': {
      const floor = context.isolatedFloor
      if (floor === null) {
        return getPresetView('building', context)
      }

      const floorY =
        floor.centerY + getExplodedOffsetM(floor.index, explodeAmounts.floors)

      return {
        position: [
          centreX + extent * FLOOR_DISTANCE_FACTOR,
          floorY + extent * FLOOR_HEIGHT_FACTOR,
          centreZ + extent * FLOOR_DISTANCE_FACTOR,
        ],
        target: [centreX, floorY, centreZ],
      }
    }

    /**
     * CONFLICT VIEW — both disputing properties, and the volume between them.
     *
     * Framed on the union of the moved property, the property it hit, **and the
     * canonical position it came from**, so the ghost is never off the edge of
     * the shot. That inclusion is the whole reason the framing is a derived
     * union rather than "look at the intersection": the intersection is the
     * answer, and the ghost is the evidence for it.
     *
     * Applied automatically when the simulation is triggered. The presenter
     * presses one button and arrives, orbit controls intact, looking at the two
     * red volumes with the disputed region between them — rather than pressing
     * one button and then hunting for what changed.
     */
    case 'conflict': {
      const framing = context.conflictFraming
      if (framing === null) {
        return getPresetView('building', context)
      }

      const [centreConflictX, centreConflictY, centreConflictZ] = framing.centre
      const distance = framing.radiusM * CONFLICT_DISTANCE_FACTOR

      return {
        position: [
          centreConflictX + distance,
          centreConflictY + framing.radiusM * CONFLICT_HEIGHT_FACTOR,
          centreConflictZ + distance,
        ],
        target: [centreConflictX, centreConflictY, centreConflictZ],
      }
    }

    /**
     * UNDERGROUND VIEW — the layer below the datum, with the datum in shot.
     *
     * Framed from the underground volumes' **own recorded bounds** rather than
     * from the basement config, so the camera looks at what the register
     * actually contains. Lifted by whatever the downward explosion has done to
     * those levels, via the same `getExplodedApparentDepthM` the transform
     * itself is built on — so the view follows the layer rather than the
     * elevation the register records, exactly as the `floor` preset does above
     * ground.
     *
     * Falls back to the building view when there is no basement, so — like
     * `unit`, `floor` and `conflict` — the function stays total.
     */
    case 'underground': {
      if (context.undergroundSpaces.length === 0) {
        return getPresetView('building', context)
      }

      // What is on screen: the excavation plus however far the exploded view
      // has pushed it down.
      const apparentDepth = getExplodedApparentDepthM(
        context.totalDepthM,
        context.basementLevelCount,
        explodeAmounts.floors,
      )

      // Aimed below the datum, at the layer — never at the building's waist.
      const targetY = -apparentDepth * UNDERGROUND_TARGET_FRACTION

      return {
        position: [
          centreX + extent * UNDERGROUND_DISTANCE_FACTOR,
          // Above the datum, looking down across it. See the note on the
          // constant for why this is positive.
          extent * UNDERGROUND_HEIGHT_FACTOR,
          centreZ + extent * UNDERGROUND_DISTANCE_FACTOR,
        ],
        target: [centreX, targetY, centreZ],
      }
    }

    /**
     * BUILDING VIEW — the working view, and the default.
     *
     * The three-quarter view the scene has opened on since Phase 3. It is the
     * one the model is easiest to orbit from and the one everything else returns
     * to; `reset` uses it, and the `unit` preset falls back to it.
     */
    case 'building':
    default:
      return {
        position: [
          centreX + extent * BUILDING_X_FACTOR,
          apparentHeight * BUILDING_Y_FACTOR,
          centreZ + extent * BUILDING_Z_FACTOR,
        ],
        target: [centreX, apparentHeight / 2, centreZ],
      }
  }
}

/**
 * Label and ordering for the preset **buttons**. Declared beside the views.
 *
 * `conflict` is absent by design — it is applied by the simulation, not chosen
 * from the control group, and a sixth button that only worked while a conflict
 * was staged would be disabled for the entire rest of the demonstration. It still
 * shows in the control group as *no* button pressed, which is the honest state:
 * the current view is not one of the five named ones.
 */
export const CAMERA_PRESETS: readonly { id: CameraPresetId; label: string }[] = [
  { id: 'parcel', label: 'Parcel' },
  { id: 'building', label: 'Building' },
  { id: 'top', label: 'Top' },
  { id: 'floor', label: 'Floor' },
  { id: 'unit', label: 'Unit' },
  // Present in the group, unlike `conflict`, because a presenter chooses to
  // look below the datum the same way they choose to look at the plan — and
  // because the basement exists from the moment the cadastre is generated, so
  // the button is never a control that only works during one staged moment.
  { id: 'underground', label: 'Underground' },
]
