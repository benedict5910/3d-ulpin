/**
 * Plane geometry for containment tests — the arithmetic the topology engine
 * needs and nothing else.
 *
 * WHY THIS EXISTS SEPARATELY FROM `geometry/footprint.ts`
 * That module *measures* one polygon: its bounds, its area, its centroid. This
 * one answers questions about the **relationship between two polygons**, which
 * is a different subject with different failure modes. Keeping them apart means
 * the measuring code stays as simple as it was, and the predicates below can be
 * reasoned about — and checked — as predicates.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * No general polygon clipping, no boolean operations, no arbitrary polygon
 * decomposition. Those are the tools a full cadastral engine needs and they are
 * an order of magnitude more code, most of it degenerate-case handling. What the
 * prototype needs is *"is this ring inside that ring"* and *"do these two edges
 * cross"*, for simple rings without holes. Those are small, exact, and
 * checkable. Anything larger would be a library this project should import
 * rather than write.
 *
 * THE BOUNDARY PROBLEM, AND HOW IT IS SOLVED
 * Ray casting is the standard point-in-polygon test and it is unreliable for a
 * point that lies exactly *on* an edge: whether the ray is judged to cross
 * depends on floating-point luck at the vertex, so the same corner can come out
 * inside or outside on different runs or different builds.
 *
 * That is not an edge case here — it is the normal case. Every one of the twenty
 * property units has plan corners sitting exactly on the building footprint's
 * boundary, because the units are cut from that footprint. A naive ray cast
 * would report a valid building as invalid roughly half the time.
 *
 * So containment is answered in two steps: **first ask whether the point is on
 * the boundary within a tolerance, and only then ray-cast.** Cadastral geometry
 * is measured to centimetres and a shared wall is a shared wall; a point a
 * micrometre outside a line it is meant to lie on is a rounding artefact, not a
 * trespass.
 *
 * No React, no Three.js. Pure functions on plain numbers.
 */

/** A point on the ground plane, in metres. Three.js axes: X east, Z north. */
export interface Point2D {
  readonly x: number
  readonly z: number
}

/** A closed ring, implicitly closed — the last vertex joins the first. */
export type Ring2D = readonly Point2D[]

/**
 * How close to a boundary still counts as *on* it, in metres.
 *
 * A tenth of a millimetre. Far below any surveyed tolerance, far above the
 * rounding error of double-precision arithmetic on coordinates of this size —
 * which is the band a boundary tolerance has to sit in to be useful rather than
 * arbitrary.
 */
export const BOUNDARY_TOLERANCE_M = 1e-4

/** The shortest distance from a point to a line segment, in metres. */
export function distanceToSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz

  // A degenerate segment is a point; the distance is to that point.
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.z - start.z)
  }

  // Project the point onto the infinite line, then clamp to the segment.
  let t = ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
  if (t < 0) t = 0
  else if (t > 1) t = 1

  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz))
}

/** Whether a point lies on a ring's boundary, within `tolerance` metres. */
export function isPointOnRing(
  point: Point2D,
  ring: Ring2D,
  tolerance: number = BOUNDARY_TOLERANCE_M,
): boolean {
  for (let index = 0; index < ring.length; index++) {
    const start = ring[index]
    const end = ring[(index + 1) % ring.length]
    if (distanceToSegment(point, start, end) <= tolerance) return true
  }
  return false
}

/**
 * Whether a point is strictly inside a ring, by ray casting.
 *
 * A horizontal ray is cast to +X and the crossings are counted; an odd count
 * means inside. The half-open comparison `(zi > z) !== (zj > z)` is what stops a
 * vertex being counted twice when the ray passes exactly through it — the
 * classic Jordan-curve implementation.
 *
 * **Undefined for a point on the boundary**, which is why callers should use
 * `isPointInsideOrOnRing` instead. This function is exported for the one case
 * that genuinely wants strictness.
 */
export function isPointStrictlyInsideRing(point: Point2D, ring: Ring2D): boolean {
  if (ring.length < 3) return false

  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const zi = ring[i].z
    const zj = ring[j].z
    const xi = ring[i].x
    const xj = ring[j].x

    const straddles = zi > point.z !== zj > point.z
    if (!straddles) continue

    // Where the edge crosses the ray's horizontal line.
    const crossingX = xi + ((point.z - zi) / (zj - zi)) * (xj - xi)
    if (point.x < crossingX) inside = !inside
  }

  return inside
}

/**
 * Whether a point is inside a ring **or on its boundary**.
 *
 * The predicate cadastral containment actually wants — see the boundary note at
 * the top of this file. A building's wall standing exactly on the parcel line is
 * inside the parcel; a unit's corner on the footprint edge is inside the
 * footprint. Anything else would declare the prototype's own valid geometry
 * invalid.
 */
export function isPointInsideOrOnRing(
  point: Point2D,
  ring: Ring2D,
  tolerance: number = BOUNDARY_TOLERANCE_M,
): boolean {
  if (isPointOnRing(point, ring, tolerance)) return true
  return isPointStrictlyInsideRing(point, ring)
}

