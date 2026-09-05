/**
 * The building footprint: the authoritative horizontal geometry of the project.
 *
 * WHAT CHANGED IN PHASE 8, AND WHY IT MATTERS
 * Up to Phase 7 the building had **two** horizontal descriptions. The 3D scene
 * was generated from `BuildingConfig.width` / `.depth` — two scalars — and the
 * 2D map drew a rectangle computed from those same two scalars. They agreed,
 * but only because one was derived from the other, and only for as long as the
 * building stayed a rectangle. The moment a real footprint arrives — an L, a
 * chamfered corner, anything a surveyor would actually draw — "width and depth"
 * stops being able to describe it, and the two views would have to be given
 * separate geometry that a human keeps in step by hand.
 *
 * So Phase 8 inverts the dependency. The **polygon** is the source of truth:
 *
 *     demoParcel.buildingFootprintMetric   (a ring of points, in metres)
 *              │
 *              ├──► 3D building geometry ──► floors ──► property units
 *              └──► 2D map polygon
 *
 * `width` and `depth` are no longer stored anywhere. They are *derived* from the
 * polygon's bounding box, by `getFootprintWidth` / `getFootprintDepth` below,
 * and every consumer that wants them calls the same function. There is exactly
 * one horizontal description of this building in the codebase.
 *
 * AXIS CONVENTION — READ THIS BEFORE TOUCHING ANY COORDINATE
 * Two coordinate systems meet in this module, and the mapping between them is
 * fixed here, once, deliberately:
 *
 *     GIS local metric            Three.js world
 *     ────────────────            ──────────────
 *     eastM   (+ = east)   ──►    X   (+ = east)
 *     northM  (+ = north)  ──►    Z   (+ = north)
 *                                 Y   (+ = up, elevation)
 *
 * That is: **East = +X, North = +Z, Up = +Y.** `footprintFromEastNorth()` is the
 * only place the conversion happens, so there is no second, silently different
 * flip anywhere in the project.
 *
 * An honest note about the choice. Three.js's default camera looks down −Z, so
 * +Z points *towards the viewer* — on a north-up map that reads as "downwards",
 * and a strict cartographic mapping would therefore be `northM → −Z`. The
 * demo footprint is a rectangle centred on the origin, so the two conventions
 * produce a **byte-identical ring** and nothing on screen can distinguish them.
 * The project adopts `northM → +Z` because it is the convention a reader can
 * hold in their head (east is positive, north is positive, up is positive) and
 * because it keeps this file free of a sign that would look like a mistake.
 * The day the footprint stops being symmetric this choice becomes observable,
 * and the fix is a single line here — not a hunt through the renderers.
 *
 * This module holds **no React and no Three.js**. It is geometry: types plus
 * pure functions over plain numbers. It runs in bare Node, which is what makes
 * the Phase 8 arithmetic checkable without a browser.
 *
 * UNIT CONVENTION: metres, everywhere, as in the rest of the project.
 * **1 Three.js unit = 1 metre.**
 */

/**
 * One point on the building's horizontal plane, in metres, in **Three.js axes**.
 *
 * `x` and `z` are named for the axes they will occupy in the scene, not for the
 * compass. The compass form (`eastM` / `northM`) is what a human authors; this
 * is what geometry consumes. `footprintFromEastNorth` converts between them.
 */
export interface MetricPoint2D {
  /** Metres along Three.js X. Positive is east. */
  readonly x: number
  /** Metres along Three.js Z. Positive is north. */
  readonly z: number
}

/**
 * A building footprint: a closed ring of points, in metres.
 *
 * **A polygon, not a width and a depth.** That distinction is the whole point of
 * the type. A rectangle is a four-point ring like any other, so the code that
 * consumes a footprint does not know or care that this prototype's demo happens
 * to be rectangular — and irregular footprints become a data change rather than
 * a rewrite.
 *
 * The ring is **implicitly closed**: the last point joins back to the first, and
 * no footprint in this project repeats its opening vertex. Winding order is not
 * significant to anything here — every function below is either order-free or
 * takes the magnitude — so a ring authored clockwise and one authored
 * anticlockwise describe the same building.
 */
export type BuildingFootprint = readonly MetricPoint2D[]

/**
 * The axis-aligned bounding box of a footprint, in metres.
 *
 * The smallest rectangle containing the polygon. It is *not* the footprint: for
 * an L-shaped plan the box covers ground the building does not occupy. It is
 * used for the things that legitimately want an extent — camera framing, shadow
 * coverage, and (for now) the prototype's rectangular unit subdivision.
 */
export interface FootprintBounds {
  /** Westmost X, metres. */
  readonly xMin: number
  /** Eastmost X, metres. */
  readonly xMax: number
  /** Southmost Z, metres. */
  readonly zMin: number
  /** Northmost Z, metres. */
  readonly zMax: number
}

