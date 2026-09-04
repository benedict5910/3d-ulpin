import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Building from './Building'
import Ground from './Ground'

/**
 * The 3D viewport.
 *
 * <Canvas> creates the WebGL renderer, a scene and a camera, and sizes itself
 * to its parent element. Everything nested inside it is 3D, not HTML.
 */
function SceneViewer() {
  return (
    <Canvas
      shadows
      camera={{ position: [10, 8, 12], fov: 45, near: 0.1, far: 300 }}
    >
      {/* Scene background, so the canvas matches the page. */}
      <color attach="background" args={['#0b0f14']} />
      {/* Distance haze, so the grid fades out instead of ending abruptly. */}
      <fog attach="fog" args={['#0b0f14', 30, 90]} />

      {/* Flat fill light — stops unlit faces going pure black. */}
      <ambientLight intensity={0.4} />
      {/* Sun-like light — gives the box distinguishable faces and a shadow. */}
      <directionalLight
        position={[8, 14, 6]}
        intensity={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Ground />
      <Building />

      {/* Mouse control: drag to orbit, scroll to zoom, right-drag to pan. */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        target={[0, 4, 0]}
        minDistance={5}
        maxDistance={60}
        // Stop the camera dropping below the ground plane.
        maxPolarAngle={Math.PI / 2.05}
      />
    </Canvas>
  )
}

export default SceneViewer
