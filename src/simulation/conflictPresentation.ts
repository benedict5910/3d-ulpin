/**
 * The conflict **presentation** layer — the fourth kind of geometry.
 *
 * WHY THIS FILE EXISTS
 * By the end of Phase 10's predecessor the conflict demonstration was correct and
 * almost invisible. The validator found the overlap, the status bar flipped, two
 * boxes turned red — and an audience three metres from the screen could not tell
 * *which* box had moved, *where it had moved from*, or *which part of space* was
 * being claimed twice. The logic was doing the work and the picture was not
 * showing it.
 *
 * Fixing that is not a rendering problem, it is a derivation problem: there are
 * five distinct facts a viewer needs and the renderer must not be the thing that
 * invents any of them.
 *
 *     which property moved       the encroachment pair says so
 *     where it moved from        the canonical record still holds that
 *     which one it hit           the encroachment pair says so
 *     what volume overlaps       the validation engine returns it
 *     how far it moved           the simulation's own displacement function
 *
 * This module collects those five into one `ConflictFocus` record. Nothing here
 * measures, decides or discovers anything: every field is read from the module
 * that owns it. That is the whole point — a presentation layer that recomputed
 * the intersection would eventually draw a red box the engine had not found, and
 * a demonstration whose picture disagrees with its own verdict is worse than one
 * with no picture at all.
 *
 * THE FOUR KINDS OF GEOMETRY — AN EXTENSION OF ARCHITECTURE §10.0
 * The project already kept three apart. Phase 10 adds a fourth, and it is
 * genuinely different from all three:
 *
 *     A. CANONICAL       the record                    never written to
 *     B. VISUALISATION   exploded offsets, camera      affects meshes only
 *     C. SIMULATION      a hypothetical record         validated like a record
 *     D. PRESENTATION    the ghost, the arrow, the     DERIVED FROM A AND C,
 *                        intersection volume           read by nothing else
 *
 * D is not a visualisation transform, because it does not move anything that
 * exists — it *adds* geometry that has no cadastral existence at all. The ghost
 * is not a property, the arrow is not a boundary, and the intersection volume is
 * not owned by anybody: it is precisely the region whose ownership is the
 * question. None of the three may ever be clicked, validated, counted, or written
 * back, and none of them exists when there is no conflict.
 *
 * The direction of dependency is one-way and worth stating: A and C are inputs
 * here, and this module's output is an input to nothing but the renderer and the
 * conflict panel. Nothing in `validation/`, `scene/unitLayout.ts` or
 * `conflictSimulation.ts` imports this file, and they must not.
 *
 * No React, no Three.js.
 */

import {
  getBoxCentre,
  getBoxSize,
  getBoxUnion,
  type Box3D,
} from '../validation/aabb'
import type { OwnershipConflict } from '../validation/validateTopology'
import {
  DEFAULT_ENCROACHMENT_M,
  getDisplacementVectorM,
  getEncroachmentShiftM,
  type EncroachmentAxis,
  type EncroachmentPair,
} from './conflictSimulation'

/* ── Timing ──────────────────────────────────────────────────────────────── */

/**
 * How long the conflict *focus* takes to establish itself, in milliseconds.
 *
 * Distinct from `CONFLICT_ANIMATION_MS`, and shorter, because it is a different
 * thing being animated. The property's slide is the **subject**; the dimming of
 * everything that is not the conflict, and the arrival of the ghost, are the
 * **framing** around it. Framing that took as long as the subject would still be
 * settling while the interesting thing happened, so it lands first and gets out
 * of the way: by the time the property is a third of the way across, the rest of
 * the building has already receded and the eye has nowhere else to go.
 */
export const CONFLICT_FOCUS_MS = 460

/* ── How strongly everything else is drawn ───────────────────────────────── */

/**
 * What a non-conflicting unit's fill is multiplied by, at full focus.
 *
 * Much lower than floor isolation's ghost (a tenth) because it is doing a harder
 * job against a stronger subject. Isolation asks "which layer are we looking
 * at"; conflict focus asks "which two boxes out of twenty", and the answer has to
 * survive a bright translucent red volume sitting between them. At a twentieth
 * the surrounding properties are structure rather than objects.
 */
