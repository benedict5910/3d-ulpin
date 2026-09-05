/**
 * Ownership conflict simulation — a temporary, hypothetical override on the
 * cadastral record, used to prove the validator is real.
 *
 * WHY THIS EXISTS
 * A validation engine that has only ever been shown a valid model has
 * demonstrated nothing. The panel says `TOPOLOGY VALID`, and so would a panel
 * that always says `TOPOLOGY VALID`. The only convincing demonstration is to
 * break the geometry in front of the audience and let the same engine find the
 * break — which is what this module makes possible.
 *
 * **The engine is never told there is a conflict.** It is handed an array of
 * units and it discovers the overlap by intersecting every pair, exactly as it
 * does for the valid model. Nothing here sets a flag, and nothing here imports
 * the validator.
 *
 * THE ARCHITECTURE — WHY THIS IS A THIRD KIND OF COORDINATE
 * See ARCHITECTURE §10.0. The project keeps three things rigidly apart:
 *
 *     A. canonical geometry     the record            never written to
 *     C. simulation override    a hypothetical        THIS MODULE
 *     B. visualisation transform a way of drawing     offsets only
 *
 * A simulated conflict is **not** a visualisation. Exploding the view changes
 * where a box is drawn; simulating a conflict changes *what the record says the
 * property is*, which is why the inspector shows the simulated bounds and the
 * validator is pointed at them. The two must not be confused: if the exploded
 * offset were treated as a simulation the validator would see phantom
 * conflicts, and if the simulation were treated as a visualisation the
 * validator would never see the real one.
 *
 * The override is expressed as a pure function:
 *
 *     canonicalUnits ──► applyConflictSimulation ──► displayUnits
 *
 * It returns a **new array** with one entry replaced. The canonical array is
 * untouched and still in memory, which is what makes "Restore Valid Geometry" a
 * matter of pointing at it again rather than an undo, an inverse translation, or
 * a regeneration. Restoring cannot drift, because nothing was changed.
 *
 * WHY THE PAIR IS DERIVED, NOT NAMED
 * Hard-coding "302 encroaches into 301" would work today and would be a lie
 * about what the code knows. The pair is **found** by testing adjacency: two
 * units on the same floor whose volumes touch on exactly one axis and genuinely
 * overlap on the other two — which is the definition of sharing a wall. Change
 * the grid to 3 × 4 and a valid encroachment pair is still found; change the
 * demo building entirely and the simulation still has something to demonstrate.
 *
 * No React, no Three.js, no validation import.
 */

/** The minimum a unit must expose to take part in a simulation. */
export interface SimulatableUnit {
  readonly id: string
  readonly unitNumber: string
  readonly floorLevel: number
  readonly indexOnFloor: number
  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
  readonly zMin: number
  readonly zMax: number
}

/** Which horizontal axis two neighbours share a wall on. */
export type EncroachmentAxis = 'x' | 'z'

/** A pair of wall-sharing neighbours, and which way one would have to move. */
export interface EncroachmentPair {
  /** The property being encroached upon. The lower-indexed of the two. */
  readonly owner: SimulatableUnit
  /** The property whose boundary is drawn in the wrong place. */
  readonly encroacher: SimulatableUnit
  /** The axis their shared wall lies on. */
  readonly axis: EncroachmentAxis
  /** `+1` or `−1`: the direction the encroacher must move to overlap the owner. */
  readonly direction: number
  /** The floor they are both on. */
  readonly floorLevel: number
}

/**
 * How far the encroaching boundary is drawn in the wrong place, in metres.
 *
 * Four metres against a nine-metre unit: unmistakable from any camera angle, and
 * still obviously an *error in one wall* rather than one flat sitting on top of
 * another. A subtler overlap would be more realistic and would not read from the
 * back of a room; a larger one would look like a bug in the renderer rather than
 * a defect in a record.
 */