/**
 * Everything derived from one footprint, computed once.
 *
 * Bundled into a single object so a component can be handed *the* metrics
 * rather than calling four functions and risking a fifth place that computes
 * area slightly differently. `App` builds this once and passes it down; nothing
 * downstream recomputes it.
 */
export interface FootprintMetrics {
  /** The axis-aligned extent. */
  readonly bounds: FootprintBounds
  /** `xMax - xMin`, metres — the east-west extent. */
  readonly widthM: number
  /** `zMax - zMin`, metres — the north-south extent. */
  readonly depthM: number
  /** True polygon area, square metres. For a non-rectangle this is *less* than `widthM * depthM`. */
  readonly areaSqM: number
  /** Area-weighted centroid of the polygon, metres. */
  readonly centroid: MetricPoint2D
  /** Number of vertices in the ring. */
  readonly vertexCount: number
  /** Whether the ring is (within tolerance) an axis-aligned rectangle. */
  readonly isAxisAlignedRectangle: boolean
}

/** A footprint must be a polygon; three points is the minimum that encloses area. */
const MINIMUM_VERTICES = 3

/**
 * Default slack, in metres, for "is this ring an axis-aligned rectangle?".
 *
 * A millimetre. Generous enough to survive floating-point arithmetic and a
 * surveyor's rounding, far too tight to let a genuinely skewed plan through.
 */
const RECTANGLE_TOLERANCE_M = 0.001

/**
 * Convert a survey-style ring (`eastM` / `northM`) into a footprint (`x` / `z`).
 *
 * **The single crossing point between the two coordinate systems.** See the
 * axis convention at the top of this file: east becomes X, north becomes Z.
 *
 * The parameter is typed structurally rather than as `LocalPointM` from
 * `data/demoParcel`, on purpose: that module imports *this* one, and a named
 * import back would make the pair circular. Structural typing means any object
 * with the two fields is accepted, which is exactly the contract that matters.
 */
export function footprintFromEastNorth(
  ring: readonly { readonly eastM: number; readonly northM: number }[],
): BuildingFootprint {
  return ring.map((point) => ({ x: point.eastM, z: point.northM }))
}

/**
 * Convert a footprint back to survey axes.
 *
 * The exact inverse of `footprintFromEastNorth`, provided so that code holding
 * a footprint can hand it to the map layer — which speaks `eastM` / `northM` —
 * without open-coding the flip and getting it backwards.
 */
export function eastNorthFromFootprint(
  footprint: BuildingFootprint,
): { eastM: number; northM: number }[] {
  return footprint.map((point) => ({ eastM: point.x, northM: point.z }))
}

/**
 * Reject a ring that cannot describe a building.
 *
 * Thrown rather than returned: a footprint with two points is not a degraded
 * building, it is a wiring mistake upstream, and the useful moment to find out
 * is the first time the geometry is asked for — not three frames later when a
 * renderer produces an empty mesh and no error.
 */
function assertUsableFootprint(footprint: BuildingFootprint): void {
  if (footprint.length < MINIMUM_VERTICES) {
    throw new Error(
      `[3D ULPIN] a building footprint needs at least ${MINIMUM_VERTICES} vertices; got ${footprint.length}.`,
    )
  }
}

/**
 * The axis-aligned bounding box of a footprint.
 *
 * A single pass, no sorting, no allocation per vertex.
 */
export function getFootprintBounds(footprint: BuildingFootprint): FootprintBounds {
  assertUsableFootprint(footprint)

  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let zMin = Number.POSITIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY

  for (const point of footprint) {
    if (point.x < xMin) xMin = point.x
    if (point.x > xMax) xMax = point.x
    if (point.z < zMin) zMin = point.z
    if (point.z > zMax) zMax = point.z
  }

  return { xMin, xMax, zMin, zMax }
}

/**
 * East-west extent of the footprint, in metres.
 *
 * This is what used to be `BuildingConfig.width`. It is now a *measurement of
 * the polygon* rather than an input to it — for the demo footprint it comes out
 * at exactly 18 m, but nobody typed 18 anywhere in the geometry path.
 */
export function getFootprintWidth(footprint: BuildingFootprint): number {
  const bounds = getFootprintBounds(footprint)
  return bounds.xMax - bounds.xMin
}

/**
 * North-south extent of the footprint, in metres.
 *
 * The former `BuildingConfig.depth`, on the same terms as `getFootprintWidth`:
 * 14 m for the demo, derived rather than declared.
 */
export function getFootprintDepth(footprint: BuildingFootprint): number {
  const bounds = getFootprintBounds(footprint)
  return bounds.zMax - bounds.zMin
}

/**
 * The true area enclosed by the ring, in square metres.
 *
 * The shoelace formula over metres: sum the cross products of consecutive
 * vertices, halve, take the magnitude. `Math.abs` makes it indifferent to
 * winding order.
 *
 * Note that this is the **polygon's** area, not `width * depth`. For the demo
 * rectangle the two agree at 252 m²; for any non-rectangular plan they do not,
 * and this function is the one that stays right.
 */
