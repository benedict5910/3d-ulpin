import {
  DEFAULT_BUILDING_CONFIG,
  buildFloorLayouts,
  type BuildingConfig,
} from './buildingConfig'

/**
 * The building: a stack of procedurally generated floors.
 *
 * Nothing here is hand-placed. The component reads a `BuildingConfig`, asks
 * `buildFloorLayouts` where each floor belongs, and renders one mesh per entry.
 * Changing `numberOfFloors` from 5 to 12 in the config changes the building —
 * this file does not change at all.
 *
 * Replaces the Phase 2 placeholder, which was a single 3 x 9 x 3 box with no
 * internal structure.
 */

/**
 * A purely cosmetic sliver shaved off the top and bottom of each slab, in
 * metres, so the joint between two floors reads as a line instead of a seam
 * that z-fights.
 *
 * It is applied symmetrically to the *geometry height only*. The mesh centre
 * still sits at the true `centerY`, so floor 3 still occupies 6–9 m in the
 * model even though its visible slab is a few centimetres shorter. The logical
 * metre-based model is untouched; only the pixels differ.
 */
const SLAB_VISUAL_GAP = 0.06

/** Two near-identical shades, alternated, so adjacent floors are readable. */
const FLOOR_COLORS = ['#5b7286', '#4d6376'] as const

interface BuildingProps {
  /** Defaults to the prototype's single building. */
  config?: BuildingConfig
}

function Building({ config = DEFAULT_BUILDING_CONFIG }: BuildingProps) {
  const floors = buildFloorLayouts(config)

  return (
    <group>
      {floors.map((floor) => (
        <mesh
          key={floor.index}
          // A box's origin is its centre, so the centre — not the base — is what
          // gets positioned. X and Z stay at 0: the building is centred on the
          // origin and only grows upward.
          position={[0, floor.centerY, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[config.width, config.floorHeight - SLAB_VISUAL_GAP, config.depth]}
          />
          <meshStandardMaterial
            color={FLOOR_COLORS[floor.index % FLOOR_COLORS.length]}
            roughness={0.6}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  )
}

export default Building