export const DEFAULT_ENCROACHMENT_M = 4

/**
 * Which floor the demo conflict is staged on.
 *
 * The middle floor of five. It has neighbours above and below, so the exploded
 * and isolated views both have something to show around it, and it sits at eye
 * level in the default camera framing rather than at the top or bottom of the
 * screen. A preference, not a requirement — `findEncroachmentPair` will take any
 * floor it is given, and falls back to any floor that has a usable pair.
 */
export const PREFERRED_CONFLICT_FLOOR = 3

/**
 * How long the encroaching property takes to slide into its wrong position, in
 * milliseconds.
 *
 * PHASE 10: THE MOVE IS ANIMATED, AND THAT IS AN ARGUMENT RATHER THAN A FLOURISH
 * Before this phase the override was applied in one frame. The geometry was
 * correct and the demonstration was not: a box that is in the right place on one
 * frame and the wrong place on the next has not visibly *moved*, so an audience
 * sees a red box appear and has no way to know which property moved, where it
 * came from, or that anything moved at all. The single most common question after
 * the old demo was "wait, which one is wrong?".
 *
 * A second and a bit is long enough for the eye to follow one box across a
 * distance and short enough that a presenter is not standing in silence. It is
 * deliberately longer than the 850 ms camera flight it starts alongside, so the
 * camera has arrived and settled before the property finishes arriving — the
 * viewer is looking at the right place by the time the overlap forms.
 */
export const CONFLICT_ANIMATION_MS = 1400

/**
 * And how long it takes to slide back, in milliseconds.
 *
 * Faster than the outward move. Going wrong is the thing being demonstrated and
 * deserves the time; going right again is the thing being *restored*, and a
 * restore that takes as long as the damage reads as hesitancy. It is still an
 * animation rather than a snap, because the point of the return trip is to show
 * that the canonical position was there all along and the property goes back to
 * it exactly — a cut would show only that the red went away.
 */
export const CONFLICT_RESTORE_MS = 900

/** Tolerance for "these two touch on this axis", in metres. */
const TOUCH_EPSILON_M = 1e-6

/** Per-axis overlap of two boxes. Local: this module does not import the engine. */
function overlapOn(
  a: SimulatableUnit,
  b: SimulatableUnit,
  axis: 'x' | 'y' | 'z',
): number {
  const min = `${axis}Min` as const
  const max = `${axis}Max` as const
  return Math.min(a[max], b[max]) - Math.max(a[min], b[min])
}

/** The centre of a box on one axis. */
function centreOn(unit: SimulatableUnit, axis: EncroachmentAxis): number {
  return axis === 'x' ? (unit.xMin + unit.xMax) / 2 : (unit.zMin + unit.zMax) / 2
}

/**
 * Find two units that share a wall — the pair a conflict can be staged between.
 *
 * "Share a wall" is decided geometrically, not by name: the two must be on the
 * same floor, overlap genuinely on their vertical axis and on one horizontal
 * axis, and touch to within a tolerance on the other. That is exactly the
 * condition the validator's overlap test treats as *not* a conflict, which is
 * what makes such a pair the right one to break: moving one of them across their
 * shared plane turns a legal adjacency into an illegal intersection, and nothing
 * else about the model changes.
 *
 * Units are considered in `indexOnFloor` order so the choice is deterministic —
 * the same pair every time the demo is run, which matters when the demo is
 * rehearsed. The lower-indexed unit is the owner; its neighbour encroaches.
 *
 * @param preferredFloor tried first; any floor with a usable pair is accepted if
 *   it has none. Returns `null` only if no two units in the building share a
 *   wall at all, which for any grid-subdivided floor cannot happen.
 */