const FADED_FILL_SCALE = 0.05

/**
 * And what its edges are multiplied by.
 *
 * The same ratio-to-fill principle as floor isolation, for the same reason: what
 * must survive the fade is the *building*, so that the two red volumes are
 * legible as two apartments inside a block of twenty rather than as two shapes
 * floating in the dark. Take the edges down with the fill and the conflict stops
 * being a cadastral fact and becomes an abstract diagram.
 */
const FADED_EDGE_SCALE = 0.3

/** How strongly one unit is drawn while the conflict has the floor. */
export interface ConflictEmphasis {
  /** Multiplier for fill opacity. `1` for the two conflicting units. */
  readonly fillScale: number
  /** Multiplier for edge opacity. `1` for the two conflicting units. */
  readonly edgeScale: number
  /** True when this unit is one of the two the conflict is between. */
  readonly isSubject: boolean
}

/** Nothing in focus: every unit drawn exactly as it would be otherwise. */
const FULL_CONFLICT_EMPHASIS: ConflictEmphasis = {
  fillScale: 1,
  edgeScale: 1,
  isSubject: false,
}

/** Linear interpolation, kept local so this module's maths imports nothing. */
function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/* ── The focus record ────────────────────────────────────────────────────── */

/** The minimum a unit must expose to be presented. Structural, not imported. */
export interface PresentableUnit extends Box3D {
  readonly id: string
  readonly unitNumber: string
  readonly floorLevel: number
  readonly prototypeUlpin: string
}

/**
 * The disputed region, ready to draw.
 *
 * Every field is either taken verbatim from the engine's `OwnershipConflict` or
 * is a coordinate transform of its `bounds` — a centre and a size, because
 * Three.js anchors a box at its centre and the engine speaks in bounds. There is
 * no third source and no rounding: `volumeCubicM` is the engine's number and
 * `volumeLabel` is that number formatted.
 */
export interface ConflictIntersection {
  /** The engine's own intersection bounds, in metres. */
  readonly bounds: Box3D
  /** `x × y × z` overlap, in metres — the engine's extents. */
  readonly extents: { readonly x: number; readonly y: number; readonly z: number }
  /** The engine's intersection volume, in cubic metres. */
  readonly volumeCubicM: number
  /** `bounds` as a centre, for positioning a mesh. */
  readonly centre: readonly [number, number, number]
  /** `bounds` as a size, for scaling that mesh. */
  readonly size: readonly [number, number, number]
  /** `84.0 m³ OVERLAP` — the in-scene caption. Derived, never typed. */
  readonly volumeLabel: string
  /** `4.00 × 7.00 × 3.00 m` — the working, so the product can be checked. */
  readonly dimensionsLabel: string
}

/**
 * Everything the conflict presentation needs, in one derived record.
 *
 * Rebuilt on every frame of the slide, which is deliberate: the intersection
 * grows, the displacement grows, and the labels have to say what is true *now*
 * rather than what will be true when the animation stops. Building it is a few
 * lookups and some arithmetic over twenty units — cheaper than the validation
 * pass that produced its input.
 */
export interface ConflictFocus {
  /* Who. */

  /** The property whose boundary is recorded in the wrong place. */
  readonly movedUnitId: string
  readonly movedUnitNumber: string
  readonly movedUnitUlpin: string
  /** The property being encroached upon. It does not move. */
  readonly ownerUnitId: string
  readonly ownerUnitNumber: string
  readonly ownerUnitUlpin: string
  /** The floor they are both on — the one worth isolating. */
  readonly floorLevel: number
  /** The horizontal axis the shared wall lies on. */
  readonly axis: EncroachmentAxis

  /* Where. */

  /**
   * Where the register says the moved property is — the **ghost's** bounds.
   *
   * Read off the canonical array, not reconstructed by subtracting the
   * displacement from the simulated bounds. Those two are equal by construction
   * and only one of them is the record; drawing the reconstruction would mean the
   * ghost was a claim about the record rather than the record itself, and the
   * self-check asserts the two are identical for exactly that reason.
   */
  readonly canonicalBounds: Box3D
  /** Where the hypothetical puts it, at the current progress. */
  readonly simulatedBounds: Box3D
  /** The encroached-upon property's bounds. Canonical; it never moves. */
  readonly ownerBounds: Box3D

