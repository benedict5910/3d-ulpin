/**
 * The property inspector's input: one flat, tier-neutral record derived from
 * whichever kind of volume is selected.
 *
 * WHY THE PANEL DOES NOT TAKE THE UNION DIRECTLY
 * A selection can now be an apartment or a basement volume, and the two carry
 * different fields: `floorLevel` and `unitNumber` on one, `basementLevel` and
 * `spaceLabel` on the other. Handing `PropertyVolume` straight to the panel would
 * put a `volume.tier === 'underground' ? … : …` at every row that differs — the
 * hierarchy's level rung, its unit rung, the property-type row, the badge — which
 * is four branches in a *view*, and views are where branches go stale.
 *
 * Worse, it would put a **decision** in the panel: what to call the level, what
 * to call the space, whether this thing is underground. Those are facts about the
 * model, and this project's rule throughout is that the interface reads facts and
 * decides nothing (see `workflow/pipelineSteps.ts` for the same argument about
 * the pipeline, and `scene/unitStatus.ts` about colour).
 *
 * So the narrowing happens **once**, here, in a pure function, and the panel
 * renders a record with no optionals and no branches. It is the same shape for
 * both tiers, which is also what makes the panel's layout stable when the
 * selection moves from a flat to a parking bay — nothing appears, disappears or
 * reflows, only the values change.
 *
 * EVERY FIELD IS READ OR DERIVED, NONE IS INVENTED
 * The bounds are copied verbatim. The centroid comes from
 * `getPropertyVolumeCentre`, which delegates to whichever tier's own accessor the
 * *renderer* used, so the point printed in the panel is the point the mesh is
 * positioned at. The identifier is the one generated with the geometry. Nothing
 * here parses an identifier to recover its parts, and nothing formats a number
 * that the model does not hold.
 *
 * No React, no Three.js — a plain function over plain data, checkable in Node.
 */

import {
  getPropertyVolumeCentre,
  type PropertyVolume,
} from '../scene/propertyVolume'
import type { VerticalTier } from '../geometry/groundDatum'

/**
 * The badge shown above an underground record.
 *
 * A constant rather than a string in the panel, so the wording cannot appear in
 * one place and be forgotten in another — the same treatment
 * `PROTOTYPE_ENCODING_NOTE` and `EXPLODED_VIEW_NOTE` get.
 *
 * It says "space" as well as "property" deliberately. A parking bay under a
 * building may be a separately owned property, or an easement, or common area
 * appurtenant to the flats above — which of those it is, is a question of law and
 * of the deed, and this prototype records the *volume* without asserting the
 * answer. "Underground property / space" is the honest width of the claim.
 */
export const UNDERGROUND_BADGE = 'Underground property / space'

/**
 * One property volume, flattened for display.
 *
 * Deliberately all-required and all-primitive: a view that receives this cannot
 * be missing a value, cannot get one from somewhere else, and cannot compute one.
 */
export interface InspectorRecord {
  /** The volume's stable id. */
  readonly id: string
  /** Which side of the ground datum it sits on. */
  readonly tier: VerticalTier
  /**
   * The badge text for an underground volume, or `null` above ground.
   *
   * `null` rather than an empty string so the panel's condition is a presence
   * test rather than a truthiness test on text — and so there is no "above
   * ground" badge, which would label the unremarkable case and make the notable
   * one quieter by comparison.
   */
  readonly tierBadge: string | null

  /** `KA-BLR-0482-001928` — identical on both tiers, which is the point. */
  readonly parentParcelId: string
  /** The level rung of the hierarchy: `Floor 3`, or `Basement 1`. */
  readonly levelLabel: string
  /** The unit rung: `302`, or `Parking P01`. */
  readonly unitLabel: string
  /** The full prototype 3D ULPIN — the terminus of the hierarchy. */
  readonly prototypeUlpin: string

  /** Cadastral use: `Residential`, `Parking`, `Storage`, `Utility`. */
  readonly propertyType: string
  readonly areaSqM: number
  readonly volumeCubicM: number

  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
  readonly zMin: number
  readonly zMax: number

  /** `[x, y, z]` in metres, from the same accessor the renderer positions with. */
  readonly centroid: readonly [number, number, number]
}

/**
 * Flatten one selected volume into the record the inspector renders.
 *
 * The whole of the tier narrowing in this application's UI happens in the two
 * branches below. Everything after them is shared.
 */
export function buildInspectorRecord(volume: PropertyVolume): InspectorRecord {
  const centroid = getPropertyVolumeCentre(volume)

  const shared = {
    id: volume.id,
    parentParcelId: volume.parentParcelId,
    prototypeUlpin: volume.prototypeUlpin,
    propertyType: volume.propertyType,
    areaSqM: volume.areaSqM,
    volumeCubicM: volume.volumeCubicM,
    xMin: volume.xMin,
    xMax: volume.xMax,
    yMin: volume.yMin,
    yMax: volume.yMax,
    zMin: volume.zMin,
    zMax: volume.zMax,
    centroid,
  }

  if (volume.tier === 'underground') {
    return {
      ...shared,
      tier: 'underground',
      tierBadge: UNDERGROUND_BADGE,
      // "Basement 1", not "B01". The identifier segment is `B01` and it is shown,
      // in full, at the foot of the hierarchy; the rung above it is written the
      // way a person says it. The two are the same fact at two levels of
      // formality, which is exactly what the descent is for.
      levelLabel: `Basement ${volume.basementLevel}`,
      // "Parking P01" — the use and the space code, from the record.
      unitLabel: volume.spaceLabel,
    }
  }

  return {
    ...shared,
    tier: 'above-ground',
    tierBadge: null,
    levelLabel: `Floor ${volume.floorLevel}`,
    unitLabel: volume.unitNumber,
  }
}