export function findEncroachmentPair(
  units: readonly SimulatableUnit[],
  preferredFloor: number = PREFERRED_CONFLICT_FLOOR,
): EncroachmentPair | null {
  const floors = [...new Set(units.map((unit) => unit.floorLevel))].sort(
    (a, b) => a - b,
  )
  // The preferred floor first, then the rest in order.
  const search = [
    ...floors.filter((level) => level === preferredFloor),
    ...floors.filter((level) => level !== preferredFloor),
  ]

  for (const floorLevel of search) {
    const onFloor = units
      .filter((unit) => unit.floorLevel === floorLevel)
      .sort((a, b) => a.indexOnFloor - b.indexOnFloor)

    for (let i = 0; i < onFloor.length; i++) {
      for (let j = i + 1; j < onFloor.length; j++) {
        const a = onFloor[i]
        const b = onFloor[j]

        // Same floor, so Y must genuinely overlap. Belt and braces.
        if (overlapOn(a, b, 'y') <= TOUCH_EPSILON_M) continue

        const dx = overlapOn(a, b, 'x')
        const dz = overlapOn(a, b, 'z')

        // Touching on X, genuinely sharing depth: a wall on the X axis.
        if (Math.abs(dx) <= TOUCH_EPSILON_M && dz > TOUCH_EPSILON_M) {
          return {
            owner: a,
            encroacher: b,
            axis: 'x',
            direction: Math.sign(centreOn(a, 'x') - centreOn(b, 'x')) || 1,
            floorLevel,
          }
        }

        // Or touching on Z, sharing width: a wall on the Z axis.
        if (Math.abs(dz) <= TOUCH_EPSILON_M && dx > TOUCH_EPSILON_M) {
          return {
            owner: a,
            encroacher: b,
            axis: 'z',
            direction: Math.sign(centreOn(a, 'z') - centreOn(b, 'z')) || 1,
            floorLevel,
          }
        }
      }
    }
  }

  return null
}

/**
 * Apply the simulated encroachment, returning a **new** array.
 *
 * The encroaching unit is **translated** across its shared wall — not resized.
 * That is deliberate and it is the realistic fault: a boundary recorded in the
 * wrong place moves a whole property, and its area, volume and identifier are
 * unchanged because none of those are wrong. What is wrong is *where* it is, and
 * the consequence is that it now occupies space its neighbour also occupies.
 * Resizing it instead would produce a unit whose stated area no longer matched
 * its bounds, which is a second, different defect and would muddy the
 * demonstration.
 *
 * `active: false` returns the canonical array **by reference**. Not a copy, not a
 * rebuild — the same array. "Restore Valid Geometry" therefore returns the model
 * to a state that is not merely equal to the original but *is* the original, so
 * there is nothing for a rounding error or a stale memo to drift against.
 *
 * PHASE 10 — THE OVERRIDE IS NOW PARTIAL, AND STILL NOT A VISUALISATION
 * `progress` scales the translation: `0` leaves the property exactly where the
 * register says it is, `1` puts it fully across the wall, and the values between
 * are what the animation walks through. It is important to be clear about what
 * that is and is not. It is **not** a display offset — the intermediate array is
 * a genuine hypothetical record, the inspector reports its bounds and the
 * validator is handed it, exactly as at full strength. What is being animated is
 * *the hypothesis*, not the drawing of it.
 *
 * That distinction has a visible consequence, and it is the best moment in the
 * demonstration: because the engine is re-run on each intermediate record, the
 * reported intersection volume genuinely grows from nothing to 84 m³ as the
 * property slides. Nobody interpolated that number. It is measured, sixty times
 * a second, by the same function that measures the settled one.
 *
 * @param canonical the real records. Read, never written.
 * @param progress how far the move has got, `0`–`1`. Clamped. At exactly `0` the
 *   canonical array is returned **by reference**, so the end of a restore is not
 *   merely equal to the original but is the original.
 */
