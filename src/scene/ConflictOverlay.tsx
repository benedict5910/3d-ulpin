import { useEffect, useMemo } from 'react'
import { BoxGeometry, EdgesGeometry, Quaternion, Vector3 } from 'three'
import { Html } from '@react-three/drei'

import {
  CANONICAL_POSITION_LABEL,
  type ConflictFocus,
} from '../simulation/conflictPresentation'
import { getBoxCentre, getBoxSize } from '../validation/aabb'

/**
 * The three pieces of geometry that make an ownership conflict legible.
 *
 * ```
 *        ┌───────────┐
 *        ┊  ghost    ┊ ──────►  ┌────────┬──┬────────┐
 *        └───────────┘  arrow   │ moved  │██│ owner  │
 *      "Canonical position"     └────────┴──┴────────┘
 *                                         ▲
 *                                "84.0 m³ OVERLAP"
 * ```
 *
 * WHY THESE THREE AND NOTHING ELSE
 * A judge looking at two red boxes has to be able to answer four questions
 * without being told, and each of these objects answers exactly one of them:
 *
 *     which property moved?          the arrow starts on it
 *     where was it supposed to be?   the ghost is standing there
 *     what exactly is disputed?      the intersection volume is that region
 *     how far is the error?          the arrow is labelled with the distance
 *
 * Anything beyond those four would be decoration competing with them. There are
 * no glows, no pulses, no particles and no outline shaders here: the scene is
 * already showing a genuinely alarming fact and dressing it up would make it look
 * less true rather than more urgent.
 *
 * NONE OF THIS IS CADASTRAL GEOMETRY, AND THE CODE SAYS SO IN THREE WAYS
 * The ghost is not a property, the arrow is not a boundary, and the intersection
 * volume is owned by nobody — it is precisely the region whose ownership is the
 * question. So every mesh in this file:
 *
 *   1. has `raycast={() => null}`, so it can never be clicked or selected;
 *   2. is built from a `ConflictFocus`, which is derived and never written back;
 *   3. lives outside `<Building>`, so no code that iterates the property units
 *      can reach it, count it, or hand it to the validator.
 *
 * The intersection volume in particular is drawn from **the engine's own
 * bounds** — `focus.intersection.bounds`, straight off the `OwnershipConflict`
 * that `findOwnershipConflicts` returned. This component positions and scales a
 * unit cube by those numbers and does no geometry of its own. If the engine finds
 * nothing, nothing is drawn, however far the property has been moved.
 *
 * WHY IT IS ALLOWED TO DRAW THROUGH THE BUILDING
 * The intersection's edges use `depthTest={false}`. That is normally a mistake —
 * it makes an object float in front of geometry it is inside. Here it is the
 * point: the disputed volume is *buried between two solid boxes* and would
 * otherwise be visible only from the two angles that happen to look down the gap.
 * The conflict focus mode fades everything else to near-nothing precisely so that
 * a shape drawn through the model reads as "inside there" rather than "in front".
 */

/* ── The palette ─────────────────────────────────────────────────────────── */

/**
 * The disputed volume: the loudest thing the application ever draws.
 *
 * A saturated signal red, not an emergency-services fluorescent one. The
 * distinction matters: the surrounding units are already `#c0453d`, so the
 * intersection has to out-rank them, and the cheap way to do that is a colour
 * that could not occur in a building. That reads as a rendering artefact rather
 * than as a finding — the scene stops looking like a cadastre and starts looking
 * like a game. This is the same family as the conflict red, lifted in saturation
 * and value until it separates, and it is the only place in the project that
 * colour is used at this strength.
 */
const INTERSECTION_COLOR = '#f0392c'
const INTERSECTION_EMISSIVE = '#8e1a12'
const INTERSECTION_EMISSIVE_INTENSITY = 0.95
/**
 * Translucent, because both claims have to remain visible through it.
 *
 * An opaque disputed volume would hide the very boxes whose overlap it
 * represents, which turns the strongest piece of evidence into an occluder. Just
 * under half lets the two red units read through it while the region itself is
 * unmistakably a solid object rather than a highlight.
 */
