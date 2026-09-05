/**
 * Axis-aligned bounding-box intersection in three dimensions — the test that
 * decides whether two people own the same air.
 *
 * WHY AN AABB TEST IS THE RIGHT TEST HERE, AND WHERE IT STOPS BEING ONE
 * Every property volume in this prototype is an axis-aligned box, stored as six
 * bounds precisely so that questions like this are a comparison rather than a
 * reconstruction (see `scene/unitLayout.ts`). For boxes, AABB intersection is
 * not an approximation — it is **exact**. There is no conservatism to allow for
 * and no false positive to explain away.
 *
 * It stops being exact the moment a property is not a box: a sloped roof
 * apartment, a stepped terrace, a curved balcony. Then the AABB is a *bound* and
 * a positive result means "these might overlap, look closer". This project does
 * not generate such shapes, so the test is exact for everything it will ever be
 * handed — and the limitation is written down here so that the day it stops
 * being true, it stops quietly being true in a file someone has read.
 *
 * THE ONE SUBTLETY THAT MATTERS: TOUCHING IS NOT OVERLAPPING
 * Unit 301 occupies x ∈ [−9, 0]. Unit 302 occupies x ∈ [0, 9]. They share the
 * plane x = 0 — a wall — and that is what adjacent apartments do. Every floor in
 * the building shares a slab with the floor above it in exactly the same way.
 *
 * So the overlap on each axis is computed as a **signed extent** and required to
 * be *strictly positive by more than an epsilon*, not merely non-negative:
 *
 *     overlapX = min(A.xMax, B.xMax) − max(A.xMin, B.xMin)
 *     overlapY = min(A.yMax, B.yMax) − max(A.yMin, B.yMin)
 *     overlapZ = min(A.zMax, B.zMax) − max(A.zMin, B.zMin)
 *
 *     conflict ⟺ overlapX > ε  ∧  overlapY > ε  ∧  overlapZ > ε
 *
 * A shared wall gives `overlapX = 0` exactly and is correctly not a conflict.
 * Get that comparison wrong by one character — `>=` instead of `>` — and the
 * validator reports thirty-odd conflicts in a perfectly valid building, which is
 * indistinguishable from a validator that does not work. It is the single most
 * important line in the engine and it is checked directly.
 *
 * **All three axes must overlap.** Two units on different floors of the same
 * stack have identical X and Z extents and `overlapY = 0`; two units on the same
 * floor share a wall in one horizontal axis and have `overlapZ = 0` or
 * `overlapX = 0`. Requiring all three is what makes this a *volume* test rather
 * than three separate interval tests wearing a trench coat.
 *
 * No React, no Three.js.
 */

/** An axis-aligned box in metres. `ApartmentUnit` satisfies this structurally. */
export interface Box3D {
  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
  readonly zMin: number
  readonly zMax: number
}

/**
 * How much two volumes must interpenetrate before it counts, in metres.
 *
 * A hundredth of a millimetre. The bounds in this model are produced by exact
 * division of whole metres, so a shared wall lands on exactly zero and the
 * epsilon is never load-bearing today. It exists for the day the bounds come
 * from a survey file with fifteen decimal places, where two walls intended to
 * coincide will differ in the last bit — and a cadastre that raised an ownership
 * dispute over a nanometre would be worse than useless.
 */
export const OVERLAP_EPSILON_M = 1e-5

/** The extents of an intersection, one per axis. Metres. */
export interface OverlapExtents {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** The per-axis overlap of two boxes. Negative or zero means no overlap on that axis. */
export function getOverlapExtents(a: Box3D, b: Box3D): OverlapExtents {
  return {
    x: Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin),
    y: Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin),
    z: Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin),
  }
}

/** A genuine three-dimensional intersection between two ownership volumes. */
export interface VolumeIntersection {
  /** Per-axis overlap extents, in metres. */
  readonly extents: OverlapExtents
  /** `x × y × z`, in cubic metres. Always positive. */
  readonly volumeCubicM: number
  /**
   * **The disputed region itself**, as a box in the same metric frame as the two
   * inputs — not merely how big it is.
   *
   * PHASE 10 ADDED THIS, AND WHY IT IS COMPUTED HERE RATHER THAN BY THE RENDERER
   * The extents say the overlap is 4 × 7 × 3 m. They do not say *where*, and a
   * scene that wants to draw the contested volume needs where. Before this field
   * existed the only way to put a box on screen was for the renderer to
   * re-derive the bounds from the two units — a second implementation of the
   * intersection, in a file that draws things, free to disagree with the one
   * that decides things. The first time the two disagreed, the interface would
   * be highlighting a volume the engine had not found.
   *
   * So the engine returns the region. The renderer positions a mesh at
   * `bounds` and scales it by `extents`, and the red box on screen is the
   * validator's own output rather than an illustration of it.
   *
   * The formula is the same clamp the extents come from, kept together with
   * them so the two cannot drift:
   *
   *     xMin = max(A.xMin, B.xMin)      xMax = min(A.xMax, B.xMax)
   *
   * and correspondingly on Y and Z. Because the result is only constructed when
   * every extent is strictly positive, `xMax > xMin` on all three axes: it is
   * always a real box, never a degenerate plane or an inverted one.
   */
  readonly bounds: Box3D
}