export function getFootprintAreaSqM(footprint: BuildingFootprint): number {
  if (footprint.length < MINIMUM_VERTICES) {
    return 0
  }

  let doubleArea = 0

  for (let index = 0; index < footprint.length; index++) {
    const current = footprint[index]
    const next = footprint[(index + 1) % footprint.length]

    doubleArea += current.x * next.z - next.x * current.z
  }

  return Math.abs(doubleArea) / 2
}

/**
 * The area-weighted centroid of the footprint, in metres.
 *
 * The polygon centroid — the balance point of the enclosed *area* — not the
 * mean of the vertices, which would be pulled towards whichever edge happens to
 * have been surveyed in more detail. For the demo footprint it lands on
 * `(0, 0)`, which is the parcel reference point: that coincidence is what lets
 * the 3D scene's origin and the map's origin be the same physical spot.
 *
 * A degenerate ring (all points collinear, so zero area) has no meaningful
 * area-weighted centroid; the bounding-box centre is returned instead, which is
 * the sane answer and avoids a division by zero.
 */
export function getFootprintCentroid(footprint: BuildingFootprint): MetricPoint2D {
  assertUsableFootprint(footprint)

  let signedDoubleArea = 0
  let centroidXAccumulator = 0
  let centroidZAccumulator = 0

  for (let index = 0; index < footprint.length; index++) {
    const current = footprint[index]
    const next = footprint[(index + 1) % footprint.length]

    // The *signed* cross product here, not the magnitude: the signs cancel
    // against the signed area below, so winding order does not shift the point.
    const cross = current.x * next.z - next.x * current.z

    signedDoubleArea += cross
    centroidXAccumulator += (current.x + next.x) * cross
    centroidZAccumulator += (current.z + next.z) * cross
  }

  if (signedDoubleArea === 0) {
    const bounds = getFootprintBounds(footprint)
    return {
      x: (bounds.xMin + bounds.xMax) / 2,
      z: (bounds.zMin + bounds.zMax) / 2,
    }
  }

  const sixTimesArea = 3 * signedDoubleArea

  return {
    x: centroidXAccumulator / sixTimesArea,
    z: centroidZAccumulator / sixTimesArea,
  }
}

/**
 * Is this ring an axis-aligned rectangle, within tolerance?
 *
 * Not a topology validator — that is Phase 9's job, and this is deliberately
 * not the beginning of one. It answers exactly one question, and it exists for
 * exactly one reason: the prototype's 2 × 2 unit subdivision assumes a
 * rectangular plan, and an assumption that is *checked* is an honest limitation
 * rather than a silent one. The check is used to warn in development and to say
 * so plainly in the interface — never to reject geometry.
 *
 * The test is simple because the question is: four vertices, and each one shares
 * its X with exactly one neighbour and its Z with the other.
 */
export function isAxisAlignedRectangle(
  footprint: BuildingFootprint,
  toleranceM: number = RECTANGLE_TOLERANCE_M,
): boolean {
  if (footprint.length !== 4) {
    return false
  }

  const bounds = getFootprintBounds(footprint)
  const onEdge = (value: number, low: number, high: number): boolean =>
    Math.abs(value - low) <= toleranceM || Math.abs(value - high) <= toleranceM

  // Every corner must sit on both a vertical and a horizontal edge of the box.
  const everyCornerOnTheBox = footprint.every(
    (point) =>
      onEdge(point.x, bounds.xMin, bounds.xMax) &&
      onEdge(point.z, bounds.zMin, bounds.zMax),
  )

  if (!everyCornerOnTheBox) {
    return false
  }

  // …and the four corners must be four *different* corners, not (say) three
  // stacked on one. A true rectangle fills its own bounding box exactly.
  const boxArea = (bounds.xMax - bounds.xMin) * (bounds.zMax - bounds.zMin)

  return Math.abs(getFootprintAreaSqM(footprint) - boxArea) <= toleranceM
}

/**
 * Measure a footprint once and hand back everything derived from it.
 *
 * The function the application actually calls. `App` builds one
 * `FootprintMetrics` per footprint and passes it to whoever needs a number, so
 * the summary panel, the parcel panel and the pipeline read *the same measured
 * values* rather than four independent measurements that happen to agree.
 */
export function getFootprintMetrics(footprint: BuildingFootprint): FootprintMetrics {
  const bounds = getFootprintBounds(footprint)

  return {
    bounds,
    widthM: bounds.xMax - bounds.xMin,
    depthM: bounds.zMax - bounds.zMin,
    areaSqM: getFootprintAreaSqM(footprint),
    centroid: getFootprintCentroid(footprint),
    vertexCount: footprint.length,
    isAxisAlignedRectangle: isAxisAlignedRectangle(footprint),
  }
}