export function applyConflictSimulation<T extends SimulatableUnit>(
  canonical: readonly T[],
  pair: EncroachmentPair | null,
  active: boolean,
  encroachmentM: number = DEFAULT_ENCROACHMENT_M,
  progress: number = 1,
): readonly T[] {
  if (!active || pair === null) return canonical

  const shift = getEncroachmentShiftM(pair, encroachmentM, progress)

  // Exactly nowhere is exactly canonical. Returning the input array by reference
  // rather than a map that happens to add zero is what makes the *end* of the
  // restore animation identical to never having simulated at all — see the note
  // above about restoring being an identity rather than an inverse.
  if (shift === 0) return canonical

  return canonical.map((unit) => {
    if (unit.id !== pair.encroacher.id) return unit

    // A translation: both bounds move by the same amount, so the extent — and
    // therefore the area, the volume and the recorded size — is preserved.
    return pair.axis === 'x'
      ? { ...unit, xMin: unit.xMin + shift, xMax: unit.xMax + shift }
      : { ...unit, zMin: unit.zMin + shift, zMax: unit.zMax + shift }
  })
}

/**
 * How far the encroacher has been moved at a given progress, in metres, signed.
 *
 * **The single source of the displacement.** `applyConflictSimulation` uses it to
 * move the box, the presentation layer uses it to draw the arrow and to write the
 * "+4.0 m X" label, and the self-check uses it to assert that the three agree.
 * Nothing computes a displacement by subtracting two positions and hoping.
 *
 * Signed, because the direction is part of the fact: a property recorded four
 * metres too far west is a different error from one recorded four metres too far
 * east, and the arrow has to point somewhere.
 */
export function getEncroachmentShiftM(
  pair: EncroachmentPair | null,
  encroachmentM: number = DEFAULT_ENCROACHMENT_M,
  progress: number = 1,
): number {
  if (pair === null) return 0
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress
  return pair.direction * encroachmentM * clamped
}

/**
 * The displacement as a vector in scene axes, `[x, y, z]` metres.
 *
 * Y is always zero: the fault being simulated is a **horizontal** boundary
 * recorded in the wrong place, which is what a mis-surveyed wall actually is. A
 * vertical error would be a different defect — a floor recorded at the wrong
 * elevation — and would deserve its own simulation rather than being smuggled in
 * as a component of this one.
 *
 * Returned as a full triple even so, because its consumers are three-dimensional:
 * the arrow that draws it and the camera that frames it both want a vector, and a
 * scalar plus an axis name would make each of them reconstruct one.
 */
export function getDisplacementVectorM(
  pair: EncroachmentPair | null,
  encroachmentM: number = DEFAULT_ENCROACHMENT_M,
  progress: number = 1,
): [number, number, number] {
  const shift = getEncroachmentShiftM(pair, encroachmentM, progress)
  if (pair === null) return [0, 0, 0]
  return pair.axis === 'x' ? [shift, 0, 0] : [0, 0, shift]
}

/**
 * How the simulation describes itself, for the interface.
 *
 * Derived from the pair that was actually found, so the wording cannot name a
 * unit the simulation is not going to move.
 */
export interface ConflictScenario {
  readonly ownerNumber: string
  readonly encroacherNumber: string
  readonly floorLevel: number
  readonly axisLabel: string
  readonly encroachmentM: number
  /** The rule the resulting geometry violates. Quoted in the warning banner. */
  readonly violatedRule: string
}

/** Describe a pair as a scenario. `null` in, `null` out. */
export function describeScenario(
  pair: EncroachmentPair | null,
  encroachmentM: number = DEFAULT_ENCROACHMENT_M,
): ConflictScenario | null {
  if (pair === null) return null

  return {
    ownerNumber: pair.owner.unitNumber,
    encroacherNumber: pair.encroacher.unitNumber,
    floorLevel: pair.floorLevel,
    axisLabel: pair.axis === 'x' ? 'east–west' : 'north–south',
    encroachmentM,
    violatedRule: 'No two property volumes may intersect (3D ownership overlap)',
  }
}
