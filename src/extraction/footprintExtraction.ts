/**
 * AI-assisted building footprint extraction — the prototype's image input stage.
 *
 * ─── WHAT THIS IS, STATED PLAINLY ─────────────────────────────────────────
 * This module reads a raster image and returns **one building footprint ring in
 * metres**. It is the demonstration that the 3D cadastral pipeline can *begin
 * from an image* rather than from a polygon somebody typed.
 *
 * It is **not** a segmentation model. Nothing here is trained, nothing here is
 * learned, and no network is called. The extraction is a deterministic
 * colour-threshold-plus-connected-component pass over a bundled demo image —
 * the classical technique that a trained model would replace, wired into the
 * exact place a trained model would sit. Every label the interface puts on this
 * feature says "demo" for that reason, and `provenance.status` travels with the
 * geometry so a downstream consumer cannot lose the caveat.
 *
 * **A production system replaces this file and nothing else.** The contract is
 * `RasterImage + ImageGeoreference -> ExtractedFootprint`; a U-Net, a Mask R-CNN
 * or a vendor's building-footprint API produces exactly that, and every module
 * downstream — the parcel, the map, the 3D generator, the unit layout, the
 * validator — is unaffected because it has never seen an image.
 *
 * ─── WHY THE OUTPUT IS A SURVEY RING AND NOT A MASK ───────────────────────
 * The project already has one authoritative horizontal geometry type: a ring of
 * `{ eastM, northM }` that `footprintFromEastNorth` converts into the
 * `BuildingFootprint` everything else measures (see `geometry/footprint.ts`).
 * This module produces **that ring** — not a second footprint representation
 * that would then have to be kept in step with the first.
 *
 *     image pixels ──► mask ──► component ──► extent in px
 *                                                 │
 *                                    pixelToEastNorth (one function)
 *                                                 ↓
 *                                   footprintOutlineM  ← the project's ring
 *                                                 ↓
 *                         buildDemoParcel ──► map · 3D · units · validator
 *
 * The pixel polygon is carried alongside **for drawing the overlay only**. It is
 * presentation, in exactly the sense ARCHITECTURE §10.0 uses the word: it never
 * re-enters the geometry path, and nothing downstream imports it.
 *
 * ─── WHY THE EXTENT, RATHER THAN A TRACED CONTOUR ─────────────────────────
 * The component's mask is reduced to its **axis-aligned extent**. That is a
 * deliberate honesty rather than laziness: the prototype's unit subdivision
 * already lays its grid over the footprint's bounding box (see
 * `scene/unitLayout.ts`, which documents the limitation where it bites), so
 * tracing a richer contour here would produce a polygon whose extra detail the
 * next stage would immediately discard. `rectangularity` is reported so the
 * interface can say how well the assumption held for *this* image, and the gate
 * below refuses a component the assumption clearly does not fit.
 *
 * ─── NO DOM, NO REACT, NO CANVAS ──────────────────────────────────────────
 * `RasterImage` is structurally what `ImageData` already is, so the browser can
 * hand a real `ImageData` straight in — but the module itself is arithmetic over
 * a byte array and runs in bare Node, which is what makes
 * `extractionSelfCheck.ts` able to prove the georeferencing is exact without a
 * browser.
 *
 * UNIT CONVENTION: metres, everywhere. 1 Three.js unit = 1 metre.
 */

import {
  footprintFromEastNorth,
  getFootprintAreaSqM,
  type BuildingFootprint,
} from '../geometry/footprint'

/**
 * A decoded image, as bytes.
 *
 * Structurally identical to the browser's `ImageData`, deliberately: the caller
 * passes one in directly and no adapter is needed, while this module stays free
 * of any DOM type and therefore runnable outside a browser.
 */
export interface RasterImage {
  readonly width: number
  readonly height: number
  /** RGBA, four bytes per pixel, row-major from the top-left. */
  readonly data: Uint8ClampedArray | Uint8Array
}

/** One pixel position in image space. `y` grows **downwards**, as rasters do. */
export interface PixelPoint {
  readonly x: number
  readonly y: number
}