/**
 * The intersection of two ownership volumes, or `null` if they do not overlap.
 *
 * `null` rather than a zero-volume result, deliberately: "these do not overlap"
 * and "these overlap by nothing" are different statements, and a caller that
 * treated a zeroed record as a conflict would flag every shared wall in the
 * building. The type makes the distinction unavoidable.
 *
 * @param epsilon how much interpenetration counts. Touching faces produce
 *   exactly zero on one axis and are correctly not an intersection.
 */
export function getVolumeIntersection(
  a: Box3D,
  b: Box3D,
  epsilon: number = OVERLAP_EPSILON_M,
): VolumeIntersection | null {
  const extents = getOverlapExtents(a, b)

  // All three, strictly. See the note at the top of this file.
  if (extents.x <= epsilon || extents.y <= epsilon || extents.z <= epsilon) {
    return null
  }

  return {
    extents,
    volumeCubicM: extents.x * extents.y * extents.z,
    bounds: {
      xMin: Math.max(a.xMin, b.xMin),
      xMax: Math.min(a.xMax, b.xMax),
      yMin: Math.max(a.yMin, b.yMin),
      yMax: Math.min(a.yMax, b.yMax),
      zMin: Math.max(a.zMin, b.zMin),
      zMax: Math.min(a.zMax, b.zMax),
    },
  }
}

/**
 * Just the disputed region, or `null` if there is not one.
 *
 * A convenience over `getVolumeIntersection` for the one caller — the conflict
 * presentation layer — that wants the box and nothing else. It delegates rather
 * than recomputing, so there remains exactly one implementation of what an
 * intersection is.
 */
export function getIntersectionBox(
  a: Box3D,
  b: Box3D,
  epsilon: number = OVERLAP_EPSILON_M,
): Box3D | null {
  return getVolumeIntersection(a, b, epsilon)?.bounds ?? null
}

/** The centre of a box, `[x, y, z]` in metres. */
export function getBoxCentre(box: Box3D): [number, number, number] {
  return [
    (box.xMin + box.xMax) / 2,
    (box.yMin + box.yMax) / 2,
    (box.zMin + box.zMax) / 2,
  ]
}

/** The size of a box, `[width, height, depth]` in metres. */
export function getBoxSize(box: Box3D): [number, number, number] {
  return [box.xMax - box.xMin, box.yMax - box.yMin, box.zMax - box.zMin]
}

/** The smallest box containing every box given. `null` for an empty list. */
export function getBoxUnion(boxes: readonly Box3D[]): Box3D | null {
  if (boxes.length === 0) return null

  let xMin = Number.POSITIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let zMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  let zMax = Number.NEGATIVE_INFINITY

  for (const box of boxes) {
    if (box.xMin < xMin) xMin = box.xMin
    if (box.yMin < yMin) yMin = box.yMin
    if (box.zMin < zMin) zMin = box.zMin
    if (box.xMax > xMax) xMax = box.xMax
    if (box.yMax > yMax) yMax = box.yMax
    if (box.zMax > zMax) zMax = box.zMax
  }

  return { xMin, xMax, yMin, yMax, zMin, zMax }
}

/** Whether two volumes intersect at all. The predicate form of the above. */
export function volumesIntersect(
  a: Box3D,
  b: Box3D,
  epsilon: number = OVERLAP_EPSILON_M,
): boolean {
  return getVolumeIntersection(a, b, epsilon) !== null
}

/**
 * Whether `inner`'s vertical extent lies within `[floorM, ceilingM]`.
 *
 * Split out from the horizontal containment test because the two have different
 * sources: a unit's horizontal extent is checked against a *surveyed polygon*,
 * its vertical extent against a *sanctioned height*. Two kinds of fact, two
 * tests — the same separation `buildingConfig.ts` and `geometry/footprint.ts`
 * make in the model.
 */
export function isWithinVerticalRange(
  inner: Box3D,
  floorM: number,
  ceilingM: number,
  epsilon: number = OVERLAP_EPSILON_M,
): boolean {
  return inner.yMin >= floorM - epsilon && inner.yMax <= ceilingM + epsilon
}