  /* How far. */

  /** `simulated − canonical`, in metres. Y is always 0 — see the simulation. */
  readonly displacement: readonly [number, number, number]
  /** Its magnitude, in metres. Always positive. */
  readonly displacementM: number
  /** `+4.0 m X` — the in-scene caption. Derived from the vector above. */
  readonly displacementLabel: string
  /** Midpoint of the canonical and simulated centres — where the arrow's label sits. */
  readonly displacementMidpoint: readonly [number, number, number]

  /* What overlaps. */

  /**
   * The disputed region, or `null` while the property has not yet moved far
   * enough to overlap anything.
   *
   * `null` rather than a zeroed record, for the same reason `getVolumeIntersection`
   * returns `null`: "they do not yet overlap" and "they overlap by nothing" are
   * different statements, and the first frames of the slide are genuinely the
   * former. It is what stops a 0.0 m³ red box flickering at the start of the
   * animation, and it comes from the engine rather than from a threshold here.
   */
  readonly intersection: ConflictIntersection | null
}

/** Metres, at the precision a boundary dispute would be argued in. */
function m2(value: number): string {
  return value.toFixed(2)
}

/**
 * Format a signed displacement along one axis, e.g. `+4.0 m X`.
 *
 * The sign is kept because the direction is part of the fact, and the axis letter
 * is upper-cased to match the way the rest of the project names scene axes. A
 * true minus sign rather than a hyphen: this is a number, not a range.
 */
function formatDisplacement(
  shiftM: number,
  axis: EncroachmentAxis,
): string {
  const sign = shiftM < 0 ? '−' : '+'
  return `${sign}${Math.abs(shiftM).toFixed(1)} m ${axis.toUpperCase()}`
}

/** Just the six bounds of a unit, so a focus record holds boxes and not units. */
function boundsOf(unit: PresentableUnit): Box3D {
  return {
    xMin: unit.xMin,
    xMax: unit.xMax,
    yMin: unit.yMin,
    yMax: unit.yMax,
    zMin: unit.zMin,
    zMax: unit.zMax,
  }
}

/** Everything `buildConflictFocus` needs. All of it from somewhere else. */
export interface ConflictFocusInput<T extends PresentableUnit> {
  /** The two wall-sharing neighbours the conflict is staged between. */
  readonly pair: EncroachmentPair | null
  /** The canonical record. Supplies the ghost. */
  readonly canonicalUnits: readonly T[]
  /** The display record — canonical with the override applied. */
  readonly displayUnits: readonly T[]
  /**
   * What the engine found in `displayUnits`.
   *
   * Passed in rather than computed here, and that is the load-bearing decision in
   * this module: the intersection drawn on screen is the one
   * `findOwnershipConflicts` returned, matched to this pair by unit id. If the
   * engine finds nothing, this module shows nothing, however far the property has
   * been moved.
   */
  readonly conflicts: readonly OwnershipConflict[]
  /** How far the slide has got, `0`–`1`. */
  readonly progress: number
  /** How far the boundary is wrong by, at full progress. */
  readonly encroachmentM?: number
}

/**
 * Assemble the focus record, or `null` when there is nothing to focus on.
 *
 * `null` when no pair was found, or when either unit has gone missing from the
 * arrays — which cannot happen with the generated model and is checked anyway,
 * because the alternative is a renderer dereferencing `undefined` in the middle
 * of a live demonstration.
 */