/**
 * A pixel-space rectangle, **half-open**: `[minX, maxX) x [minY, maxY)`.
 *
 * Half-open because a pixel is an *area*, not a point: pixel column 655 covers
 * the ground from 655 to 656. Recording the extent as an inclusive index and
 * converting it as if it were a point is the classic off-by-one that silently
 * shortens every measured building by one ground sample — 6.25 cm here, and
 * nobody would ever notice. The `max` fields are therefore one past the last
 * pixel, and `pixelToEastNorth` can be applied to them unchanged.
 */
export interface PixelBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

/**
 * How a bundled image is tied to the ground.
 *
 * Two numbers, because the image is a plain north-up raster with a known ground
 * sample distance — the same thing a GeoTIFF header carries, minus the CRS a
 * prototype at this scale does not need. See `demoImageSource.ts` for the values
 * and for why they are exact.
 */
export interface ImageGeoreference {
  /** Metres of ground per image pixel. */
  readonly groundSampleDistanceM: number
  /**
   * The pixel that sits on the parcel reference point — local `(0 m, 0 m)`, and
   * the same physical spot as the 3D scene's origin.
   */
  readonly originPx: PixelPoint
  /** Image width in pixels, as authored. Used to reject a mismatched raster. */
  readonly widthPx: number
  /** Image height in pixels, as authored. */
  readonly heightPx: number
}

/**
 * What the extractor is looking for, and how forgiving it is allowed to be.
 *
 * Stated as data rather than buried in the algorithm so the demo image and its
 * detection parameters can be read side by side, and so a second bundled image
 * would be a second record rather than a second code path.
 */
export interface ExtractionProfile {
  /** The roof's reference colour, sRGB. */
  readonly referenceRgb: readonly [number, number, number]
  /**
   * Per-channel tolerance. A Chebyshev (max-channel) distance rather than a
   * Euclidean one: it is the cheap test that behaves predictably when a roof is
   * uniformly lighter or darker than its reference, which is what shading does.
   */
  readonly tolerance: number
  /** Below this many mask pixels the component is noise, not a building. */
  readonly minimumMaskPixels: number
  /** Below this fill ratio the plan is not usable as a rectangle. */
  readonly minimumRectangularity: number
  /** Plausible ground extent, metres — a sanity gate on both axes. */
  readonly minimumSideM: number
  readonly maximumSideM: number
}

/** Where a footprint came from, carried with the geometry. */
export interface FootprintProvenance {
  /** How the ring was obtained. */
  readonly method: string
  /** What it was obtained from. */
  readonly input: string
  /** What weight it may be given. Always non-authoritative in this prototype. */
  readonly status: string
  /**
   * True when the extraction did not run and the bundled deterministic ring was
   * substituted. The interface says so; nothing silently pretends otherwise.
   */
  readonly isFallback: boolean
}

/** One survey-axis point, matching `data/demoParcel`'s `LocalPointM`. */
export interface SurveyPointM {
  readonly eastM: number
  readonly northM: number
}

/**
 * The result of an extraction: a footprint, and the evidence for it.
 *
 * `footprintOutlineM` is the only field the cadastre pipeline consumes. The rest
 * exists so the interface can show *why* the polygon is where it is, and so the
 * provenance record can be built from measurements rather than from adjectives.
 */
export interface ExtractedFootprint {
  /** **The ring the whole application then uses.** Survey axes, metres. */
  readonly footprintOutlineM: readonly SurveyPointM[]
  /** The same ring in Three.js axes, converted once by the shared function. */
  readonly footprint: BuildingFootprint
  /** Polygon area, from the shared shoelace in `geometry/footprint.ts`. */
  readonly areaSqM: number
  /** East-west extent, metres. */
  readonly widthM: number
  /** North-south extent, metres. */
  readonly depthM: number
  /** The detected outline in image pixels — **for the overlay only**. */
  readonly pixelPolygon: readonly PixelPoint[]
  /** The component's half-open pixel extent. */
  readonly pixelBounds: PixelBounds
  /** How many pixels the accepted component contains. */
  readonly maskPixelCount: number
  /** Component pixels ÷ bounding-box pixels. `1` for a perfect rectangle. */
  readonly rectangularity: number
  /** How closely the accepted pixels matched the reference colour, `0`–`1`. */
  readonly colourAgreement: number
  /**
   * **An illustrative prototype confidence, not a model score.**
   *
   * `rectangularity × colourAgreement` — two things this extractor actually
   * measured, multiplied. It is reported because a detection stage with no
   * quality figure invites the audience to assume perfection, and withheld from
   * every label that does not also carry the word "demo". A trained model would
   * replace it with a real posterior.
   */
  readonly demoConfidence: number
  /** Where this geometry came from. */
  readonly provenance: FootprintProvenance
}

