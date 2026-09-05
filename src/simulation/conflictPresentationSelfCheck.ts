/**
 * A pure self-check for the conflict **presentation**.
 *
 * WHAT THIS IS GUARDING, AND WHY IT IS A SEPARATE FILE
 * `conflictSelfCheck.ts` proves the simulation is honest: the record is never
 * written to, the engine discovers the overlap, restoring is exact. That is the
 * *logic*. This file proves the **picture agrees with the logic**, which is a
 * different claim and, after Phase 10, the one most likely to quietly stop being
 * true.
 *
 * The risk is specific. The scene now draws three things that are not properties:
 * a ghost, an arrow and a red volume. Each of them is a *statement* — "the record
 * says here", "it moved this far", "this exact region is claimed twice" — and
 * each is drawn by a renderer that could, with one careless edit, start making
 * that statement from its own arithmetic instead of from the engine's. The
 * failure mode is the worst kind: everything still renders, nothing throws, and
 * the demonstration confidently highlights a volume the validator never found.
 *
 * So the six properties below are exactly the six claims the picture makes:
 *
 *   1. **The canonical record survives the presentation.** Building a focus reads
 *      the record; it must not touch it.
 *   2. **The displacement is what the simulation actually applied** — and is
 *      proportional at every point of the animation, not just at the end.
 *   3. **The intersection bounds are the validator's**, not a reconstruction.
 *   4. **The intersection volume is the validator's**, and is the product of its
 *      own extents.
 *   5. **The ghost stands exactly where the record says** — identical bounds, not
 *      approximately equal ones.
 *   6. **Restoring is exact, and leaves no conflict behind.**
 *
 * Plus two structural ones: the disputed region genuinely lies inside both
 * properties, and the emphasis rule leaves the model alone when nothing is
 * focused.
 *
 * Pure: no React, no Three.js, no console and no throw. The runner at the foot is
 * the only thing that talks.
 */

import { DEMO_BUILDING_FOOTPRINT } from '../data/demoParcel'
import { DEFAULT_BUILDING_CONFIG } from '../scene/buildingConfig'
import { buildApartmentUnits, type ApartmentUnit } from '../scene/unitLayout'
import type { CheckResult } from '../ulpin/ulpinSelfCheck'
import { getBoxCentre, type Box3D } from '../validation/aabb'
import { findOwnershipConflicts } from '../validation/validateTopology'
import {
  buildConflictFocus,
  getConflictEmphasis,
  getConflictFraming,
  type ConflictFocus,
} from './conflictPresentation'
import {
  applyConflictSimulation,
  DEFAULT_ENCROACHMENT_M,
  findEncroachmentPair,
  getEncroachmentShiftM,
  type EncroachmentPair,
} from './conflictSimulation'

function expect(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
): CheckResult {
  return { name, passed, expected, actual }
}

/** Tolerance for a comparison between two floating-point metre values. */
const EPSILON_M = 1e-9

/** Whether two boxes are the same box, to the last bit that matters. */
function boxesEqual(a: Box3D, b: Box3D): boolean {
  return (
    Math.abs(a.xMin - b.xMin) < EPSILON_M &&
    Math.abs(a.xMax - b.xMax) < EPSILON_M &&
    Math.abs(a.yMin - b.yMin) < EPSILON_M &&
    Math.abs(a.yMax - b.yMax) < EPSILON_M &&
    Math.abs(a.zMin - b.zMin) < EPSILON_M &&
    Math.abs(a.zMax - b.zMax) < EPSILON_M
  )
}

function boxToString(box: Box3D): string {
  return `[${box.xMin}, ${box.xMax}] × [${box.yMin}, ${box.yMax}] × [${box.zMin}, ${box.zMax}]`
}

/** Whether `inner` lies within `outer`, allowing for floating-point slack. */
function boxContains(outer: Box3D, inner: Box3D): boolean {
  return (
    inner.xMin >= outer.xMin - EPSILON_M &&
    inner.xMax <= outer.xMax + EPSILON_M &&
    inner.yMin >= outer.yMin - EPSILON_M &&
    inner.yMax <= outer.yMax + EPSILON_M &&
    inner.zMin >= outer.zMin - EPSILON_M &&
    inner.zMax <= outer.zMax + EPSILON_M
  )
}

