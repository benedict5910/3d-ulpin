import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Building from './Building'
import Ground from './Ground'
import { DEFAULT_BUILDING_CONFIG, getTotalHeight } from './buildingConfig'

/**
 * The 3D viewport.
 *
 * <Canvas> creates the WebGL renderer, a scene and a camera, and sizes itself
 * to its parent element. Everything nested inside it is 3D, not HTML.
 *
 * The camera and the shadow frustum are sized from the same building config as
 * the geometry, so the framing follows the building instead of being retuned by
 * hand every time the config changes. 1 unit = 1 metre throughout.
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

function SceneViewer() {
  return (
    <Canvas shadows camera={{ position: [26, 18, 30], fov: 45, near: 0.1, far: 400 }}>
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
      <Building />

      {/* Mouse control: drag to orbit, scroll to zoom, right-drag to pan. */}
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