/** Why an extraction was refused. Reported, never swallowed. */
export type ExtractionRejection =
  | 'image-size-mismatch'
  | 'no-candidate-pixels'
  | 'component-too-small'
  | 'component-touches-border'
  | 'implausible-ground-size'
  | 'not-rectangular-enough'

/** Either a footprint, or the stated reason there is not one. */
export type ExtractionOutcome =
  | { readonly ok: true; readonly footprint: ExtractedFootprint }
  | { readonly ok: false; readonly reason: ExtractionRejection }

/**
 * Convert an image pixel coordinate to survey metres.
 *
 * **The single crossing point between image space and ground space**, in the
 * same spirit as `footprintFromEastNorth` being the single crossing point
 * between survey space and Three.js space. Note the sign: raster `y` grows
 * downwards and `northM` grows upwards, so north is the *subtraction*. Getting
 * that backwards mirrors the building about its own centre — invisible on a
 * symmetric demo ring and catastrophic on a real one, which is exactly why the
 * flip lives in one named function with one test.
 */
export function pixelToEastNorth(
  px: number,
  py: number,
  geo: ImageGeoreference,
): SurveyPointM {
  return {
    eastM: (px - geo.originPx.x) * geo.groundSampleDistanceM,
    northM: (geo.originPx.y - py) * geo.groundSampleDistanceM,
  }
}

/**
 * Mark every pixel whose colour is within tolerance of the reference.
 *
 * One byte per pixel rather than a boolean array: a `Uint8Array` of a million
 * entries is a megabyte and is allocated once, where an `Array<boolean>` of the
 * same length is a pointer array several times the size.
 */
function buildColourMask(image: RasterImage, profile: ExtractionProfile): Uint8Array {
  const { width, height, data } = image
  const [refR, refG, refB] = profile.referenceRgb
  const tolerance = profile.tolerance
  const mask = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index++) {
    const offset = index * 4

    if (
      Math.abs(data[offset] - refR) <= tolerance &&
      Math.abs(data[offset + 1] - refG) <= tolerance &&
      Math.abs(data[offset + 2] - refB) <= tolerance
    ) {
      mask[index] = 1
    }
  }

  return mask
}

/** One connected region of the mask. */
interface MaskComponent {
  readonly pixelCount: number
  readonly bounds: PixelBounds
  readonly touchesBorder: boolean
  /** Summed Chebyshev colour distance from the reference, over its pixels. */
  readonly colourDistanceSum: number
}

/**
 * Find the largest 4-connected component of the mask.
 *
 * **Why a component and not just the mask's bounding box.** A threshold catches
 * whatever else in the frame happens to share the roof's colour — a light patch
 * of road, a neighbour's parapet, a vehicle. Taking the bounding box of the raw
 * mask would let any one of those stretch the measured building by metres, and
 * it would do it silently. The largest connected region is the building; the
 * strays are their own, smaller components and are discarded.
 *
 * Iterative, with an explicit index stack. A recursive flood fill over a
 * 64 000-pixel region overflows the JavaScript call stack, and does it only on
 * the large images — the ones a demo is most likely to be given.
 */