const INTERSECTION_OPACITY = 0.46
/** Its edges, bright and drawn through everything. See the note above. */
const INTERSECTION_EDGE_COLOR = '#ffd2cb'

/**
 * The ghost: grey-white, and almost not there.
 *
 * Deliberately *colourless*. Every other hue in the scene means something —
 * slate is a property, amber is your selection, red is disputed — and the
 * canonical position is not a state of a property, it is a memory of one. Giving
 * it a colour would enrol it in the same scale as the things it is not.
 */
const GHOST_COLOR = '#cfdae4'
const GHOST_FILL_OPACITY = 0.055
const GHOST_EDGE_OPACITY = 0.62

/** The displacement arrow. The same grey as the ghost: it belongs to it. */
const ARROW_COLOR = '#dbe6f0'
const ARROW_OPACITY = 0.85
/** Shaft radius in metres — thin enough to be a measurement, not an object. */
const ARROW_SHAFT_RADIUS_M = 0.11
/** Head length and radius, in metres. */
const ARROW_HEAD_LENGTH_M = 0.9
const ARROW_HEAD_RADIUS_M = 0.32

/**
 * Below this displacement the arrow is not drawn, in metres.
 *
 * At the very start of the slide the arrow would be shorter than its own head,
 * which renders as a small grey blob sitting on the ghost. Half a metre is where
 * it starts reading as an arrow.
 */
const MINIMUM_ARROW_M = 0.5

/** Perspective scaling for the labels. Matches `SceneLabels.tsx`. */
const LABEL_DISTANCE_FACTOR = 26

/** How far above the ghost its caption floats, in metres. */
const GHOST_LABEL_LIFT_M = 0.9

/** How far above the disputed volume its caption floats, in metres. */
const VOLUME_LABEL_LIFT_M = 1.5

/**
 * Below this the focus has not arrived and nothing is drawn at all.
 *
 * Not merely an optimisation: at very low opacity a translucent box reads as a
 * smear rather than as a volume, and a smear that appears whenever the presenter
 * hovers near the simulate button would be worse than nothing.
 */
const MINIMUM_PRESENCE = 0.01

interface ConflictOverlayProps {
  /**
   * The derived conflict record, or `null` when nothing is staged.
   *
   * Rebuilt on every frame of the slide by `App`, so the intersection this
   * component draws is the one the engine found *for the current record* rather
   * than the one it will find when the animation finishes.
   */
  focus: ConflictFocus | null
  /**
   * How far the focus transition has got, `0`–`1`.
   *
   * Multiplies every opacity in the file, so entering and leaving conflict mode
   * is one continuous fade driven by one number — the same arrangement as the
   * generation reveal and the isolation ghosting.
   */
  presence: number
  /**
   * The vertical display offset of the conflict's own floor, in metres.
   *
   * The one concession to the visualisation layer. Everything this component
   * draws sits at true cadastral coordinates *plus* whatever the exploded view
   * has done to the floor the conflict is on, so the ghost and the disputed
   * volume travel with the two properties they are about instead of being left
   * behind at the elevation the register records. Supplied by `App`, which is the
   * only place that knows both the focus and the explosion.
   */
  floorOffsetY: number
}