/** Build the focus at a given progress, from the engine's own finding. */
function focusAt(
  canonical: readonly ApartmentUnit[],
  pair: EncroachmentPair,
  progress: number,
): ConflictFocus | null {
  const displayUnits = applyConflictSimulation(
    canonical,
    pair,
    true,
    DEFAULT_ENCROACHMENT_M,
    progress,
  )

  return buildConflictFocus({
    pair,
    canonicalUnits: canonical,
    displayUnits,
    conflicts: findOwnershipConflicts(displayUnits),
    progress,
  })
}

/** Run every conflict-presentation check. Pure: no console, no throw. */
export function checkConflictPresentation(): CheckResult[] {
  const config = DEFAULT_BUILDING_CONFIG
  const canonical = buildApartmentUnits(config, DEMO_BUILDING_FOOTPRINT)
  const results: CheckResult[] = []

  const pair = findEncroachmentPair(canonical)

  results.push(
    expect(
      'a wall-sharing pair exists to present a conflict between',
      pair !== null,
      'a pair',
      pair === null ? 'null' : `${pair.owner.unitNumber} / ${pair.encroacher.unitNumber}`,
    ),
  )
  if (pair === null) return results

  /* ── 1. Building the presentation does not touch the record ───────────── */

  const before = JSON.stringify(canonical)
  const settled = focusAt(canonical, pair, 1)
  const after = JSON.stringify(canonical)

  results.push(
    expect(
      'deriving the conflict presentation leaves the canonical record byte-identical',
      before === after,
      'unchanged',
      before === after ? 'unchanged' : 'MUTATED',
    ),
  )

  results.push(
    expect(
      'a focus is produced for the settled simulation',
      settled !== null,
      'a focus record',
      settled === null ? 'null' : 'a focus record',
    ),
  )
  if (settled === null) return results

  /* ── 2. The displacement is the simulation's own, and is proportional ──── */

  const canonicalMoved = canonical.find((unit) => unit.id === pair.encroacher.id)

  results.push(
    expect(
      'the moved unit is still in the canonical array',
      canonicalMoved !== undefined,
      'found',
      canonicalMoved === undefined ? 'missing' : 'found',
    ),
  )
  if (canonicalMoved === undefined) return results

  results.push(
    expect(
      'the settled displacement equals the configured encroachment',
      Math.abs(settled.displacementM - DEFAULT_ENCROACHMENT_M) < EPSILON_M,
      `${DEFAULT_ENCROACHMENT_M} m`,
      `${settled.displacementM} m`,
    ),
  )

  // Measured off the boxes, not off the label — this is the check that the
  // arrow, the caption and the geometry are describing one movement.
  const movedOnAxis =
    pair.axis === 'x'
      ? settled.simulatedBounds.xMin - settled.canonicalBounds.xMin
      : settled.simulatedBounds.zMin - settled.canonicalBounds.zMin
  const movedOffAxis =
    pair.axis === 'x'
      ? settled.simulatedBounds.zMin - settled.canonicalBounds.zMin
      : settled.simulatedBounds.xMin - settled.canonicalBounds.xMin

  results.push(
    expect(
      'the simulated bounds are translated by exactly the shift, on the shared-wall axis only',
      Math.abs(movedOnAxis - getEncroachmentShiftM(pair, DEFAULT_ENCROACHMENT_M, 1)) <
        EPSILON_M &&
        Math.abs(movedOffAxis) < EPSILON_M &&
        Math.abs(settled.simulatedBounds.yMin - settled.canonicalBounds.yMin) < EPSILON_M,
      `${getEncroachmentShiftM(pair, DEFAULT_ENCROACHMENT_M, 1)} m on ${pair.axis}, 0 elsewhere`,
      `${movedOnAxis} m on ${pair.axis}, ${movedOffAxis} m off-axis`,
    ),
  )

  // Proportionality across the animation, not merely at its end. A presentation
  // that was right at 0 and 1 and wrong in between would look correct in every
  // screenshot and wrong in the only thing an audience actually watches.
  const samples = [0, 0.25, 0.5, 0.75, 1]
  const proportional = samples.every((progress) => {
    const focus = focusAt(canonical, pair, progress)
    if (focus === null) return false
    const expectedM = DEFAULT_ENCROACHMENT_M * progress
    return Math.abs(focus.displacementM - expectedM) < 1e-9
  })

  results.push(
    expect(
      'the displacement is proportional to progress at every sampled point',
      proportional,
      '0, 1, 2, 3, 4 m at 0, ¼, ½, ¾, 1',
      proportional ? 'proportional' : 'NOT proportional',
    ),
  )

  /* ── 3 & 4. The intersection is the validator's, bounds and volume ────── */

  const simulated = applyConflictSimulation(canonical, pair, true)
  const engineConflicts = findOwnershipConflicts(simulated)

  results.push(
    expect(
      'the engine finds exactly one conflicting pair in the settled simulation',
      engineConflicts.length === 1,
      '1 pair',
      `${engineConflicts.length} pair(s)`,
    ),
  )

  const engineConflict = engineConflicts[0]
  const presented = settled.intersection

  results.push(
    expect(
      'the presentation carries an intersection when the engine found one',
      presented !== null,
      'an intersection',
      presented === null ? 'null' : 'an intersection',
    ),
  )

  if (engineConflict !== undefined && presented !== null) {
    results.push(
      expect(
        'the drawn intersection bounds ARE the validator’s intersection bounds',
        boxesEqual(presented.bounds, engineConflict.bounds),
        boxToString(engineConflict.bounds),
        boxToString(presented.bounds),
      ),
    )

    results.push(
      expect(
        'the drawn intersection volume IS the validator’s intersection volume',
        presented.volumeCubicM === engineConflict.intersectionVolumeCubicM,
        `${engineConflict.intersectionVolumeCubicM} m³`,
        `${presented.volumeCubicM} m³`,
      ),
    )

    // The engine's own volume is the product of the engine's own extents. This
    // is what stops a formatted figure and the box on screen drifting apart.
    const productOfExtents =
      engineConflict.extents.x * engineConflict.extents.y * engineConflict.extents.z

    results.push(
      expect(
        'the intersection volume is the product of its three extents',
        Math.abs(presented.volumeCubicM - productOfExtents) < 1e-9,
        `${productOfExtents} m³`,
        `${presented.volumeCubicM} m³`,
      ),
    )

    // The bounds and the extents are two views of one region, so the size the
    // renderer scales its cube by must be the extents the panel prints.
    results.push(
      expect(
        'the mesh size derived from the bounds equals the engine’s extents',
        Math.abs(presented.size[0] - engineConflict.extents.x) < 1e-9 &&
          Math.abs(presented.size[1] - engineConflict.extents.y) < 1e-9 &&
          Math.abs(presented.size[2] - engineConflict.extents.z) < 1e-9,
        `${engineConflict.extents.x} × ${engineConflict.extents.y} × ${engineConflict.extents.z} m`,
        `${presented.size[0]} × ${presented.size[1]} × ${presented.size[2]} m`,
      ),
    )

    // A disputed region that stuck out of one of the two properties would not
    // be a region either of them claims — it would be a rendering error wearing
    // the most persuasive object in the demonstration's clothes.
    results.push(
      expect(
        'the disputed region lies inside both conflicting property volumes',
        boxContains(settled.simulatedBounds, presented.bounds) &&
          boxContains(settled.ownerBounds, presented.bounds),
        'contained by both',
        boxContains(settled.simulatedBounds, presented.bounds)
          ? boxContains(settled.ownerBounds, presented.bounds)
            ? 'contained by both'
            : 'escapes the owner'
          : 'escapes the moved unit',
      ),
    )
  }

  /* ── 5. The ghost stands exactly where the record says ─────────────────── */

  const recordBounds: Box3D = {
    xMin: canonicalMoved.xMin,
    xMax: canonicalMoved.xMax,
    yMin: canonicalMoved.yMin,
    yMax: canonicalMoved.yMax,
    zMin: canonicalMoved.zMin,
    zMax: canonicalMoved.zMax,
  }

  results.push(
    expect(
      'the ghost’s bounds are identical to the canonical record’s bounds',
      boxesEqual(settled.canonicalBounds, recordBounds),
      boxToString(recordBounds),
      boxToString(settled.canonicalBounds),
    ),
  )

  // And it does not move when the property does — the ghost is the record, not
  // a trailing copy of the animation.
  const halfway = focusAt(canonical, pair, 0.5)
  results.push(
    expect(
      'the ghost stays put while the property slides',
      halfway !== null && boxesEqual(halfway.canonicalBounds, recordBounds),
      boxToString(recordBounds),
      halfway === null ? 'null' : boxToString(halfway.canonicalBounds),
    ),
  )

  /* ── 6. Restoring is exact, and leaves nothing behind ──────────────────── */

  const restored = applyConflictSimulation(
    canonical,
    pair,
    true,
    DEFAULT_ENCROACHMENT_M,
    0,
  )

  results.push(
    expect(
      'progress 0 returns the canonical array itself, by reference',
      restored === canonical,
      'the same array',
      restored === canonical ? 'the same array' : 'a copy',
    ),
  )

  results.push(
    expect(
      'no ownership conflict remains once the property is fully restored',
      findOwnershipConflicts(restored).length === 0,
      '0 conflicts',
      `${findOwnershipConflicts(restored).length} conflicts`,
    ),
  )

  const atZero = focusAt(canonical, pair, 0)
  results.push(
    expect(
      'at zero displacement the presentation shows no disputed volume',
      atZero !== null && atZero.intersection === null && atZero.displacementM === 0,
      'no intersection, 0 m',
      atZero === null
        ? 'null focus'
        : `${atZero.intersection === null ? 'no intersection' : 'an intersection'}, ${atZero.displacementM} m`,
    ),
  )

  /* ── Emphasis: the focus dims context and never the subject ───────────── */

  const bystander = canonical.find(
    (unit) => unit.id !== pair.encroacher.id && unit.id !== pair.owner.id,
  )

  if (bystander !== undefined) {
    const subject = getConflictEmphasis(pair.encroacher.id, settled, 1)
    const other = getConflictEmphasis(bystander.id, settled, 1)
    const inactive = getConflictEmphasis(bystander.id, settled, 0)

    results.push(
      expect(
        'the two conflicting units keep full strength while everything else recedes',
        subject.fillScale === 1 &&
          subject.isSubject &&
          other.fillScale < 0.2 &&
          !other.isSubject,
        'subject 1, context < 0.2',
        `subject ${subject.fillScale}, context ${other.fillScale}`,
      ),
    )

    results.push(
      expect(
        'at zero focus every unit is drawn exactly as it would be without a conflict',
        inactive.fillScale === 1 && inactive.edgeScale === 1,
        'fill 1, edge 1',
        `fill ${inactive.fillScale}, edge ${inactive.edgeScale}`,
      ),
    )
  }

  /* ── Framing: the camera can see the ghost as well as the conflict ─────── */

  const framing = getConflictFraming(settled)

  if (framing !== null) {
    const ghostCentre = getBoxCentre(settled.canonicalBounds)
    const withinReach =
      Math.hypot(
        framing.centre[0] - ghostCentre[0],
        framing.centre[1] - ghostCentre[1],
        framing.centre[2] - ghostCentre[2],
      ) <= framing.radiusM + EPSILON_M

    results.push(
      expect(
        'the conflict framing reaches the canonical position as well as the overlap',
        withinReach && framing.radiusM > 0,
        'ghost inside the framing radius',
        withinReach ? 'ghost inside the framing radius' : 'ghost outside it',
      ),
    )
  } else {
    results.push(
      expect('the conflict framing exists', false, 'a framing', 'null'),
    )
  }

  return results
}

/** Development-only runner. Logs, then throws on any failure. */
export function runConflictPresentationSelfCheck(): void {
  const results = checkConflictPresentation()
  const failures = results.filter((result) => !result.passed)

  if (failures.length === 0) {
    console.info(
      `[3D ULPIN] conflict-presentation self-check passed (${results.length} checks) — the ghost is the record, the red volume is the validator's own intersection`,
    )
    return
  }

  for (const failure of failures) {
    console.error(
      `[3D ULPIN] conflict-presentation self-check FAILED — ${failure.name}: expected "${failure.expected}", got "${failure.actual}"`,
    )
  }

  throw new Error(
    `[3D ULPIN] conflict-presentation self-check failed (${failures.length} of ${results.length}).`,
  )
}
