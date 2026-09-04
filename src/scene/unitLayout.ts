/**
 * The apartment-unit model: how a floor becomes four independent 3D properties.
 *
 * UNIT CONVENTION: **1 Three.js unit = 1 metre**, same as everywhere else.
 * Every length here is metres, every area square metres, every volume cubic
 * metres. Nothing in this file introduces a second scale.
 *
 * Like `buildingConfig.ts`, this module contains no React and no Three.js. It
 * is a description of *property*, not of *pixels* — the numbers a cadastre
 * would record. The renderer consumes it; later phases (the ULPIN encoder, the
 * detail panel, a GIS export) will consume the same objects without dragging a
 * WebGL context along with them.
 */

import {
  buildFloorLayouts,
  type BuildingConfig,
  type FloorLayout,
} from './buildingConfig'

/**
 * One vertical property unit — an apartment — as an axis-aligned box in metres.
 *
 * The box is stored as **six bounds**, not as a centre plus a size. Bounds are
 * what a register records ("this property occupies 0–9 m east, 6–9 m up,
 * −7–0 m north of the origin"), they compose (two units are adjacent when one's
 * max equals the other's min), and they make containment and overlap tests a
 * comparison rather than a reconstruction. The size fields below are convenience
 * derivations of those bounds, computed once so no consumer has to subtract.
 *
 * Axes follow Three.js: **X = width, Y = up, Z = depth.**
 */
export interface ApartmentUnit {
  /** Stable unique key for this unit within the building, e.g. `unit-301`. */
  readonly id: string
  /** 1-based floor the unit sits on. Ground floor is 1. */
  readonly floorLevel: number
  /** 1-based position of the unit within its own floor: 1..unitsPerFloor. */
  readonly indexOnFloor: number
  /** Human-facing door number: floor 3, unit 1 reads `301`. */
  readonly unitNumber: string

  /** 0-based grid column along X. Kept so neighbours are cheap to reason about. */
  readonly column: number
  /** 0-based grid row along Z. */
  readonly row: number

  /** West edge, metres along X. */
  readonly xMin: number
  /** East edge, metres along X. */
  readonly xMax: number
  /** Underside, metres above ground. Equals the floor's `baseY`. */
  readonly yMin: number
  /** Ceiling, metres above ground. Equals the floor's `topY`. */
  readonly yMax: number
  /** North edge, metres along Z. */
  readonly zMin: number
  /** South edge, metres along Z. */
  readonly zMax: number

  /** `xMax - xMin`, metres. */
  readonly width: number
  /** `zMax - zMin`, metres. */
  readonly depth: number
  /** `yMax - yMin`, metres. */
  readonly height: number

  /** Carpet area, `width * depth`, in square metres. */
  readonly areaSqM: number
  /** Enclosed volume, `areaSqM * height`, in cubic metres. */
  readonly volumeCubicM: number
}

/**
 * Format a door number from a floor level and a position on that floor.
 *
 *   floor 1, unit 1 -> "101"      floor 5, unit 4 -> "504"
 *
 * The position is zero-padded to two digits so the numbers sort correctly and
 * stay unambiguous if a floor ever holds more than nine units.
 */
function formatUnitNumber(floorLevel: number, indexOnFloor: number): string {
  return `${floorLevel}${String(indexOnFloor).padStart(2, '0')}`
}

/**
 * Cut one floor into a grid of units and return them.
 *
 * The partition is a plain 2D grid over the floor's footprint. The building is
 * centred on the origin, so the footprint runs from `-width / 2` to `+width / 2`
 * along X and from `-depth / 2` to `+depth / 2` along Z, and a cell's bounds are
 * just offsets into that:
 *
 *   unitWidth = width  / unitColumns          (18 / 2 = 9 m)
 *   unitDepth = depth  / unitRows             (14 / 2 = 7 m)
 *
 *   xMin = -width / 2 + column * unitWidth    xMax = xMin + unitWidth
 *   zMin = -depth / 2 + row    * unitDepth    zMax = zMin + unitDepth
 *
 * The vertical bounds are not computed here at all — they are taken verbatim
 * from the floor the unit sits on, so a unit can never disagree with its floor
 * about which slice of the building it occupies.
 *
 * Units are walked row-major (Z outer, X inner), which numbers them left-to-
 * right then front-to-back: 1 2 / 3 4.
 */
function buildUnitsForFloor(
  config: BuildingConfig,
  floor: FloorLayout,
): ApartmentUnit[] {
  const unitWidth = config.width / config.unitColumns
  const unitDepth = config.depth / config.unitRows
  const unitHeight = floor.topY - floor.baseY

  const units: ApartmentUnit[] = []

  for (let row = 0; row < config.unitRows; row++) {
    for (let column = 0; column < config.unitColumns; column++) {
      const indexOnFloor = row * config.unitColumns + column + 1

      const xMin = -config.width / 2 + column * unitWidth
      const zMin = -config.depth / 2 + row * unitDepth

      const areaSqM = unitWidth * unitDepth

      units.push({
        id: `unit-${formatUnitNumber(floor.level, indexOnFloor)}`,
        floorLevel: floor.level,
        indexOnFloor,
        unitNumber: formatUnitNumber(floor.level, indexOnFloor),

        column,
        row,

        xMin,
        xMax: xMin + unitWidth,
        // Inherited, not recomputed: the unit spans exactly its floor.
        yMin: floor.baseY,
        yMax: floor.topY,
        zMin,
        zMax: zMin + unitDepth,

        width: unitWidth,
        depth: unitDepth,
        height: unitHeight,

        areaSqM,
        volumeCubicM: areaSqM * unitHeight,
      })
    }
  }

  return units
}

/**
 * Generate every unit in the building, floor by floor.
 *
 *   BuildingConfig ──► FloorLayout[] ──► ApartmentUnit[]
 *    (6 numbers)        vertical slices    the 20 properties
 *
 * Nothing is hand-authored. Twenty units exist because the config says five
 * floors of a 2 x 2 grid; changing `numberOfFloors` to 12 or `unitColumns` to 3
 * changes the building with no edit to this function or to any renderer.
 *
 * `floors` is a parameter rather than an internal detail so that a caller which
 * already has the layouts (the summary panel, a future ULPIN encoder) can pass
 * them in instead of recomputing them.
 */
export function buildApartmentUnits(
  config: BuildingConfig,
  floors: FloorLayout[] = buildFloorLayouts(config),
): ApartmentUnit[] {
  return floors.flatMap((floor) => buildUnitsForFloor(config, floor))
}

/**
 * The centre of a unit's box, in metres — a *rendering* value, derived on demand.
 *
 *   centerX = (xMin + xMax) / 2
 *   centerY = (yMin + yMax) / 2
 *   centerZ = (zMin + zMax) / 2
 *
 * It exists only because Three.js anchors a `BoxGeometry` at its centre rather
 * than at a corner. It is deliberately **not** a field on `ApartmentUnit`:
 * storing it would put the same fact in two places and invite the pair to drift.
 * The bounds are the truth; the centre is a function of them.
 */
export function getUnitCenter(unit: ApartmentUnit): [number, number, number] {
  return [
    (unit.xMin + unit.xMax) / 2,
    (unit.yMin + unit.yMax) / 2,
    (unit.zMin + unit.zMax) / 2,
  ]
}