/** A wireframe box on given bounds, positioned in world space. */
function BoxOutline({
  size,
  centre,
  color,
  opacity,
  depthTest = true,
  renderOrder = 0,
}: {
  size: readonly [number, number, number]
  centre: readonly [number, number, number]
  color: string
  opacity: number
  depthTest?: boolean
  renderOrder?: number
}) {
  // Keyed on the three numbers rather than on the tuple, deliberately. The
  // tuple is rebuilt on every frame of the slide (it comes from a focus record
  // that is itself rebuilt every frame), so depending on its identity would
  // allocate and free a GPU buffer sixty times a second for a ghost whose size
  // never changes at all.
  const [sizeX, sizeY, sizeZ] = size
  const geometry = useMemo(() => {
    const box = new BoxGeometry(sizeX, sizeY, sizeZ)
    const edges = new EdgesGeometry(box)
    // The box was only scaffolding for the edge extraction.
    box.dispose()
    return edges
  }, [sizeX, sizeY, sizeZ])

  // Geometries hold GPU buffers; React will not free them for us.
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments
      position={[centre[0], centre[1], centre[2]]}
      geometry={geometry}
      renderOrder={renderOrder}
      raycast={() => null}
    >
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthTest={depthTest}
      />
    </lineSegments>
  )
}

/**
 * The displacement arrow: a shaft and a head, pointing from the canonical
 * position to the simulated one.
 *
 * Built from the focus's own displacement vector rather than from the two
 * centres, so the arrow is drawn from the same number the label quotes and the
 * simulation moved the box by. A cylinder's local axis is +Y, so one quaternion
 * rotates the pair onto the displacement direction — which keeps this general
 * rather than assuming the encroachment is along X.
 */
function DisplacementArrow({
  from,
  displacement,
  opacity,
}: {
  from: readonly [number, number, number]
  displacement: readonly [number, number, number]
  opacity: number
}) {
  // Same reasoning as `BoxOutline`: keyed on the components, not the tuple.
  const [dx, dy, dz] = displacement
  const vector = useMemo(() => new Vector3(dx, dy, dz), [dx, dy, dz])
  const length = vector.length()

  const quaternion = useMemo(() => {
    if (length <= 0) return new Quaternion()
    return new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      vector.clone().normalize(),
    )
  }, [vector, length])

  if (length < MINIMUM_ARROW_M) return null

  // The head is a fixed length; the shaft takes whatever is left, so the arrow
  // grows from the tail rather than scaling as a whole and making the head swell.
  const shaftLength = Math.max(0.01, length - ARROW_HEAD_LENGTH_M)

  return (
    <group position={[from[0], from[1], from[2]]} quaternion={quaternion}>
      <mesh position={[0, shaftLength / 2, 0]} raycast={() => null}>
        <cylinderGeometry
          args={[ARROW_SHAFT_RADIUS_M, ARROW_SHAFT_RADIUS_M, shaftLength, 10]}
        />
        <meshBasicMaterial color={ARROW_COLOR} transparent opacity={opacity} />
      </mesh>
      <mesh
        position={[0, shaftLength + ARROW_HEAD_LENGTH_M / 2, 0]}
        raycast={() => null}
      >
        <coneGeometry args={[ARROW_HEAD_RADIUS_M, ARROW_HEAD_LENGTH_M, 14]} />
        <meshBasicMaterial color={ARROW_COLOR} transparent opacity={opacity} />
      </mesh>
    </group>
  )
}

