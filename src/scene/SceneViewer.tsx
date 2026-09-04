import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Building from './Building'
import Ground from './Ground'
import { DEFAULT_BUILDING_CONFIG, getTotalHeight } from './buildingConfig'
import type { ApartmentUnit } from './unitLayout'

/**
 * The 3D viewport.
 *
 * <Canvas> creates the WebGL renderer, a scene and a camera, and sizes itself
 * to its parent element. Everything nested inside it is 3D, not HTML.
 *
 * The camera and the shadow frustum are sized from the same building config as
 * the geometry, so the framing follows the building instead of being retuned by
 * hand every time the config changes. 1 unit = 1 metre throughout.
 *
 * Phase 5 gives this component a second job: deciding whether a pointer gesture
 * was a *click* or the end of an orbit *drag*. That decision belongs here
 * because this is the component that owns both the meshes being clicked and the
 * OrbitControls doing the dragging.
 */

const TOTAL_HEIGHT = getTotalHeight(DEFAULT_BUILDING_CONFIG)

/** Orbit about the building's mid-height, so it does not swing off screen. */
const ORBIT_TARGET: [number, number, number] = [0, TOTAL_HEIGHT / 2, 0]

/**
 * Half-width of the sun's shadow camera, in metres. A directional light only
 * casts shadows for what falls inside this box; the default (+/-5 m) would clip
 * an 18 m footprint, so it is widened to cover the building and its shadow.
 */
const SHADOW_EXTENT = 30

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
  /** The generated property units to render. Built once, by the app. */
  units: ApartmentUnit[]
  /** Id of the selected unit, or `null`. */
  selectedUnitId: string | null
  /** Report a new selection upward. `null` clears it. */
  onSelectUnit: (unitId: string | null) => void
}

function SceneViewer({ units, selectedUnitId, onSelectUnit }: SceneViewerProps) {
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
      Math.hypot(event.clientX - start.x, event.clientY - start.y) <=
      DRAG_TOLERANCE_PX
    )
  }

  const handleUnitClick = (unitId: string, event: ThreeEvent<MouseEvent>) => {
    // The ray does not stop at the first box: it continues through the building
    // and reports every unit it passes. Stopping propagation here keeps the
    // selection to the front-most unit — the one actually under the cursor.
    // Done before the drag test, so a drag does not leak through to the units
    // behind either.
    event.stopPropagation()
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
      camera={{ position: [26, 18, 30], fov: 45, near: 0.1, far: 400 }}
      onPointerDown={rememberPointerDown}
      onPointerMissed={handleBackgroundClick}
    >
      {/* Scene background, so the canvas matches the page. */}
      <color attach="background" args={['#0b0f14']} />
      {/* Distance haze, so the grid fades out instead of ending abruptly. */}
      <fog attach="fog" args={['#0b0f14', 60, 150]} />

      {/* Flat fill light — stops unlit faces going pure black. */}
      <ambientLight intensity={0.4} />
      {/* Sun-like light — gives the slabs distinguishable faces and a shadow. */}
      <directionalLight
        position={[24, 34, 18]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
      />

      <Ground />
      <Building
        units={units}
        selectedUnitId={selectedUnitId}
        onUnitClick={handleUnitClick}
      />

      {/* Mouse control: drag to orbit, scroll to zoom, right-drag to pan.
          OrbitControls listens on the canvas element itself, while unit clicks
          come from R3F's raycaster, so the two never compete for the same
          listener — only for the same gesture, which DRAG_TOLERANCE_PX settles. */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        target={ORBIT_TARGET}
        minDistance={12}
        maxDistance={120}
        // Stop the camera dropping below the ground plane.
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  )
}

export default SceneViewer