export function buildConflictFocus<T extends PresentableUnit>(
  input: ConflictFocusInput<T>,
): ConflictFocus | null {
  const { pair, canonicalUnits, displayUnits, conflicts, progress } = input
  if (pair === null) return null

  const encroachmentM = input.encroachmentM ?? DEFAULT_ENCROACHMENT_M

  const canonicalMoved = canonicalUnits.find((unit) => unit.id === pair.encroacher.id)
  const simulatedMoved = displayUnits.find((unit) => unit.id === pair.encroacher.id)
  const owner = displayUnits.find((unit) => unit.id === pair.owner.id)
  if (
    canonicalMoved === undefined ||
    simulatedMoved === undefined ||
    owner === undefined
  ) {
    return null
  }

  const canonicalBounds = boundsOf(canonicalMoved)
  const simulatedBounds = boundsOf(simulatedMoved)
  const ownerBounds = boundsOf(owner)

  /* How far — from the simulation's own function, not by subtracting boxes. */
  const shiftM = getEncroachmentShiftM(pair, encroachmentM, progress)
  const displacement = getDisplacementVectorM(pair, encroachmentM, progress)

  const canonicalCentre = getBoxCentre(canonicalBounds)
  const simulatedCentre = getBoxCentre(simulatedBounds)

  /* What overlaps — the engine's finding, matched by id. Not recomputed. */
  const found = conflicts.find(
    (conflict) =>
      (conflict.unitA.id === pair.encroacher.id &&
        conflict.unitB.id === pair.owner.id) ||
      (conflict.unitA.id === pair.owner.id &&
        conflict.unitB.id === pair.encroacher.id),
  )

  const intersection: ConflictIntersection | null =
    found === undefined
      ? null
      : {
          bounds: found.bounds,
          extents: found.extents,
          volumeCubicM: found.intersectionVolumeCubicM,
          centre: getBoxCentre(found.bounds),
          size: getBoxSize(found.bounds),
          volumeLabel: `${found.intersectionVolumeCubicM.toFixed(1)} m³ OVERLAP`,
          dimensionsLabel: `${m2(found.extents.x)} × ${m2(found.extents.y)} × ${m2(
            found.extents.z,
          )} m`,
        }

  return {
    movedUnitId: canonicalMoved.id,
    movedUnitNumber: canonicalMoved.unitNumber,
    movedUnitUlpin: canonicalMoved.prototypeUlpin,
    ownerUnitId: owner.id,
    ownerUnitNumber: owner.unitNumber,
    ownerUnitUlpin: owner.prototypeUlpin,
    floorLevel: pair.floorLevel,
    axis: pair.axis,

    canonicalBounds,
    simulatedBounds,
    ownerBounds,

    displacement,
    displacementM: Math.abs(shiftM),
    displacementLabel: formatDisplacement(shiftM, pair.axis),
    displacementMidpoint: [
      (canonicalCentre[0] + simulatedCentre[0]) / 2,
      (canonicalCentre[1] + simulatedCentre[1]) / 2,
      (canonicalCentre[2] + simulatedCentre[2]) / 2,
    ],

    intersection,
  }
}

/* ── Emphasis ────────────────────────────────────────────────────────────── */

/**
 * How strongly to draw one unit while the conflict has the floor.
 *
 * The two units the conflict is between keep their full strength; everything else
 * recedes. It composes with floor isolation by multiplication, exactly as
 * isolation composes with the exploded view — so isolating the conflict's floor
 * *and* focusing on the conflict fades the other four floors to ghosts and the
 * other two units on this floor to almost nothing, without either mechanism
 * knowing the other exists.
 *
 * @param amount how far the focus transition has got, `0`–`1`. At `0` the result
 *   is indistinguishable from no focus at all, which is what lets one function
 *   drive every frame of entering and leaving the mode.
 */
export function getConflictEmphasis(
  unitId: string,
  focus: ConflictFocus | null,
  amount: number,
): ConflictEmphasis {
  if (focus === null || amount <= 0) return FULL_CONFLICT_EMPHASIS

  if (unitId === focus.movedUnitId || unitId === focus.ownerUnitId) {
    return { fillScale: 1, edgeScale: 1, isSubject: true }
  }

  return {
    fillScale: mix(1, FADED_FILL_SCALE, amount),
    edgeScale: mix(1, FADED_EDGE_SCALE, amount),
    isSubject: false,
  }
}

/* ── Camera framing ──────────────────────────────────────────────────────── */

