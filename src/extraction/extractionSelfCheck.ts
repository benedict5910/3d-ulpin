/**
 * Development-time self-check for the footprint extraction stage.
 *
 * WHAT IS WORTH CHECKING HERE, AND WHAT IS NOT
 * Nobody can eyeball whether a polygon drawn over an image corresponds to
 * −9.00 m east. The overlay will look right whether the ground sample distance
 * is 0.0625 or 0.0624, whether north is added or subtracted, and whether the
 * extent is read inclusively or half-open — and each of those mistakes moves a
 * property boundary by centimetres to metres while leaving the picture
 * convincing. Those are the four things this file asserts.
 *
 * It does **not** assert that the bundled PNG decodes to particular bytes. That
 * would be a test of the browser's image decoder. Instead it synthesises a
 * raster *to the same specification the PNG was drawn to* — same size, same
 * georeference, roof on the same pixel boundaries — and checks that the
 * extractor recovers the project's authored ring exactly. If the real image ever
 * drifts from that specification, the application's own extraction will produce
 * a different area from the one this check proves is correct, and the interface
 * shows both.
 *
 * Runs in bare Node: no DOM, no canvas, no React. That is the point of
 * `RasterImage` being plain bytes.
 *
 * Development only — `App` calls this inside an `import.meta.env.DEV` branch, so
 * the whole module is dropped from the production bundle.
 */

import { DEMO_BUILDING_FOOTPRINT_M } from '../data/demoParcel'
import { getFootprintAreaSqM } from '../geometry/footprint'
import {
  DEMO_AERIAL_GEOREFERENCE,
  DEMO_EXTRACTION_PROVENANCE,
  EXTRACTION_PROFILE,
  FALLBACK_FOOTPRINT_OUTLINE_M,
  FALLBACK_PROVENANCE,
} from './demoImageSource'
import {
  extractBuildingFootprint,
  fallbackFootprint,
  pixelToEastNorth,
  ringFromPixelBounds,
  type ExtractionProfile,
  type ImageGeoreference,
  type RasterImage,
} from './footprintExtraction'

/** The subject roof's pixel extent in the bundled image, half-open. */
const ROOF_PX = { minX: 368, minY: 400, maxX: 656, maxY: 624 } as const

let failures = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (!condition) {
    failures++
    console.error(
      `[3D ULPIN] extraction self-check FAILED: ${label}${detail ? ` — ${detail}` : ''}`,
    )
  }
}

/** Metres compare to a tenth of a millimetre; anything looser hides a real bug. */
function closeM(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-4
}

/**
 * Build a raster to the bundled image's specification.
 *
 * Everything is a flat fill except the roof rectangle and one decoy: a second
 * patch of the reference colour, smaller and disconnected, standing in for the
 * light patch of road or the neighbour's parapet that a colour threshold will
 * always also catch. The extractor must ignore it — which is the whole reason
 * `findLargestComponent` exists rather than a bounding box of the raw mask.
 */
function buildFixtureRaster(
  geo: ImageGeoreference,
  profile: ExtractionProfile,
  options: { readonly withDecoy: boolean } = { withDecoy: true },
): RasterImage {
  const { widthPx: width, heightPx: height } = geo
  const data = new Uint8ClampedArray(width * height * 4)
  const [refR, refG, refB] = profile.referenceRgb

  // Ground: a colour comfortably outside the tolerance on every channel.
  for (let index = 0; index < width * height; index++) {
    const offset = index * 4
    data[offset] = 110
    data[offset + 1] = 96
    data[offset + 2] = 76
    data[offset + 3] = 255
  }

  const paint = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    rgb: readonly [number, number, number],
  ): void => {
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const offset = (y * width + x) * 4
        data[offset] = rgb[0]
        data[offset + 1] = rgb[1]
        data[offset + 2] = rgb[2]
      }
    }
  }

  paint(ROOF_PX.minX, ROOF_PX.minY, ROOF_PX.maxX, ROOF_PX.maxY, [refR, refG, refB])

  // Rooftop plant, a few levels darker — inside the tolerance, so it must not
  // split the component, and inset, so it must not move the extent.
  paint(ROOF_PX.minX + 30, ROOF_PX.minY + 26, ROOF_PX.minX + 96, ROOF_PX.minY + 88, [
    refR - 15,
    refG - 15,
    refB - 14,
  ])

  // The decoy: 48 × 40 px, which is 3.0 m × 2.5 m of ground — deliberately
  // below both the pixel-count floor and the minimum building side, so the
  // "only the decoy" case below has a definite reason to be refused.
  if (options.withDecoy) {
    paint(120, 120, 168, 160, [refR, refG, refB])
  }

  return { width, height, data }
}

