/**
 * The ground: a flat plane at y = 0 plus a faint grid, so the building has
 * something to stand on and the eye has a sense of scale while orbiting.
 *
 * Size and divisions are equal, so **one grid square is exactly 1 x 1 metre** —
 * the grid is a visible ruler for the project's 1 unit = 1 metre convention.
 *
 * THE PLANE IS NOW ALSO A LID.
 * Before there was anything below y = 0 the plane was scenery. It is now the
 * one surface standing between the camera and four underground property
 * volumes, so the underground view has to be able to see through it — and the
 * plane has to *stay a plane* while that happens, or the datum disappears from
 * the picture at the exact moment the picture is about the datum. Hence an
 * opacity prop rather than a `visible` flag: the ground thins, it does not
 * vanish. See `underground/undergroundView.ts` for where the number comes from.
 */

const GROUND_SIZE = 120
const GRID_DIVISIONS = 120

interface GroundProps {
  /**
   * How opaque the ground plane is, `0`–`1`.
   *
   * Defaults to `1`, so every existing use renders exactly what it rendered
   * before this prop existed.
   */
  opacity?: number
}

function Ground({ opacity = 1 }: GroundProps) {
  const isSolid = opacity >= 1

  return (
    <group>
      {/* A plane is created standing upright, so it is rotated flat. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial
          color="#111820"
          roughness={1}
          transparent={!isSolid}
          opacity={opacity}
          // A translucent lid that still wrote depth would hide the volumes
          // underneath it — which is the entire thing the translucency is for.
          depthWrite={isSolid}
        />
      </mesh>

      {/* Lifted a hair above the plane so the two surfaces do not fight. The
          grid keeps its full strength while the plane thins: it is a ruler for
          the datum, and a fading ruler would take the sense of scale with it at
          the moment the camera drops below the horizon. */}
      <gridHelper
        args={[GROUND_SIZE, GRID_DIVISIONS, '#22303d', '#182028']}
        position={[0, 0.01, 0]}
      />
    </group>
  )
}

export default Ground
