import { useEffect, useMemo } from 'react'

import type { BuildingFootprint, FootprintMetrics } from '../geometry/footprint'
import {
  createFootprintOutlineGeometry,
  createFootprintPadGeometry,
  FOOTPRINT_FLAT_ROTATION,
} from './footprintGeometry'

/**
 * The 2D cadastral footprint, drawn on the ground inside the 3D scene.
 *
 * This component is the visible left-hand side of the project's central
 * equation. It renders **the same polygon the Leaflet map draws** — same array,
 * converted once — lying flat at `y ≈ 0`.
 *
 * PHASE 9: THIS IS NOW THE ENTIRE PRE-GENERATION SCENE.
 * Phase 8 showed a translucent extruded box before generation as a preview of
 * what was coming. That was a mistake, and it was the kind of mistake that costs
 * a demo its point: a viewer who sees a 3D volume on screen before pressing
 * anything has already been shown the answer, and the button that follows looks
 * like it turns on a colour scheme. Worse, it quietly suggested that the 3D form
 * was itself source data — the exact misunderstanding the whole project exists
 * to dispel.
 *
 * So the source state is now honestly two-dimensional: a filled plan, its
 * surveyed outline, corner ticks, and a parcel-aligned base plane. Flat
 * geometry, on the ground, and nothing above it. The centre viewer and the GIS
 * map show the same thing in two projections, which is precisely the claim being
 * made — *this is the 2D record we hold today*.
 *
 * After generation it stays, dimmed. Keeping it is not decoration: it is the
 * evidence that the building's walls land on the surveyed line, which a judge
 * can check by eye from any orbit angle.
 *
 * The colour is the map's footprint green, on purpose — the same shape in two
 * views should not be two colours.
 */

/** Matches `BUILDING_FOOTPRINT_STYLE.color` in `map/parcelStyles.ts`. */
const FOOTPRINT_COLOR = '#4ade80'

/** A centimetre and a half above the ground plane, to avoid z-fighting. */
const PAD_ELEVATION_M = 0.015
/** The outline sits a whisker above the pad, for the same reason. */
const OUTLINE_ELEVATION_M = 0.03
/** The base plane sits just *below* both, so it reads as ground treatment. */
const BASE_PLANE_ELEVATION_M = 0.008

/**
 * How far the parcel-aligned base plane extends past the footprint, in metres.
 *
 * A margin rather than a size: the plane is derived from the footprint's own
 * bounding box plus this, so it frames whatever plan it is given instead of
 * being a rectangle somebody chose. It says "this polygon sits on a surveyed
 * plot", which is the context the source state would otherwise lack.
 */
const BASE_PLANE_MARGIN_M = 4

/** How long each corner tick is, as a fraction of the footprint's smaller side. */
const CORNER_TICK_FRACTION = 0.16

interface FootprintPadProps {
  /** The footprint polygon, in metres, Three.js axes. */
  footprint: BuildingFootprint
  /** The footprint measured once, by `App`. Sizes the base plane and the ticks. */
  footprintMetrics: FootprintMetrics
  /**
   * How strongly to draw it.
   *
   * `1` before generation, when the footprint is the subject of the scene;
   * lower afterwards, when the building it produced is. A number rather than a
   * boolean so the caller can fade it as part of the generation transition.
   */
  emphasis: number
  /**
   * A `0` → `1` → `0` flash at the very start of generation.
   *
   * The animation's first beat: before anything rises, the source geometry is
   * *pointed at*. It brightens and returns, so the sequence visibly begins at
   * the 2D polygon rather than merely beginning.
   */
  pulse: number
}

