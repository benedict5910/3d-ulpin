/**
 * A single placeholder building: one box, taller than it is wide.
 *
 * Phase 2 only. It carries no identity, no floors and no data — it exists to
 * prove the 3D pipeline renders. Floors arrive in Phase 3.
 */

const WIDTH = 3
const DEPTH = 3
const HEIGHT = 9

function Building() {
  return (
    // A box is centred on its own origin, so lifting it by half its height
    // puts its base exactly on the ground plane at y = 0.
    <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
      <meshStandardMaterial color="#5b7286" roughness={0.6} metalness={0.05} />
    </mesh>
  )
}

export default Building
