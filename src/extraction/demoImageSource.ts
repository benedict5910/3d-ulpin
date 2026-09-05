/**
 * The bundled demo source image, and how it is tied to the ground.
 *
 * ─── WHY THE IMAGE IS SYNTHETIC ───────────────────────────────────────────
 * `assets/demo-aerial.png` is a **drawn, top-down scene**, not photography. Two
 * reasons, both deliberate:
 *
 *   1. **Licensing.** Real aerial or satellite imagery of a real Bengaluru plot
 *      carries a licence and an owner. A prototype that will be pushed to a
 *      public repository should not carry either.
 *   2. **The georeference can be *exact*.** The scene was drawn with the subject
 *      roof placed on known pixel boundaries, so the extraction below recovers
 *      the project's 18.00 m × 14.00 m, 252 m² demo footprint to the last
 *      decimal — which is what lets this phase be a change of *input*, not a
 *      change of geometry. Every figure in the rest of the application is
 *      unchanged, so a reviewer can tell the two apart.
 *
 * It is labelled as synthetic wherever it is shown. It depicts no real place and
 * no real building.
 *
 * ─── THE GEOREFERENCE ─────────────────────────────────────────────────────
 * A plain north-up raster with a stated ground sample distance — the same two
 * facts a GeoTIFF header carries, minus the CRS handling a 64 m frame does not
 * need. The numbers are exact by construction:
 *
 *     raster          1024 × 1024 px
 *     ground sample   0.0625 m/px   (1/16 m — binary-exact in IEEE 754)
 *     coverage        64 m × 64 m
 *     origin pixel    (512, 512) — the parcel reference point, 12.9352 N,
 *                     77.6245 E, which is also the 3D scene's origin
 *
 * The subject roof occupies pixels `[368, 656) × [400, 624)`, so:
 *
 *     east   (368 − 512) × 0.0625 = −9.00 m   (656 − 512) × 0.0625 = +9.00 m
 *     north  (512 − 400) × 0.0625 = +7.00 m   (512 − 624) × 0.0625 = −7.00 m
 *
 * — the ring `DEMO_BUILDING_FOOTPRINT_M` has held since Phase 8. That agreement
 * is asserted, not hoped for: see `extractionSelfCheck.ts`.
 *
 * 0.0625 m/px is a plausible drone survey resolution (6.25 cm). It is not
 * survey-grade, and this module claims nothing of the kind.
 *
 * ─── WHAT WOULD REPLACE THIS FILE IN PRODUCTION ───────────────────────────
 * An orthophoto or a satellite tile with a real CRS, a real ground sample
 * distance and real acquisition metadata, fetched for the parcel under
 * inspection — and `EXTRACTION_PROFILE` would be replaced by a trained building
 * segmentation model rather than a colour threshold. The seam is the same in
 * both cases: an image plus a georeference in, one footprint ring out.
 */

import demoAerialUrl from '../assets/demo-aerial.png'
import { DEMO_BUILDING_FOOTPRINT_M } from '../data/demoParcel'
import type {
  ExtractionProfile,
  FootprintProvenance,
  ImageGeoreference,
  SurveyPointM,
} from './footprintExtraction'

/** The bundled image's URL, resolved by the bundler. No network at runtime. */
export const DEMO_AERIAL_IMAGE_URL: string = demoAerialUrl

/**
 * What the image is, in as few words as a provenance row can carry.
 *
 * Short on purpose: it is stamped into `FootprintProvenance.input` and rendered
 * in a 240 px column, where a longer string wraps to four lines and stops being
 * read. The raster's dimensions live in `DEMO_AERIAL_IMAGE_DETAIL` below, shown
 * where there is room for them.
 */
export const DEMO_AERIAL_IMAGE_LABEL = 'Bundled synthetic aerial image'

/** The raster's own facts, for the source stage's caption. */
export const DEMO_AERIAL_IMAGE_DETAIL = '1024 × 1024 px · 6.25 cm/px · 64 × 64 m'

/** The georeference. See the header for the derivation of every number. */
export const DEMO_AERIAL_GEOREFERENCE: ImageGeoreference = {
  groundSampleDistanceM: 0.0625,
  originPx: { x: 512, y: 512 },
  widthPx: 1024,
  heightPx: 1024,
}

/**
 * What the extractor looks for in that image.
 *
 * `referenceRgb` is the subject roof's drawn colour. The tolerance is generous
 * enough to hold the roof's own detail — the stair head, the tank plinth, the
 * two air-conditioning units and the parapet rule are all a few levels darker —
 * and far too tight to reach the neighbouring roofs, the road, the yard or the
 * cast shadow, none of which come within 40 levels on every channel at once.
 *
 * The gates are stated in *ground* units where they can be, because "at least
 * 4 m on a side" is a claim about buildings and "at least 2 000 pixels" is a
 * claim about this raster.
 */
export const EXTRACTION_PROFILE: ExtractionProfile = {
  referenceRgb: [201, 193, 176],
  tolerance: 34,
  minimumMaskPixels: 2_000,
  minimumRectangularity: 0.75,
  minimumSideM: 4,
  maximumSideM: 60,
}

/** The provenance stamped on a successful extraction from this image. */
export const DEMO_EXTRACTION_PROVENANCE: Omit<FootprintProvenance, 'isFallback'> = {
  method: 'AI-assisted footprint extraction demo',
  input: DEMO_AERIAL_IMAGE_LABEL,
  status: 'Prototype / non-authoritative',
}

/**
 * The provenance stamped on the fallback ring.
 *
 * A different `method` string, not a footnote on the same one: if the extraction
 * did not run, the interface must not be able to describe the geometry as
 * extracted. See `fallbackFootprint` in `footprintExtraction.ts`.
 */
export const FALLBACK_PROVENANCE: Omit<FootprintProvenance, 'isFallback'> = {
  method: 'Fallback demo geometry (no extraction)',
  input: 'Authored demo footprint ring, data/demoParcel.ts',
  status: 'Prototype / non-authoritative',
}

/**
 * The ring the fallback substitutes: the project's authored demo footprint.
 *
 * Imported, not restated. If the two ever needed to differ this module would be
 * maintaining a second description of the same building, which is the thing the
 * whole architecture is arranged to prevent.
 */
export const FALLBACK_FOOTPRINT_OUTLINE_M: readonly SurveyPointM[] =
  DEMO_BUILDING_FOOTPRINT_M
