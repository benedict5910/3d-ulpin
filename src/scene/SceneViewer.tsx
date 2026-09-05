import { useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Building from './Building'
import GroundDatum from './GroundDatum'
import UndergroundSpaces from './UndergroundSpaces'
import BuildingShell from './BuildingShell'
import ConflictOverlay from './ConflictOverlay'
import CameraRig, { type CameraRequest } from './CameraRig'
import FloorSlabs from './FloorSlabs'
import FootprintPad from './FootprintPad'
import Ground from './Ground'
import SceneLabels from './SceneLabels'
import type { FloorLayout } from './buildingConfig'
import type { BasementLevelLayout } from './basementConfig'
import type { GenerationVisuals } from '../animation/generationTimeline'
import type { ExplodeAmounts, PlanPoint } from './explodedView'
import type { BuildingFootprint, FootprintMetrics } from '../geometry/footprint'
import type { ApartmentUnit } from './unitLayout'
import type { ConflictFocus } from '../simulation/conflictPresentation'
import type { UndergroundSpace } from '../underground/undergroundLayout'
import {
  getGroundPlaneOpacity,
  type DatumEmphasis,
} from '../underground/undergroundView'

/**
 * How far the camera may tip toward the horizon above ground.
 *
 * Just short of 90°, so it can never drop under the ground plane and look at
 * the building through its own floor.
 */
const ABOVE_GROUND_POLAR_LIMIT = Math.PI / 2.05

/**
 * And in the underground view, where going below the horizon is the point.
 *
 * Short of a full nadir (π) for the same reason the top preset carries a two
 * centimetre Z offset: an orbit controller pointed exactly along the axis has
 * no unambiguous "up", and the singularity shows up as the view snapping
 * through a rotation the moment the mouse moves.
 */
const UNDERGROUND_POLAR_LIMIT = Math.PI / 1.15

/**
 * The 3D viewport.
 *
 * <Canvas> creates the WebGL renderer, a scene and a camera, and sizes itself
 * to its parent element. Everything nested inside it is 3D, not HTML.
 *
 * PHASE 9 — WHAT THIS COMPONENT DRAWS, AND WHEN
 * The viewer has two resting states and one transition between them, and the
 * transition is the phase:
 *
 *   Source state      ground · base plane · footprint polygon · corner ticks
 *                     — flat geometry only, nothing above the ground plane
 *
 *   Transition        the footprint pulses · the envelope rises out of it ·
 *                     floor plates appear bottom-up · property units grow into
 *                     place floor by floor as the envelope hands over
 *
 *   Generated state   ground · footprint · floor plates · twenty property units
 *
 *   Exploded          the same generated state, with the floors lifted apart and
 *                     — at the second level — each floor's units slid outward
 *                     from its centre. Offsets only: see `explodedView.ts`.
 *
 * The critical change from Phase 8 is the **source state**. It used to include a
 * translucent extruded box, which showed the audience the answer before the
 * question was asked and implied the 3D form was source data. It is gone. What
 * remains before generation is exactly what a 2D cadastral record contains: a
 * plot, a plan, and no third dimension.
 *
 * WHERE THE TIMING LIVES — NOT HERE
 * This component receives a `GenerationVisuals` object and distributes it. It
 * holds no animation state, runs no timers and makes no decisions about
 * sequencing; `animation/generationTimeline.ts` computes all of that from one
 * progress number. That is what makes the transition deterministic: there is no
 * combination of props this component can be in that does not correspond to a
 * single point on the timeline.
 *
 * Phase 5 gave this component a second job: deciding whether a pointer gesture
 * was a *click* or the end of an orbit *drag*. That decision belongs here
 * because this is the component that owns both the meshes being clicked and the
 * OrbitControls doing the dragging.
 *
 * 1 unit = 1 metre throughout.
 */

/**
 * How far past the building the sun's shadow camera must reach, as a multiple
 * of the building's largest horizontal extent.
 *
 * A directional light only casts shadows for what falls inside its box, and
 * Three.js's default (±5 m) would clip an 18 m footprint. It is derived from the
 * footprint rather than fixed, like everything else horizontal.
 */
const SHADOW_EXTENT_FACTOR = 1.7

/** A floor for the shadow box, so a very small building still casts sensibly. */
const MINIMUM_SHADOW_EXTENT_M = 24

/**
 * How far the pointer may travel between press and release and still count as a
 * click, in CSS pixels.
 *
 * OrbitControls and unit selection share one pointer, and the browser fires a
 * `click` at the end of a drag just as it does at the end of a tap. Without a
 * threshold, every rotation of the camera that happened to start on a unit
 * would also select that unit. A few pixels of slack absorbs the hand tremor in
 * a genuine click without letting a deliberate drag through.
 */
const DRAG_TOLERANCE_PX = 5

interface SceneViewerProps {
  /** The generated property units to render — the display record, from `App`. */
  units: readonly ApartmentUnit[]
  /**
   * The building footprint — the polygon everything horizontal is derived from.
   *
   * The viewer draws it, extrudes it for the envelope, and measures it for the
   * shadow box. It does not own it: `App` reads it off the parcel, exactly as it
   * reads the units off the model layer.
   */
  footprint: BuildingFootprint
  /** The footprint measured once, by `App`. Never re-measured here. */
  footprintMetrics: FootprintMetrics
  /** The floors, from `buildFloorLayouts` — one floor plate each. */
  floors: readonly FloorLayout[]
  /** Total height of the building in metres — from the config, not the footprint. */
  totalHeightM: number
  /**
   * The whole generation transition at this instant, derived by
   * `animation/generationTimeline.ts` from one progress value.
   */
  visuals: GenerationVisuals
  /**
   * How far each of the two explosions has got. A display transform only — see
   * `explodedView.ts`. Distributed to the plates, the units and the labels.
   */
  explodeAmounts: ExplodeAmounts
  /** Plan centre of each floor, keyed by 1-based floor level. Built once by `App`. */
  floorPlanCentres: ReadonlyMap<number, PlanPoint>
  /**
   * The 1-based floor the presenter has isolated, or `null`.
   *
   * Appearance and targeting only — see `floorIsolation.ts`. It composes with
   * the exploded view by multiplication rather than by special cases, so every
   * combination of the two is defined.
   */
  isolatedFloor: number | null
  /** How far the ghosting transition has got, `0`–`1`. */
  isolationAmount: number
  /**
   * Ids the validation engine has flagged as being in conflict.
   *
   * Straight from `TopologyReport.conflictedUnitIds`. The scene paints these red
   * and decides nothing about what a conflict is.
   */
  conflictedUnitIds: readonly string[]
  /**
   * The staged conflict, derived by `App` on every frame of the slide.
   *
   * Distributed to two places and no others: `Building`, which uses it only to
   * decide which two units are the subject, and `ConflictOverlay`, which draws
   * the ghost, the arrow and the disputed volume. See
   * `simulation/conflictPresentation.ts` for why that is a fourth kind of
   * geometry rather than a fourth thing a unit can be.
   */
  conflictFocus: ConflictFocus | null
  /** How far the conflict focus has arrived, `0`–`1`. */
  conflictFocusAmount: number
  /**
   * The vertical display offset of the conflict's floor, in metres.
   *
   * Computed by `App` from the same `getExplodedOffsetM` the floor's own plate
   * and units use, so the overlay travels with the layer it describes.
   */
  conflictFloorOffsetY: number
  /** Where the camera should be flying to, or `null`. */
  cameraRequest: CameraRequest | null
  /** Where the orbit target sits before any preset is pressed. */
  initialCameraTarget: readonly [number, number, number]
  /** Where the camera starts, before any preset is pressed. */
  initialCameraPosition: readonly [number, number, number]
  /** Id of the selected unit, or `null`. */
  selectedUnitId: string | null
  /** The resolved selected unit, for the scene label. */
  selectedUnit: ApartmentUnit | null
  /** Report a new selection upward. `null` clears it. */
  onSelectUnit: (unitId: string | null) => void

  /* ── Below the ground datum ───────────────────────────────────────────── */

  /** The generated underground spaces. Read, never written. */
  undergroundSpaces: readonly UndergroundSpace[]
  /**
   * How strongly the above-ground building is drawn, and whether it is a target.
   *
   * Derived by `App` from one scalar via `underground/undergroundView.ts`, and
   * distributed here rather than computed per mesh. Multiplies with floor
   * isolation and conflict focus inside `Building`, so all their combinations
   * are defined.
   */
  aboveGroundEmphasis: DatumEmphasis
  /** The same, for the underground volumes. */
  undergroundEmphasis: DatumEmphasis
  /** How far the underground transition has arrived, `0`–`1`. */
  undergroundAmount: number
  /**
   * The basement levels, for the exploded-stack labels.
   *
   * Passed straight through to `SceneLabels`, exactly as `floors` is: the
   * viewer draws no basement label itself and holds no opinion about when one
   * is warranted. Built by `App` from the basement configuration.
   */
  basementLevels: readonly BasementLevelLayout[]
  /**
   * Plan centre of each basement level, keyed by 1-based level.
   *
   * The below-ground counterpart of `floorPlanCentres`, measured once by `App`
   * with the shared helper in `explodedView.ts` so both tiers explode about a
   * centre computed the same way.
   */
  basementPlanCentres: ReadonlyMap<number, PlanPoint>
}

function SceneViewer({
  units,
  footprint,
  footprintMetrics,
  floors,
  totalHeightM,
  visuals,
  explodeAmounts,
  floorPlanCentres,
  isolatedFloor,
  isolationAmount,
  conflictedUnitIds,
  conflictFocus,
  conflictFocusAmount,
  conflictFloorOffsetY,
  cameraRequest,
  initialCameraTarget,
  initialCameraPosition,
  selectedUnitId,
  selectedUnit,
  onSelectUnit,
  undergroundSpaces,
  aboveGroundEmphasis,
  undergroundEmphasis,
  undergroundAmount,
  basementLevels,
  basementPlanCentres,
}: SceneViewerProps) {
  /**
   * The shadow box, measured from the footprint the scene is actually drawing.
   *
   * `useMemo` because it feeds a light's projection, and this component
   * re-renders on every frame of the generation transition.
   */
  const shadowExtent = useMemo(() => {
    const horizontalExtent = Math.max(footprintMetrics.widthM, footprintMetrics.depthM)
    return Math.max(MINIMUM_SHADOW_EXTENT_M, horizontalExtent * SHADOW_EXTENT_FACTOR)
  }, [footprintMetrics])

  /**
   * The opening camera placement.
   *
   * Frozen on the first render with a ref, not recomputed: `<Canvas camera>` is
   * an *initial* configuration, and handing R3F a fresh object literal on every
   * one of the sixty frames of a transition churns its camera reconciliation for
   * no benefit. Everything after the first frame is the camera rig's job.
   */
  const openingCamera = useRef(initialCameraPosition)

  /**
   * Where the pointer went down, in screen coordinates.
   *
   * A ref rather than state on purpose: it is read during event handling and
   * must never cause a re-render. Re-rendering the scene mid-drag would be
   * both pointless and expensive.
   */
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null)

  const rememberPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerDownAt.current = { x: event.clientX, y: event.clientY }
  }

  /** True when the pointer barely moved since it went down. */
  const isClickNotDrag = (event: { clientX: number; clientY: number }) => {
    const start = pointerDownAt.current
    // No recorded press (synthetic or keyboard-driven activation): treat it as
    // a click rather than silently swallowing it.
    if (start === null) return true
    return (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) <= DRAG_TOLERANCE_PX
    )
  }

  const handleUnitClick = (unitId: string, event: ThreeEvent<MouseEvent>) => {
    // The ray does not stop at the first box: it continues through the building
    // and reports every unit it passes. Stopping propagation here keeps the
    // selection to the front-most unit — the one actually under the cursor.
    // Done before either test below, so neither a drag nor a mid-transition
    // click leaks through to the units behind.
    event.stopPropagation()
    // Selection becomes available only once the generation has *settled* — not
    // merely once it has been requested. See `generationTimeline.ts`.
    if (!visuals.unitsInteractive) return
    if (!isClickNotDrag(event)) return
    onSelectUnit(unitId)
  }

  /**
   * Fired by R3F when a click hits none of the interactive meshes — the sky or
   * the ground. Clicking away clears the selection; releasing an orbit drag
   * over empty space does not.
   */
  const handleBackgroundClick = (event: MouseEvent) => {
    if (isClickNotDrag(event)) onSelectUnit(null)
  }

  return (
    <Canvas
      shadows
      // Cap the device pixel ratio at 2: beyond that a retina display costs four
      // times the fragments for a difference nobody can see, and a demo laptop
      // driving a projector needs the headroom.
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [...openingCamera.current], fov: 45, near: 0.1, far: 400 }}
      onPointerDown={rememberPointerDown}
      onPointerMissed={handleBackgroundClick}
    >
      {/* Scene background, so the canvas matches the page. */}
      <color attach="background" args={['#0b0f14']} />
      {/* Distance haze, so the grid fades out instead of ending abruptly. */}
      <fog attach="fog" args={['#0b0f14', 65, 165]} />

      {/* LIGHTING — three lights doing three jobs, which is the difference
          between a rendering and a picture.

          Hemisphere: a cool sky above and a dark ground below, so upward-facing
          surfaces read differently from downward-facing ones even where no
          direct light reaches. This is what stops the underside of a floor plate
          going flat black in the exploded view. */}
      <hemisphereLight args={['#4e6a85', '#0b0f14', 0.55]} />
      <ambientLight intensity={0.28} />

      {/* Key: sun-like, and the only caster. One shadow source keeps the model
          readable; a second would produce crossing shadows that read as noise. */}
      <directionalLight
        position={[26, 36, 20]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        // Pulls the shadow off the surface casting it, removing the stippled
        // self-shadowing ("acne") that a large shadow box makes visible.
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {/* Fill: from the opposite side, no shadow, low intensity. It recovers the
          faces the key light leaves in silhouette so the building has three
          readable sides instead of two lit ones and a black one. */}
      <directionalLight position={[-22, 14, -18]} intensity={0.5} />

      {/* The ground plane thins as the underground view arrives, so the four
          volumes below the datum become visible without the datum itself
          disappearing from the picture. See `underground/undergroundView.ts`. */}
      <Ground opacity={getGroundPlaneOpacity(undergroundAmount)} />

      {/* The datum itself, drawn as a ring on the building's own footprint at
          exactly y = 0. Present from the first frame — it is always true — and
          brightening as the view that is about it arrives. */}
      <GroundDatum footprint={footprint} undergroundAmount={undergroundAmount} />

      {/* THE PIPELINE, IN DRAW ORDER.

          1. The surveyed plan on the ground, with its base plane and corner
             ticks. Always present: before generation it is the entire scene,
             and afterwards it is the proof that the walls landed on the line. */}
      <FootprintPad
        footprint={footprint}
        footprintMetrics={footprintMetrics}
        emphasis={visuals.footprintEmphasis}
        pulse={visuals.footprintPulse}
      />

      {/* 2. The same plan extruded upward — the envelope. Absent in the source
             state, grown during the transition, gone once the units exist. Its
             rise *is* the 2D → 3D extrusion, animated. */}
      <BuildingShell
        footprint={footprint}
        totalHeightM={totalHeightM}
        heightFraction={visuals.shellHeightFraction}
        presence={visuals.shellPresence}
      />

      {/* 3. The volume divided into levels: one plate per floor, appearing
             bottom-up. The stratification, shown before the subdivision. */}
      <FloorSlabs
        footprint={footprint}
        floors={floors}
        reveal={visuals.floorReveal}
        explodeAmounts={explodeAmounts}
        isolatedFloor={isolatedFloor}
        isolationAmount={isolationAmount}
        undergroundAmount={undergroundAmount}
      />

      {/* 4. Each level divided into individually identified vertical property
             units — the cadastral result. */}
      <Building
        units={units}
        selectedUnitId={selectedUnitId}
        onUnitClick={handleUnitClick}
        floorReveal={visuals.unitReveal}
        explodeAmounts={explodeAmounts}
        floorPlanCentres={floorPlanCentres}
        interactive={visuals.unitsInteractive}
        isolatedFloor={isolatedFloor}
        isolationAmount={isolationAmount}
        conflictedUnitIds={conflictedUnitIds}
        conflictFocus={conflictFocus}
        conflictFocusAmount={conflictFocusAmount}
        datumEmphasis={aboveGroundEmphasis}
      />

      {/* 4b. The same subdivision below the datum: one basement level cut into
             four independently identified underground volumes. Drawn after the
             units and before the conflict overlay, and in its own component
             rather than as more entries in <Building> — an underground space is
             a different record with a different identifier scheme, and a loop
             that iterated both would have to ask which kind each one was on
             every pass. */}
      <UndergroundSpaces
        spaces={undergroundSpaces}
        selectedUnitId={selectedUnitId}
        onSpaceClick={handleUnitClick}
        emphasis={undergroundEmphasis}
        revealed={visuals.isSettled}
        explodeAmounts={explodeAmounts}
        conflictedUnitIds={conflictedUnitIds}
      />

      {/* 5. When a conflict is staged: the canonical position it came from, how
             far it moved, and the volume two records now both claim. Drawn
             after the units so the disputed region composites over them, and
             deliberately *outside* <Building> — none of it is a property. */}
      <ConflictOverlay
        focus={conflictFocus}
        presence={conflictFocusAmount}
        floorOffsetY={conflictFloorOffsetY}
      />

      {/* 6. The few labels that earn their place. */}
      <SceneLabels
        floors={floors}
        footprintMetrics={footprintMetrics}
        selectedUnit={selectedUnit}
        explodeAmounts={explodeAmounts}
        floorPlanCentres={floorPlanCentres}
        isolatedFloor={isolatedFloor}
        isSettled={visuals.isSettled}
        basementLevels={basementLevels}
        basementPlanCentres={basementPlanCentres}
        // The decks themselves, for the `B1 · PARKING` captions, and how far
        // the underground view has arrived, which is what gates them.
        undergroundSpaces={undergroundSpaces}
        undergroundAmount={undergroundAmount}
        // Deliberately `null`. That label reads `spaceCode` and `tier` off
        // `scene/basementLayout`'s subdivided `UndergroundUnit`, a record type
        // the live pipeline no longer generates. It is a missing label rather
        // than a wrong one — and since the redesign the gap it left is covered:
        // every deck now carries a standing `B1 · PARKING` caption, so a
        // below-ground selection is never an unnamed box on screen.
        selectedUndergroundUnit={null}
      />

      {/* Mouse control: drag to orbit, scroll to zoom, right-drag to pan.
          OrbitControls listens on the canvas element itself, while unit clicks
          come from R3F's raycaster, so the two never compete for the same
          listener — only for the same gesture, which DRAG_TOLERANCE_PX settles.

          `target` is deliberately *not* a prop any more: the camera rig owns the
          orbit target so it can animate it, and a declarative prop would be
          re-applied on every render and fight the flight. See `CameraRig.tsx`. */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={8}
        maxDistance={140}
        // How far the camera may tip toward — and past — the horizon.
        //
        // Above ground the limit stops the camera dropping under the ground
        // plane, where the model would be seen through its own floor and the
        // scene would read as broken. In the underground view that is exactly
        // where the presenter needs to be able to go, so the limit relaxes as
        // the mode arrives rather than being removed: `UNDERGROUND_POLAR_LIMIT`
        // still stops the camera reaching a full nadir, where the orbit
        // controller loses its unambiguous "up" and the view snaps.
        //
        // Interpolated rather than switched, so a presenter who is already
        // orbiting when the mode changes is not jerked to a new limit.
        maxPolarAngle={
          ABOVE_GROUND_POLAR_LIMIT +
          (UNDERGROUND_POLAR_LIMIT - ABOVE_GROUND_POLAR_LIMIT) * undergroundAmount
        }
      />

      {/* Declared after OrbitControls so that `makeDefault` has published them
          by the time the rig's first frame runs. */}
      <CameraRig request={cameraRequest} initialTarget={initialCameraTarget} />
    </Canvas>
  )
}

export default SceneViewer