function ConflictOverlay({ focus, presence, floorOffsetY }: ConflictOverlayProps) {
  const ghostSize = useMemo(
    () => (focus === null ? null : getBoxSize(focus.canonicalBounds)),
    [focus],
  )

  if (focus === null || presence <= MINIMUM_PRESENCE || ghostSize === null) {
    return null
  }

  /** Everything here is drawn on the conflict floor, wherever that is drawn. */
  const lift = (point: readonly [number, number, number]) =>
    [point[0], point[1] + floorOffsetY, point[2]] as const

  const ghostCentre = lift(getBoxCentre(focus.canonicalBounds))
  const intersection = focus.intersection

  return (
    <group>
      {/* ── 1. THE CANONICAL POSITION ────────────────────────────────────
              Where the register says this property is. A transparent shell
              with a wireframe on it: solid enough to be a place, faint enough
              that it can never be mistaken for one of the twenty volumes the
              cadastre actually contains. */}
      <mesh position={[...ghostCentre]} raycast={() => null}>
        <boxGeometry args={[ghostSize[0], ghostSize[1], ghostSize[2]]} />
        <meshBasicMaterial
          color={GHOST_COLOR}
          transparent
          opacity={GHOST_FILL_OPACITY * presence}
          // A ghost that wrote depth would hide the property that moved out of
          // it — which is the one thing the viewer is being asked to compare it
          // against.
          depthWrite={false}
        />
      </mesh>
      <BoxOutline
        size={ghostSize}
        centre={ghostCentre}
        color={GHOST_COLOR}
        opacity={GHOST_EDGE_OPACITY * presence}
      />
      <Html
        position={[
          ghostCentre[0],
          ghostCentre[1] + ghostSize[1] / 2 + GHOST_LABEL_LIFT_M,
          ghostCentre[2],
        ]}
        center
        distanceFactor={LABEL_DISTANCE_FACTOR}
        zIndexRange={[7, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="scene-label scene-label-ghost" style={{ opacity: presence }}>
          {CANONICAL_POSITION_LABEL}
        </span>
      </Html>

      {/* ── 2. THE DISPLACEMENT ──────────────────────────────────────────
              How far, and which way. The label is the focus's own
              `displacementLabel`, so it counts up with the animation and cannot
              disagree with the distance the box actually travelled. */}
      <DisplacementArrow
        from={ghostCentre}
        displacement={focus.displacement}
        opacity={ARROW_OPACITY * presence}
      />
      {focus.displacementM >= MINIMUM_ARROW_M && (
        <Html
          position={[...lift(focus.displacementMidpoint)]}
          center
          distanceFactor={LABEL_DISTANCE_FACTOR}
          zIndexRange={[8, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="scene-label scene-label-displacement"
            style={{ opacity: presence }}
          >
            {focus.displacementLabel}
          </span>
        </Html>
      )}

      {/* ── 3. THE DISPUTED VOLUME ───────────────────────────────────────
              THE POINT OF THE WHOLE PHASE. Positioned and scaled entirely by
              the engine's intersection bounds — this component contributes a
              cube and a colour and nothing else. Absent until the engine
              actually finds an intersection, so the first frames of the slide
              show a property moving and no dispute, which is the truth. */}
      {intersection !== null && (
        <>
          <mesh
            position={[...lift(intersection.centre)]}
            renderOrder={10}
            raycast={() => null}
          >
            <boxGeometry
              args={[
                intersection.size[0],
                intersection.size[1],
                intersection.size[2],
              ]}
            />
            <meshStandardMaterial
              color={INTERSECTION_COLOR}
              emissive={INTERSECTION_EMISSIVE}
              emissiveIntensity={INTERSECTION_EMISSIVE_INTENSITY}
              transparent
              opacity={INTERSECTION_OPACITY * presence}
              roughness={0.4}
              metalness={0}
              depthWrite={false}
              // The disputed volume's faces are coplanar with the two units'
              // faces by construction — that is what an intersection is — so
              // without an offset they z-fight along every shared plane and the
              // most important object in the scene shimmers.
              polygonOffset
              polygonOffsetFactor={-6}
              polygonOffsetUnits={-6}
            />
          </mesh>
          <BoxOutline
            size={intersection.size}
            centre={lift(intersection.centre)}
            color={INTERSECTION_EDGE_COLOR}
            opacity={0.9 * presence}
            depthTest={false}
            renderOrder={11}
          />
          <Html
            position={[
              intersection.centre[0],
              intersection.centre[1] +
                floorOffsetY +
                intersection.size[1] / 2 +
                VOLUME_LABEL_LIFT_M,
              intersection.centre[2],
            ]}
            center
            distanceFactor={LABEL_DISTANCE_FACTOR}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span
              className="scene-label scene-label-overlap"
              style={{ opacity: presence }}
            >
              {intersection.volumeLabel}
              <span className="scene-label-sub">{intersection.dimensionsLabel}</span>
            </span>
          </Html>
        </>
      )}
    </group>
  )
}

export default ConflictOverlay