/**
 * Whether two line segments properly cross.
 *
 * "Properly" means they intersect at a point interior to both — segments that
 * merely touch at an endpoint, or lie along each other, are **not** a crossing.
 * That distinction is the whole point of the function in this context: a
 * building sharing a boundary with its parcel is legal and normal, while a
 * building whose wall cuts *through* the parcel line is not.
 *
 * Uses the sign of the cross product on each side. Collinear cases return
 * `false` — a segment lying along another does not cross it, and treating
 * overlap as a crossing would flag every building built to its boundary.
 */
export function segmentsProperlyCross(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D): number =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)

  const d1 = cross(a1, a2, b1)
  const d2 = cross(a1, a2, b2)
  const d3 = cross(b1, b2, a1)
  const d4 = cross(b1, b2, a2)

  // Strict opposite signs on both segments: the crossing point is interior to
  // each. Any zero means touching or collinear, which is not a proper crossing.
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}

/** Whether any edge of `inner` properly crosses any edge of `outer`. */
export function ringsProperlyCross(inner: Ring2D, outer: Ring2D): boolean {
  for (let i = 0; i < inner.length; i++) {
    const a1 = inner[i]
    const a2 = inner[(i + 1) % inner.length]

    for (let j = 0; j < outer.length; j++) {
      const b1 = outer[j]
      const b2 = outer[(j + 1) % outer.length]

      if (segmentsProperlyCross(a1, a2, b1, b2)) return true
    }
  }
  return false
}

/** The outcome of a containment test, with the evidence for it. */
export interface ContainmentResult {
  /** Whether `inner` is entirely within `outer`. */
  readonly contained: boolean
  /** Indices of `inner`'s vertices that fall outside `outer`. */
  readonly outsideVertexIndices: readonly number[]
  /** Whether any edge of `inner` cuts through an edge of `outer`. */
  readonly edgesCross: boolean
}

/**
 * Whether one simple ring lies entirely inside another.
 *
 * **Two tests, and both are needed.** Vertices alone are not sufficient: a
 * bow-tie or a long thin ring can have every corner inside a concave polygon
 * while an edge bulges out through a notch in it. Edge crossings alone are not
 * sufficient either: a ring entirely *outside* a polygon crosses none of its
 * edges. Together they settle it for simple rings without holes:
 *
 *   1. every vertex of `inner` is inside `outer` or on its boundary, **and**
 *   2. no edge of `inner` properly crosses an edge of `outer`.
 *
 * The result carries *which* vertices failed, not just whether any did, because
 * a validator that can only say "invalid" is barely more useful than one that
 * says nothing — the report needs to name the corner.
 *
 * **Limitation, stated rather than hidden:** this assumes both rings are simple
 * (non-self-intersecting) and neither has holes. The demo parcel and footprint
 * are both simple quadrilaterals. A cadastre with courtyards or multi-part
 * parcels needs a real geometry library, not an extension of this.
 */
export function isRingInsideRing(
  inner: Ring2D,
  outer: Ring2D,
  tolerance: number = BOUNDARY_TOLERANCE_M,
): ContainmentResult {
  const outsideVertexIndices: number[] = []

  for (let index = 0; index < inner.length; index++) {
    if (!isPointInsideOrOnRing(inner[index], outer, tolerance)) {
      outsideVertexIndices.push(index)
    }
  }

  const edgesCross = ringsProperlyCross(inner, outer)

  return {
    contained: outsideVertexIndices.length === 0 && !edgesCross,
    outsideVertexIndices,
    edgesCross,
  }
}

/**
 * The signed area of a ring, in square metres.
 *
 * Positive is counter-clockwise in this axis convention (X east, Z north).
 * `geometry/footprint.ts` takes the magnitude of this, which makes it
 * indifferent to winding order — correct for measuring an area, and exactly what
 * makes a reversed ring invisible there. The sign is kept here because winding
 * order is a *topological* property and this is the module that checks
 * topological properties.
 */
export function signedRingAreaSqM(ring: Ring2D): number {
  if (ring.length < 3) return 0

  let doubleArea = 0
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index]
    const next = ring[(index + 1) % ring.length]
    doubleArea += current.x * next.z - next.x * current.z
  }
  return doubleArea / 2
}

/** Whether a ring is wound counter-clockwise. */
export function isCounterClockwise(ring: Ring2D): boolean {
  return signedRingAreaSqM(ring) > 0
}

/**
 * Whether a ring is simple — no non-adjacent edges crossing.
 *
 * Adjacent edges share an endpoint by construction and are skipped; so is the
 * pair formed by the first and last edges, which also share one. What remains is
 * the pairs that have no business touching at all.
 *
 * O(n²), which for a four-vertex cadastral ring is six comparisons. A sweep-line
 * algorithm would be asymptotically better and enormously more code, and the
 * rings this project validates have single-digit vertex counts.
 */
export function isSimpleRing(ring: Ring2D): boolean {
  const count = ring.length
  if (count < 4) return true

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      // Skip adjacent edges, including the wrap-around pair.
      const adjacent = j === i + 1 || (i === 0 && j === count - 1)
      if (adjacent) continue

      if (
        segmentsProperlyCross(
          ring[i],
          ring[(i + 1) % count],
          ring[j],
          ring[(j + 1) % count],
        )
      ) {
        return false
      }
    }
  }

  return true
}