function findLargestComponent(
  mask: Uint8Array,
  image: RasterImage,
  profile: ExtractionProfile,
): MaskComponent | null {
  const { width, height, data } = image
  const [refR, refG, refB] = profile.referenceRgb
  const visited = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)

  let best: MaskComponent | null = null

  for (let seed = 0; seed < mask.length; seed++) {
    if (mask[seed] === 0 || visited[seed] === 1) continue

    let stackSize = 0
    stack[stackSize++] = seed
    visited[seed] = 1

    let pixelCount = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let touchesBorder = false
    let colourDistanceSum = 0

    while (stackSize > 0) {
      const index = stack[--stackSize]
      const x = index % width
      const y = (index - x) / width

      pixelCount++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesBorder = true
      }

      const offset = index * 4
      colourDistanceSum += Math.max(
        Math.abs(data[offset] - refR),
        Math.abs(data[offset + 1] - refG),
        Math.abs(data[offset + 2] - refB),
      )

      // Four-connectivity, not eight. Eight-connectivity bridges regions that
      // meet only at a corner, which on a roof-versus-render-noise mask is how
      // a stray speck two metres away joins the building.
      if (x > 0) {
        const left = index - 1
        if (mask[left] === 1 && visited[left] === 0) {
          visited[left] = 1
          stack[stackSize++] = left
        }
      }
      if (x < width - 1) {
        const right = index + 1
        if (mask[right] === 1 && visited[right] === 0) {
          visited[right] = 1
          stack[stackSize++] = right
        }
      }
      if (y > 0) {
        const up = index - width
        if (mask[up] === 1 && visited[up] === 0) {
          visited[up] = 1
          stack[stackSize++] = up
        }
      }
      if (y < height - 1) {
        const down = index + width
        if (mask[down] === 1 && visited[down] === 0) {
          visited[down] = 1
          stack[stackSize++] = down
        }
      }
    }

    if (best === null || pixelCount > best.pixelCount) {
      best = {
        pixelCount,
        // Half-open, per `PixelBounds`: one past the last pixel on each axis.
        bounds: { minX, minY, maxX: maxX + 1, maxY: maxY + 1 },
        touchesBorder,
        colourDistanceSum,
      }
    }
  }

  return best
}

/**
 * Turn a pixel extent into the project's footprint ring, in survey axes.
 *
 * Anticlockwise from the south-west corner, which is the winding the demo ring
 * in `data/demoParcel.ts` is authored in. Nothing downstream depends on winding
 * order — every function in `geometry/footprint.ts` is order-free — but matching
 * it means a diff between the extracted ring and the authored one is empty
 * rather than merely equivalent.
 */
export function ringFromPixelBounds(
  bounds: PixelBounds,
  geo: ImageGeoreference,
): SurveyPointM[] {
  const southWest = pixelToEastNorth(bounds.minX, bounds.maxY, geo)
  const northEast = pixelToEastNorth(bounds.maxX, bounds.minY, geo)

  return [
    { eastM: southWest.eastM, northM: southWest.northM },
    { eastM: northEast.eastM, northM: southWest.northM },
    { eastM: northEast.eastM, northM: northEast.northM },
    { eastM: southWest.eastM, northM: northEast.northM },
  ]
}

/** The pixel-space outline of an extent, for the overlay. Same winding, in raster order. */
function pixelPolygonFromBounds(bounds: PixelBounds): PixelPoint[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ]
}

/**
 * Extract one building footprint from an image.
 *
 * Returns an outcome rather than throwing or returning `null` on its own: the
 * caller has a real fallback to offer (see `demoImageSource.ts`), and it can
 * only offer it honestly if it is told *which* gate refused the image. A silent
 * `null` would leave the interface saying "detection failed" for six different
 * reasons, one of which is a mis-wired georeference.
 *
 * The gates, in order, and why each one exists:
 *
 *   image-size-mismatch      the georeference describes a different raster, so
 *                            every metre figure derived from it would be wrong
 *                            by a scale factor and look perfectly plausible
 *   no-candidate-pixels      the threshold matched nothing
 *   component-too-small      the largest region is speckle
 *   component-touches-border the building runs off the frame; its true extent is
 *                            not in the image and cannot be measured from it
 *   implausible-ground-size  the result is not a building at this scale
 *   not-rectangular-enough   the plan does not fit the prototype's rectangular
 *                            subdivision, which is a documented limitation
 *                            rather than something to paper over
 */