/**
 * Run every extraction assertion. Logs one summary line; returns nothing.
 */
export function runFootprintExtractionSelfCheck(): void {
  failures = 0

  const geo = DEMO_AERIAL_GEOREFERENCE
  const profile = EXTRACTION_PROFILE

  /* ── 1. The pixel → ground conversion, in isolation ──────────────────── */

  const origin = pixelToEastNorth(geo.originPx.x, geo.originPx.y, geo)
  check('the origin pixel is the parcel reference point', closeM(origin.eastM, 0) && closeM(origin.northM, 0))

  const oneRight = pixelToEastNorth(geo.originPx.x + 1, geo.originPx.y, geo)
  check(
    'one pixel east is one ground sample east',
    closeM(oneRight.eastM, geo.groundSampleDistanceM),
    `got ${oneRight.eastM}`,
  )

  // The sign that mirrors a building if it is wrong. Raster y grows DOWN.
  const oneDown = pixelToEastNorth(geo.originPx.x, geo.originPx.y + 1, geo)
  check(
    'one pixel down is one ground sample SOUTH',
    closeM(oneDown.northM, -geo.groundSampleDistanceM),
    `got ${oneDown.northM}`,
  )

  /* ── 2. The half-open convention ─────────────────────────────────────── */

  const oneMetreBox = ringFromPixelBounds(
    { minX: 512, minY: 512, maxX: 512 + 16, maxY: 512 + 16 },
    geo,
  )
  const oneMetreArea = getFootprintAreaSqM(
    oneMetreBox.map((point) => ({ x: point.eastM, z: point.northM })),
  )
  check(
    '16 pixels at 1/16 m encloses exactly 1 m²',
    closeM(oneMetreArea, 1),
    `got ${oneMetreArea} m²`,
  )

  /* ── 3. The whole extractor, against the image specification ─────────── */

  const raster = buildFixtureRaster(geo, profile)
  const outcome = extractBuildingFootprint(raster, geo, profile, DEMO_EXTRACTION_PROVENANCE)

  check('a specification-conformant raster yields a footprint', outcome.ok, outcome.ok ? '' : outcome.reason)

  if (outcome.ok) {
    const extracted = outcome.footprint

    check(
      'the extracted ring has four vertices',
      extracted.footprintOutlineM.length === 4,
      `got ${extracted.footprintOutlineM.length}`,
    )

    // THE ASSERTION THIS FILE EXISTS FOR: the image path reproduces the ring the
    // project has used since Phase 8, corner for corner. Not "an equivalent
    // rectangle" — the same four points.
    const authored = DEMO_BUILDING_FOOTPRINT_M
    const cornersMatch =
      extracted.footprintOutlineM.length === authored.length &&
      extracted.footprintOutlineM.every(
        (point, index) =>
          closeM(point.eastM, authored[index].eastM) &&
          closeM(point.northM, authored[index].northM),
      )
    check(
      'the extracted ring equals the authored demo footprint, corner for corner',
      cornersMatch,
      JSON.stringify(extracted.footprintOutlineM),
    )

    check('the extracted plan is 18.00 m east-west', closeM(extracted.widthM, 18), `got ${extracted.widthM}`)
    check('the extracted plan is 14.00 m north-south', closeM(extracted.depthM, 14), `got ${extracted.depthM}`)
    check('the extracted plan encloses 252 m²', closeM(extracted.areaSqM, 252), `got ${extracted.areaSqM}`)

    // The decoy is smaller than the roof and disconnected from it. If the
    // extractor had taken the bounding box of the raw mask instead of the
    // largest component, the extent would reach pixel 120 and the building would
    // measure ~33 m across.
    check(
      'the disconnected decoy patch is excluded',
      extracted.pixelBounds.minX === ROOF_PX.minX && extracted.pixelBounds.minY === ROOF_PX.minY,
      `bounds ${JSON.stringify(extracted.pixelBounds)}`,
    )

    check(
      'the illustrative confidence is a fraction, not a percentage',
      extracted.demoConfidence > 0 && extracted.demoConfidence <= 1,
      `got ${extracted.demoConfidence}`,
    )
    check('a real extraction is not marked as fallback', extracted.provenance.isFallback === false)
  }

  /* ── 4. The gates actually refuse ────────────────────────────────────── */

  const wrongSize = extractBuildingFootprint(
    { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) },
    geo,
    profile,
    DEMO_EXTRACTION_PROVENANCE,
  )
  check(
    'a raster that does not match the georeference is refused',
    !wrongSize.ok && wrongSize.reason === 'image-size-mismatch',
  )

  const blank: RasterImage = {
    width: geo.widthPx,
    height: geo.heightPx,
    data: new Uint8ClampedArray(geo.widthPx * geo.heightPx * 4),
  }
  const nothingThere = extractBuildingFootprint(blank, geo, profile, DEMO_EXTRACTION_PROVENANCE)
  check(
    'an image with no candidate pixels is refused',
    !nothingThere.ok && nothingThere.reason === 'no-candidate-pixels',
  )

  // Only the decoy: present, but far too small to be a building.
  const decoyOnly = buildFixtureRaster(geo, profile, { withDecoy: true })
  for (let y = ROOF_PX.minY; y < ROOF_PX.maxY; y++) {
    for (let x = ROOF_PX.minX; x < ROOF_PX.maxX; x++) {
      const offset = (y * geo.widthPx + x) * 4
      decoyOnly.data[offset] = 110
      decoyOnly.data[offset + 1] = 96
      decoyOnly.data[offset + 2] = 76
    }
  }
  const tooSmall = extractBuildingFootprint(decoyOnly, geo, profile, DEMO_EXTRACTION_PROVENANCE)
  check(
    'a speck-sized component is refused rather than reported as a building',
    !tooSmall.ok &&
      (tooSmall.reason === 'component-too-small' || tooSmall.reason === 'implausible-ground-size'),
    tooSmall.ok ? 'accepted' : tooSmall.reason,
  )

  /* ── 5. The fallback is honest ───────────────────────────────────────── */

  const fallback = fallbackFootprint(FALLBACK_FOOTPRINT_OUTLINE_M, FALLBACK_PROVENANCE)
  check('the fallback is marked as fallback', fallback.provenance.isFallback === true)
  check('the fallback carries no invented confidence', fallback.demoConfidence === 0)
  check('the fallback carries no invented mask', fallback.maskPixelCount === 0)
  check(
    'the fallback ring is the same 252 m² demo footprint',
    closeM(fallback.areaSqM, 252),
    `got ${fallback.areaSqM}`,
  )
  check(
    'the fallback and a real extraction describe the same building',
    outcome.ok ? closeM(fallback.areaSqM, outcome.footprint.areaSqM) : true,
  )

  if (failures === 0) {
    console.info('[3D ULPIN] footprint extraction self-check passed (21 assertions).')
  } else {
    console.error(`[3D ULPIN] footprint extraction self-check: ${failures} failure(s).`)
  }
}
