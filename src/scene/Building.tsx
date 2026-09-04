import {
  DEFAULT_BUILDING_CONFIG,
  buildFloorLayouts,
  type BuildingConfig,
} from './buildingConfig'
import { buildApartmentUnits, getUnitCenter } from './unitLayout'

/**
 * The building: a stack of floors, each subdivided into independent property
 * units, all generated procedurally.
 *
 * Nothing here is hand-placed. The component reads a `BuildingConfig`, asks
 * `buildFloorLayouts` where each floor sits vertically, asks
 * `buildApartmentUnits` how each floor is cut up horizontally, and renders one
 * mesh per unit — twenty of them for the default 5-floor, 2 x 2 config.
 * Changing `numberOfFloors` to 12, or `unitColumns` to 3, changes the building;
 * this file does not change at all.
 *
 * Phase 4 replaced the Phase 3 full-floor slabs. Those slabs are **gone**, not
 * hidden: the units now fill the same volume, and rendering both would mean an
 * opaque box sitting inside every apartment, z-fighting with it and making the
 * subdivision impossible to see. The visible structure between floors now comes
 * from the gap below, not from a separate slab mesh.
 */

/**
 * A purely cosmetic sliver shaved off every face of each unit box, in metres,
 * so the joints between neighbouring apartments read as dark lines instead of
 * seams that z-fight.
 *
 * It is applied to the *geometry size only*, symmetrically, so the mesh centre
 * stays at the true centre of the unit's bounds. Unit 301 still occupies
 * exactly 6–9 m vertically in the model even though its visible box is a few
 * centimetres smaller. The logical metre-based model is untouched; only the
 * pixels differ.
 */
const UNIT_VISUAL_GAP = 0.06

/**
 * Two near-identical shades of the same slate blue, alternated in a 3D
 * checkerboard so that no unit touches another of the same shade — not
 * side-to-side, not front-to-back, not floor-to-floor.
 *
 * The variation is deliberately restrained. Colour is a channel this project
 * will need later, for selection and for property attributes; spending it now
 * on twenty arbitrary bright colours would leave nothing to say "this one is
 * selected" with.
 */
const UNIT_COLORS = ['#5b7286', '#4d6376'] as const

interface BuildingProps {
  /** Defaults to the prototype's single building. */
  config?: BuildingConfig
}

function Building({ config = DEFAULT_BUILDING_CONFIG }: BuildingProps) {
  const floors = buildFloorLayouts(config)
  const units = buildApartmentUnits(config, floors)

  return (
    <group>
      {units.map((unit) => {
        // A box's origin is its centre, so the centre — not a corner — is what
        // gets positioned. It is computed from the unit's bounds, never stored.
        const [centerX, centerY, centerZ] = getUnitCenter(unit)

        // floorLevel is 1-based, so subtract 1 to get the stack index; adding it
        // to the grid coordinates flips the shade on every axis, including up.
        const shade = (unit.column + unit.row + (unit.floorLevel - 1)) % 2

        return (
          <mesh
            key={unit.id}
            name={unit.id}
            position={[centerX, centerY, centerZ]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                unit.width - UNIT_VISUAL_GAP,
                unit.height - UNIT_VISUAL_GAP,
                unit.depth - UNIT_VISUAL_GAP,
              ]}
            />
            <meshStandardMaterial
              color={UNIT_COLORS[shade]}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export default Building
