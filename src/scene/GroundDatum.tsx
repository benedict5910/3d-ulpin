import { useEffect, useMemo } from 'react'
import { BufferGeometry, Vector3 } from 'three'

import type { BuildingFootprint } from '../geometry/footprint'
import { GROUND_DATUM_Y } from '../underground/basementConfig'

/**
 * The ground datum, drawn as a thing rather than assumed as a convention.
 *
 * WHY THIS COMPONENT EXISTS AT ALL
 * Until this phase, `y = 0` was where the building happened to start. Nothing on
 * screen asserted it, because nothing needed it asserted: everything in the
 * model was above it. The moment volumes exist on both sides, `y = 0` stops
 * being an origin and becomes a **boundary with a legal meaning** — the surface
 * where surface rights meet subsurface rights, where a basement ceiling may
 * touch a ground-floor slab but may not pass through it.
 *
 * A boundary that matters has to be visible. So the datum is drawn: a bright
 * closed ring on the building's own footprint, at exactly `GROUND_DATUM_Y`.
 *
 * WHY THE FOOTPRINT RING RATHER THAN A PLANE
 * A second plane at y = 0 would z-fight with the ground and would hide the
 * volumes below it — the two failures the underground view is trying to avoid.
 * A line has neither problem: it reads from above, from below and edge-on, it
 * costs nothing to draw, and edge-on it is exactly the picture the mode is
 * making — a horizontal line with the tower above it and the basement beneath.
 *
 * It is drawn on the **footprint the building was cut from**, not on an
 * invented square, so what the ring encloses is the plan the two stacks share.
 */

/** The datum line's colour: warm, and used for nothing else in the scene. */
const DATUM_COLOR = '#e8b563'

/** Its opacity at rest, and at full underground view. */
const DATUM_RESTING_OPACITY = 0.45
const DATUM_ACTIVE_OPACITY = 1

/**
 * A hair above the datum, in metres.
 *
 * The ground plane also sits at y = 0. Two coplanar surfaces produce z-fighting
 * — the shimmer that reads as a rendering fault — so the line is lifted by a
 * millimetre. At the scale of a 14 m building that is invisible, and it is far
 * below the epsilon any validation rule uses, so the *drawn* datum and the
 * *recorded* datum are the same number for every purpose except the depth
 * buffer.
 */
const DATUM_DRAW_EPSILON_M = 0.001

interface GroundDatumProps {
  /** The building footprint, in metres. The ring the datum is drawn on. */
  footprint: BuildingFootprint
  /**
   * How far the underground view has arrived, `0`–`1`.
   *
   * The datum is always drawn — it is always true — but it brightens as the
   * view that is about it arrives.
   */
  undergroundAmount: number
}

function GroundDatum({ footprint, undergroundAmount }: GroundDatumProps) {
  /**
   * The closed ring, as a line geometry at the datum elevation.
   *
   * Built from the footprint's own vertices — the same ring the pad, the shell
   * and the unit grid are built from — so the datum lands exactly on the plan
   * outline rather than near it. Drawn as a `lineLoop`, which closes itself, so
   * the opening vertex is not repeated: the ring is stored implicitly closed
   * everywhere else in the model and this component does not become the one
   * place that says otherwise.
   */
  const geometry = useMemo(() => {
    if (footprint.length === 0) return new BufferGeometry()

    const points = footprint.map(
      (corner) =>
        new Vector3(corner.x, GROUND_DATUM_Y + DATUM_DRAW_EPSILON_M, corner.z),
    )

    return new BufferGeometry().setFromPoints(points)
  }, [footprint])

  // Geometries hold GPU buffers; React will not free them for us.
  useEffect(() => () => geometry.dispose(), [geometry])

  const opacity =
    DATUM_RESTING_OPACITY +
    (DATUM_ACTIVE_OPACITY - DATUM_RESTING_OPACITY) * undergroundAmount

  return (
    <lineLoop geometry={geometry} raycast={() => null} name="ground-datum">
      <lineBasicMaterial color={DATUM_COLOR} transparent opacity={opacity} />
    </lineLoop>
  )
}

export default GroundDatum