/** Where the camera should look to see the whole conflict, and from how far. */
export interface ConflictFraming {
  /** Centre of everything the conflict involves, in metres. */
  readonly centre: readonly [number, number, number]
  /**
   * A single distance that bounds it, in metres.
   *
   * The half-diagonal of the union rather than its largest side, so an
   * encroachment along the *narrow* axis of a wide pair still gets framed with
   * both properties fully in shot. The camera preset multiplies it; the number
   * itself is a property of the geometry.
   */
  readonly radiusM: number
}

/**
 * The framing that puts the ghost, the moved property and its neighbour on
 * screen together.
 *
 * The union deliberately includes the **canonical** bounds as well as the
 * simulated ones: the whole argument of the animation is "it came from *there*",
 * and a framing that fitted only the final state could leave the ghost off the
 * edge of the picture — the one thing the viewer most needs to see.
 *
 * Computed from the settled focus (progress 1) rather than the animating one, so
 * the camera flies to one destination instead of chasing a target that moves for
 * a second and a half.
 */
export function getConflictFraming(focus: ConflictFocus | null): ConflictFraming | null {
  if (focus === null) return null

  const union = getBoxUnion([
    focus.canonicalBounds,
    focus.simulatedBounds,
    focus.ownerBounds,
  ])
  if (union === null) return null

  const [sizeX, sizeY, sizeZ] = getBoxSize(union)

  return {
    centre: getBoxCentre(union),
    radiusM: 0.5 * Math.max(Math.hypot(sizeX, sizeZ), sizeY),
  }
}

/* ── The wording ─────────────────────────────────────────────────────────── */

/**
 * The rule the geometry violates, stated once.
 *
 * A constant rather than a string in the panel, for the same reason
 * `EXPLODED_VIEW_NOTE` is a constant: the rule and the check that enforces it must
 * not be able to drift into saying different things.
 */
export const CONFLICT_RULE =
  '3D ownership volumes must not positively overlap'

/** What the system asks for once it has found one. Not a decision — a referral. */
export const CONFLICT_STATUS = 'Requires cadastral review'

/**
 * The limit of what this system claims, stated on the panel itself.
 *
 * This sentence is the most important one in the phase and it is the easiest to
 * leave out. A spatial validator can prove that two records describe overlapping
 * volumes. It cannot know which of the two surveys was wrong, which deed is
 * older, which sale was registered first, or what a tribunal would decide — and a
 * prototype that implied otherwise would be making a claim about *law* on the
 * strength of arithmetic about boxes. Detection is a finding of fact about
 * geometry; ownership is a finding of law about people.
 */
export const CONFLICT_DISCLAIMER =
  'The system detects the conflict but does not decide legal ownership.'

/** The caption on the ghost. Says what it is, in the register's own terms. */
export const CANONICAL_POSITION_LABEL = 'Canonical position'

/**
 * The resolution path, as steps.
 *
 * Written down as data rather than as prose in a panel because it is a *claim
 * about process* and it should be reviewable as one. Note where the human is: the
 * system performs steps one and five, a cadastral officer performs steps two,
 * three and four, and nothing in the middle is automated. That ordering is the
 * honest one and it is the reason the list is here rather than being quietly
 * shortened to "detect → fix".
 */
export interface ResolutionStep {
  /** The step's short name, as it appears in the chain. */
  readonly label: string
  /** Who performs it, one line, for the tooltip. */
  readonly actor: string
  /** Whether this prototype actually performs the step. */
  readonly automated: boolean
}

export const CONFLICT_RESOLUTION_WORKFLOW: readonly ResolutionStep[] = [
  {
    label: 'Detected',
    actor: 'Automatic — the topology engine intersects every pair of volumes',
    automated: true,
  },
  {
    label: 'Source records compared',
    actor: 'Cadastral officer — the two surveys and their deeds are pulled',
    automated: false,
  },
  {
    label: 'Officer review required',
    actor: 'Cadastral officer — a person decides which record is wrong',
    automated: false,
  },
  {
    label: 'Correct geometry',
    actor: 'Cadastral officer — the corrected boundary is entered',
    automated: false,
  },
  {
    label: 'Revalidate',
    actor: 'Automatic — the same engine re-runs over the corrected record',
    automated: true,
  },
]
