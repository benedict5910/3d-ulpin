/**
 * The ground: a flat plane at y = 0 plus a faint grid, so the building has
 * something to stand on and the eye has a sense of scale while orbiting.
 *
 * Size and divisions are equal, so **one grid square is exactly 1 x 1 metre** —
 * the grid is a visible ruler for the project's 1 unit = 1 metre convention.
 */

const GROUND_SIZE = 120
const GRID_DIVISIONS = 120

function Ground() {
  return (
    <group>
      {/* A plane is created standing upright, so it is rotated flat. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color="#111820" roughness={1} />
      </mesh>

      {/* Lifted a hair above the plane so the two surfaces do not fight. */}
      <gridHelper
        args={[GROUND_SIZE, GRID_DIVISIONS, '#22303d', '#182028']}
        position={[0, 0.01, 0]}
      />
    </group>
  )
}

export default Ground