function FootprintPad({ footprint, footprintMetrics, emphasis, pulse }: FootprintPadProps) {
  const padGeometry = useMemo(() => createFootprintPadGeometry(footprint), [footprint])
  const outlineGeometry = useMemo(
    () => createFootprintOutlineGeometry(footprint, OUTLINE_ELEVATION_M),
    [footprint],
  )

  // Geometries hold GPU buffers; React frees the component, not the buffer.
  useEffect(() => () => padGeometry.dispose(), [padGeometry])
  useEffect(() => () => outlineGeometry.dispose(), [outlineGeometry])

  const { bounds, centroid } = footprintMetrics
  const basePlaneWidth = footprintMetrics.widthM + BASE_PLANE_MARGIN_M * 2
  const basePlaneDepth = footprintMetrics.depthM + BASE_PLANE_MARGIN_M * 2

  /**
   * Four L-shaped corner ticks on the footprint's bounding box.
   *
   * A surveyor's mark, and the cheapest way to make a flat polygon read as a
   * *measured* thing rather than as a coloured shape. Built as plain boxes
   * because four thin boxes cost less thought than a custom line geometry and
   * look identical at this scale.
   */
  const cornerTicks = useMemo(() => {
    const tickLength =
      Math.min(footprintMetrics.widthM, footprintMetrics.depthM) * CORNER_TICK_FRACTION
    const corners: { x: number; z: number; xDir: number; zDir: number }[] = [
      { x: bounds.xMin, z: bounds.zMin, xDir: 1, zDir: 1 },
      { x: bounds.xMax, z: bounds.zMin, xDir: -1, zDir: 1 },
      { x: bounds.xMin, z: bounds.zMax, xDir: 1, zDir: -1 },
      { x: bounds.xMax, z: bounds.zMax, xDir: -1, zDir: -1 },
    ]
    return { tickLength, corners }
  }, [bounds, footprintMetrics.widthM, footprintMetrics.depthM])

  // The pulse rides on top of the resting emphasis rather than replacing it, so
  // it reads as the same object being lit rather than as a different object.
  const lit = Math.min(1, emphasis + pulse * 0.9)

  return (
    <group>
      {/* The parcel-aligned base plane: a soft pad of ground under the plan.
          Present in both states but only really visible in the source state,
          where it gives the flat polygon somewhere to sit. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centroid.x, BASE_PLANE_ELEVATION_M, centroid.z]}
        receiveShadow
      >
        <planeGeometry args={[basePlaneWidth, basePlaneDepth]} />
        <meshStandardMaterial
          color="#16222c"
          transparent
          opacity={0.35 + 0.35 * emphasis}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* The filled plan. Built in the shape plane, so it carries the module's
          rotation — see `footprintGeometry.ts` for why that rotation and the
          shape's sign convention have to travel together. */}
      <mesh
        geometry={padGeometry}
        rotation={FOOTPRINT_FLAT_ROTATION}
        position={[0, PAD_ELEVATION_M, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color={FOOTPRINT_COLOR}
          transparent
          opacity={0.06 + 0.18 * lit}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* The surveyed line itself. Built in world coordinates, so — unlike the
          pad above — it is deliberately *not* rotated. */}
      <lineLoop geometry={outlineGeometry}>
        <lineBasicMaterial
          color={FOOTPRINT_COLOR}
          transparent
          opacity={0.4 + 0.6 * lit}
        />
      </lineLoop>

      {/* Corner ticks. Two arms per corner, pointing inward along each axis. */}
      {cornerTicks.corners.map((corner, index) => (
        <group key={index}>
          <mesh
            position={[
              corner.x + (corner.xDir * cornerTicks.tickLength) / 2,
              OUTLINE_ELEVATION_M,
              corner.z,
            ]}
          >
            <boxGeometry args={[cornerTicks.tickLength, 0.02, 0.12]} />
            <meshBasicMaterial
              color={FOOTPRINT_COLOR}
              transparent
              opacity={0.35 + 0.55 * lit}
            />
          </mesh>
          <mesh
            position={[
              corner.x,
              OUTLINE_ELEVATION_M,
              corner.z + (corner.zDir * cornerTicks.tickLength) / 2,
            ]}
          >
            <boxGeometry args={[0.12, 0.02, cornerTicks.tickLength]} />
            <meshBasicMaterial
              color={FOOTPRINT_COLOR}
              transparent
              opacity={0.35 + 0.55 * lit}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default FootprintPad
