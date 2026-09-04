/**
 * The building's dimensions, and everything derived from them.
 *
 * UNIT CONVENTION FOR THE WHOLE PROJECT: **1 Three.js unit = 1 metre.**
 * Every number in this file is metres. Nothing anywhere in the scene should
 * introduce a second scale — if a value is not in metres, it is a bug.
 *
 * This module is deliberately free of React and of Three.js. It is plain data
 * plus plain arithmetic, so the numbers can be read, reasoned about and later
 * reused by non-3D code (the ULPIN encoder, the detail panel, the map) without
 * dragging the renderer along with them.
 */

/** The description of a building, in metres. The single source of truth. */
export interface BuildingConfig {
  /** Footprint along the X axis, in metres. */
  readonly width: number
  /** Footprint along the Z axis, in metres. */
  readonly depth: number
  /** How many floors are stacked, counting from the ground floor up. */
  readonly numberOfFloors: number
  /** Floor-to-floor height, in metres. Uniform for every floor. */
  readonly floorHeight: number
}

/** The one building the Phase 3 prototype shows. */
export const DEFAULT_BUILDING_CONFIG: BuildingConfig = {
  width: 18,
  depth: 14,
  numberOfFloors: 5,
  floorHeight: 3,
}

/**
 * Where one floor sits on the vertical axis, in metres.
 *
 * `baseY` / `topY` are the *logical* elevations — the floor's real extent in the
 * world, and the numbers a cadastre would care about. `centerY` exists only
 * because Three.js positions a box by its centre, not by its base.
 */
export interface FloorLayout {
  /** 0-based position in the stack. Used for the maths. */
  readonly index: number
  /** 1-based number shown to a human. Ground floor is 1. */
  readonly level: number
  /** Elevation of the floor's underside, in metres above ground. */
  readonly baseY: number
  /** Elevation of the floor's top surface, in metres above ground. */
  readonly topY: number
  /** Midpoint between base and top — where the mesh's origin must go. */
  readonly centerY: number
}

/**
 * Turn a configuration into one layout entry per floor.
 *
 * The two lines that matter, and the only place they are written:
 *
 *   floorBaseY   = floorIndex * floorHeight
 *   floorCenterY = floorBaseY + floorHeight / 2
 *
 * With floorHeight = 3 m that produces 0–3, 3–6, 6–9, 9–12, 12–15 — each floor
 * starting exactly where the one below it ends, with no gaps and no overlap.
 */
export function buildFloorLayouts(config: BuildingConfig): FloorLayout[] {
  const layouts: FloorLayout[] = []

  for (let floorIndex = 0; floorIndex < config.numberOfFloors; floorIndex++) {
    const floorBaseY = floorIndex * config.floorHeight
    const floorCenterY = floorBaseY + config.floorHeight / 2

    layouts.push({
      index: floorIndex,
      level: floorIndex + 1,
      baseY: floorBaseY,
      topY: floorBaseY + config.floorHeight,
      centerY: floorCenterY,
    })
  }

  return layouts
}

/**
 * Total height of the building, in metres.
 *
 * Derived, never stored: it is the top of the highest floor, which for a uniform
 * stack is simply `numberOfFloors * floorHeight`. Storing it separately would
 * let it drift out of step with the floors it is supposed to describe.
 */
export function getTotalHeight(config: BuildingConfig): number {
  return config.numberOfFloors * config.floorHeight
}