export function extractBuildingFootprint(
  image: RasterImage,
  geo: ImageGeoreference,
  profile: ExtractionProfile,
  provenance: Omit<FootprintProvenance, 'isFallback'>,
): ExtractionOutcome {
  if (image.width !== geo.widthPx || image.height !== geo.heightPx) {
    return { ok: false, reason: 'image-size-mismatch' }
  }

  const mask = buildColourMask(image, profile)
  const component = findLargestComponent(mask, image, profile)

  if (component === null) {
    return { ok: false, reason: 'no-candidate-pixels' }
  }
  if (component.pixelCount < profile.minimumMaskPixels) {
    return { ok: false, reason: 'component-too-small' }
  }
  if (component.touchesBorder) {
    return { ok: false, reason: 'component-touches-border' }
  }

  const { bounds } = component
  const boxPixels = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  const rectangularity = component.pixelCount / boxPixels

  const footprintOutlineM = ringFromPixelBounds(bounds, geo)
  const footprint = footprintFromEastNorth(footprintOutlineM)
  const widthM = (bounds.maxX - bounds.minX) * geo.groundSampleDistanceM
  const depthM = (bounds.maxY - bounds.minY) * geo.groundSampleDistanceM

  if (
    widthM < profile.minimumSideM ||
    depthM < profile.minimumSideM ||
    widthM > profile.maximumSideM ||
    depthM > profile.maximumSideM
  ) {
    return { ok: false, reason: 'implausible-ground-size' }
  }
  if (rectangularity < profile.minimumRectangularity) {
    return { ok: false, reason: 'not-rectangular-enough' }
  }

  // How well the accepted pixels actually matched, normalised by the slack they
  // were allowed. A component made entirely of exact-reference pixels scores 1;
  // one that only just squeezed through the tolerance everywhere scores 0.
  const meanColourDistance = component.colourDistanceSum / component.pixelCount
  const colourAgreement = clamp01(1 - meanColourDistance / profile.tolerance)

  return {
    ok: true,
    footprint: {
      footprintOutlineM,
      footprint,
      // The shared shoelace, not a width × depth: one area implementation in
      // the project, and it stays right the day a real contour arrives.
      areaSqM: getFootprintAreaSqM(footprint),
      widthM,
      depthM,
      pixelPolygon: pixelPolygonFromBounds(bounds),
      pixelBounds: bounds,
      maskPixelCount: component.pixelCount,
      rectangularity,
      colourAgreement,
      demoConfidence: clamp01(rectangularity * colourAgreement),
      provenance: { ...provenance, isFallback: false },
    },
  }
}

/**
 * Wrap an already-known ring as an `ExtractedFootprint`, marked as fallback.
 *
 * The demo must stay runnable. If the browser refuses a pixel read, the image
 * fails to decode, or a gate above rejects the frame, the application falls back
 * to the deterministic ring the project has used since Phase 8 — and says so,
 * everywhere the source is described. **A fallback that looked like a detection
 * would be the one dishonest thing in this feature**, so `isFallback` is part of
 * the record rather than a flag the interface keeps on the side.
 *
 * The evidence fields are zeroed rather than invented: there was no mask, so
 * there is no mask pixel count, and `demoConfidence` is `0` because nothing was
 * measured. The interface renders no confidence at all in this state.
 */
export function fallbackFootprint(
  footprintOutlineM: readonly SurveyPointM[],
  provenance: Omit<FootprintProvenance, 'isFallback'>,
): ExtractedFootprint {
  const footprint = footprintFromEastNorth(footprintOutlineM)
  const xs = footprint.map((point) => point.x)
  const zs = footprint.map((point) => point.z)

  return {
    footprintOutlineM,
    footprint,
    areaSqM: getFootprintAreaSqM(footprint),
    widthM: Math.max(...xs) - Math.min(...xs),
    depthM: Math.max(...zs) - Math.min(...zs),
    pixelPolygon: [],
    pixelBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    maskPixelCount: 0,
    rectangularity: 0,
    colourAgreement: 0,
    demoConfidence: 0,
    provenance: { ...provenance, isFallback: true },
  }
}

/** Human wording for a refusal, for the one line the interface shows. */
export function describeRejection(reason: ExtractionRejection): string {
  switch (reason) {
    case 'image-size-mismatch':
      return 'the source image does not match its georeference record'
    case 'no-candidate-pixels':
      return 'no candidate roof pixels were found'
    case 'component-too-small':
      return 'the largest candidate region is too small to be a building'
    case 'component-touches-border':
      return 'the candidate building runs off the edge of the frame'
    case 'implausible-ground-size':
      return 'the measured extent is not a plausible building size'
    case 'not-rectangular-enough':
      return 'the detected plan is not rectangular enough for this prototype'
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
