import { useCallback, useRef, useState } from 'react'

import {
  DEMO_AERIAL_GEOREFERENCE,
  DEMO_AERIAL_IMAGE_DETAIL,
  DEMO_AERIAL_IMAGE_LABEL,
  DEMO_AERIAL_IMAGE_URL,
  DEMO_EXTRACTION_PROVENANCE,
  EXTRACTION_PROFILE,
  FALLBACK_FOOTPRINT_OUTLINE_M,
  FALLBACK_PROVENANCE,
} from '../extraction/demoImageSource'
import {
  describeRejection,
  extractBuildingFootprint,
  fallbackFootprint,
  type ExtractedFootprint,
} from '../extraction/footprintExtraction'
import {
  DEFAULT_BUILDING_CONFIG,
  getTotalHeight,
} from '../scene/buildingConfig'
import FootprintOverlay from './FootprintOverlay'

/**
 * The source stage: an image, a detection, and the footprint that comes out.
 *
 * ─── WHY THE APPLICATION NOW STARTS HERE ──────────────────────────────────
 * Until this phase the demo opened on a footprint that was simply *present* —
 * four corners in `data/demoParcel.ts`, authored by a person. That is honest, and
 * it is also the least interesting half of the claim: a cadastral system's first
 * problem is not "given a polygon, build a 3D record", it is **"where does the
 * polygon come from?"**. This stage answers that in the demonstration itself.
 *
 * It is a *stage*, not a panel, for a structural reason rather than an aesthetic
 * one. The workspace behind it — map, 3D scene, units, identifiers, validator —
 * cannot be built without a footprint, so it is not mounted until there is one.
 * That is what makes "the extracted footprint is the authoritative horizontal
 * geometry" a fact about the component tree rather than a claim in a comment: no
 * placeholder ring exists anywhere for the workspace to fall back to.
 *
 * ─── WHAT IS AND IS NOT BEING CLAIMED ─────────────────────────────────────
 * The extraction is a deterministic colour-threshold-and-connected-component
 * pass over a bundled synthetic image. It is **not a trained model**, and every
 * label here says so. What the stage demonstrates is the *pipeline seam* — that
 * the cadastre can begin from a raster and a georeference — which is the part a
 * production system keeps when it swaps the classical extractor for a trained
 * one. See `extraction/footprintExtraction.ts`.
 *
 * ─── THE VERTICAL METADATA IS SHOWN SEPARATELY, ON PURPOSE ────────────────
 * A single nadir image gives a horizontal outline and **nothing reliable about
 * height**. Presenting floors and storey height inside the detection result
 * would quietly suggest the image produced them. They are shown in their own
 * block, labelled as coming from building records, with the production sources
 * named. Both figures are read from `DEFAULT_BUILDING_CONFIG` — the same config
 * the 3D generator uses — so the stage cannot quote a height the model will not
 * build.
 *
 * ─── THE DEMO MUST NOT BE ABLE TO DEAD-END ────────────────────────────────
 * A pixel read can be refused (a tainted canvas, a disabled 2D context, an image
 * that failed to decode) and a gate can legitimately reject a frame. In every
 * one of those states the fallback ring is one click away and is labelled as
 * fallback geometry from that point on, all the way into the workspace's
 * provenance card. Nothing silently substitutes it.
 */

/** How far the stage has got. */
type Phase = 'idle' | 'working' | 'detected' | 'failed'

interface FootprintSourceStageProps {
  /**
   * Hand the extracted footprint to the application.
   *
   * Called once, when the presenter accepts the result. Detection and adoption
   * are two separate presses so the polygon can be *looked at* on the image
   * before it becomes the record — which is the moment the phase exists to show.
   */
  onAdopt: (extraction: ExtractedFootprint) => void
}

function FootprintSourceStage({ onAdopt }: FootprintSourceStageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [imageReady, setImageReady] = useState(false)
  const [result, setResult] = useState<ExtractedFootprint | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)

  const config = DEFAULT_BUILDING_CONFIG
  const totalHeightM = getTotalHeight(config)

  /**
   * Run the extraction against the decoded image.
   *
   * The two nested `requestAnimationFrame`s are not a delay and not a fake
   * spinner — the extraction is a few milliseconds of arithmetic. They exist so
   * the "Analysing…" state gets one paint before the main thread is occupied;
   * without them the button's own disabled state would never appear, and a
   * control that visibly ignores a press reads as broken. No timers, no random
   * duration, and the result is the same on every run.
   */
  const runDetection = useCallback(() => {
    setPhase('working')
    setFailureReason(null)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const image = imageRef.current

          if (image === null || !image.complete || image.naturalWidth === 0) {
            throw new Error('the source image has not decoded')
          }

          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight

          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (context === null) {
            throw new Error('this browser refused a 2D canvas context')
          }

          context.drawImage(image, 0, 0)
          // Same-origin, bundled: the canvas cannot be tainted here. The
          // try/catch is still real — a browser with images or canvas readback
          // disabled throws a SecurityError from exactly this line.
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height)

          const outcome = extractBuildingFootprint(
            pixels,
            DEMO_AERIAL_GEOREFERENCE,
            EXTRACTION_PROFILE,
            DEMO_EXTRACTION_PROVENANCE,
          )

          if (!outcome.ok) {
            setFailureReason(describeRejection(outcome.reason))
            setPhase('failed')
            return
          }

          setResult(outcome.footprint)
          setPhase('detected')
        } catch (error) {
          setFailureReason(error instanceof Error ? error.message : 'the pixel read failed')
          setPhase('failed')
        }
      })
    })
  }, [])

  /** Adopt the deterministic ring instead. Labelled as fallback from here on. */
  const useFallback = useCallback(() => {
    onAdopt(fallbackFootprint(FALLBACK_FOOTPRINT_OUTLINE_M, FALLBACK_PROVENANCE))
  }, [onAdopt])

  const coverageM = DEMO_AERIAL_GEOREFERENCE.widthPx * DEMO_AERIAL_GEOREFERENCE.groundSampleDistanceM

  return (
    // `app-source` overrides the four-row page grid: this screen has no
    // validation bar, so header / stage / footer is three rows, and without the
    // override the footer would take the `1fr` the stage needs.
    <div className="app app-source">
      <header className="app-header">
        <h1 className="title">3D ULPIN</h1>
        <p className="subtitle">Vertical Property &amp; Spatial Cadastre Platform</p>
      </header>

      <main className="source-stage">
        <div className="source-stage-inner">
          {/* LEFT — the image, the polygon once there is one, and the vertical
              facts the image cannot supply. */}
          <div className="source-stage-left">
            <figure className="source-frame">
              <div className="source-frame-canvas">
                <img
                  ref={imageRef}
                  className="source-image"
                  src={DEMO_AERIAL_IMAGE_URL}
                  width={DEMO_AERIAL_GEOREFERENCE.widthPx}
                  height={DEMO_AERIAL_GEOREFERENCE.heightPx}
                  alt="Bundled synthetic aerial scene: a walled plot with one large flat-roofed building, four neighbouring buildings, trees and two roads."
                  onLoad={() => setImageReady(true)}
                  onError={() => {
                    setImageReady(false)
                    setFailureReason('the bundled source image failed to load')
                    setPhase('failed')
                  }}
                />
                {/* The polygon, in the extractor's own pixel coordinates. */}
                {result !== null && (
                  <FootprintOverlay
                    className="source-overlay"
                    polygon={result.pixelPolygon}
                    widthPx={DEMO_AERIAL_GEOREFERENCE.widthPx}
                    heightPx={DEMO_AERIAL_GEOREFERENCE.heightPx}
                  />
                )}
              </div>
              <figcaption className="source-caption">
                {DEMO_AERIAL_IMAGE_LABEL} — {DEMO_AERIAL_IMAGE_DETAIL}. Drawn
                for this prototype; it depicts no real place and no real
                building.
              </figcaption>
            </figure>

            {/* VERTICAL METADATA — deliberately not inside the detection card.
                A single nadir image gives a horizontal outline and nothing
                reliable about height; putting these three rows in the result
                panel would quietly suggest the detection produced them. They sit
                beside the image, under a heading that says where they do come
                from. Both figures are read from `DEFAULT_BUILDING_CONFIG`, the
                same config the 3D generator uses, so this block cannot quote a
                height the model will not build. */}
            <section className="source-side-card" aria-label="Vertical metadata">
              <h2 className="summary-title">Vertical metadata — not from the image</h2>
              <dl className="summary-list">
                <div className="summary-row">
                  <dt>Floors</dt>
                  <dd>{config.numberOfFloors}</dd>
                </div>
                <div className="summary-row">
                  <dt>Typical floor height</dt>
                  <dd>{config.floorHeight.toFixed(1)} m</dd>
                </div>
                <div className="summary-row">
                  <dt>Derived total height</dt>
                  <dd>{totalHeightM.toFixed(1)} m</dd>
                </div>
              </dl>
              <p className="source-note">
                The image provides the horizontal footprint only. In production,
                vertical metadata comes from building records, sanctioned plans,
                LiDAR or photogrammetry. This prototype uses the known demo values
                above.
              </p>
            </section>
          </div>

          {/* RIGHT — what is being done to it, and what came out. */}
          <div className="source-card">
            <p className="source-eyebrow">Step 1 — source image</p>
            <h2 className="source-heading">AI-assisted footprint extraction demo</h2>
            <p className="source-lede">
              The 3D cadastre is generated from a building footprint. This stage
              derives that footprint from an image rather than reading an authored
              polygon — the seam a trained segmentation model would occupy. The
              extraction is deterministic image processing, not a trained model.
            </p>

            <dl className="summary-list source-metrics">
              <div className="summary-row">
                <dt>Ground sample</dt>
                <dd>
                  {(DEMO_AERIAL_GEOREFERENCE.groundSampleDistanceM * 100).toFixed(2)} cm/px
                </dd>
              </div>
              <div className="summary-row">
                <dt>Coverage</dt>
                <dd>
                  {coverageM.toFixed(0)} × {coverageM.toFixed(0)} m
                </dd>
              </div>
              <div className="summary-row">
                <dt>Method</dt>
                <dd>Colour threshold + component</dd>
              </div>
            </dl>

            <div className="source-actions">
              <button
                type="button"
                className="generate-button"
                onClick={runDetection}
                disabled={!imageReady || phase === 'working'}
              >
                {phase === 'working' ? 'Analysing…' : 'Detect Building Footprint'}
              </button>
            </div>

            {/* STATUS — one line, and it never says more than happened. */}
            {phase === 'idle' && (
              <p className="source-status" role="status">
                {imageReady
                  ? 'Source image loaded. No footprint detected yet.'
                  : 'Loading source image…'}
              </p>
            )}

            {phase === 'working' && (
              <p className="source-status" role="status">
                Thresholding roof pixels and tracing the largest connected region…
              </p>
            )}

            {phase === 'failed' && (
              <>
                <p className="source-status source-status-fail" role="status">
                  Detection unavailable — {failureReason}.
                </p>
                <p className="source-note">
                  The demonstration does not depend on this stage succeeding. The
                  deterministic footprint the project has used since Phase 8 can be
                  loaded instead; it will be labelled as fallback geometry
                  throughout.
                </p>
              </>
            )}

            {phase === 'detected' && result !== null && (
              <>
                <p className="source-status source-status-ok" role="status">
                  <span className="status-dot" aria-hidden="true" />
                  Building detected
                </p>

                <dl className="summary-list source-metrics">
                  <div className="summary-row">
                    <dt>Footprint area</dt>
                    <dd>{Math.round(result.areaSqM).toLocaleString('en-IN')} m&sup2;</dd>
                  </div>
                  <div className="summary-row">
                    <dt>Plan extent</dt>
                    <dd>
                      {result.widthM.toFixed(2)} × {result.depthM.toFixed(2)} m
                    </dd>
                  </div>
                  <div className="summary-row">
                    <dt>Ring</dt>
                    <dd>
                      {result.footprintOutlineM.length} vertices ·{' '}
                      {result.maskPixelCount.toLocaleString('en-IN')} px mask
                    </dd>
                  </div>
                  <div className="summary-row">
                    {/* Never the bare word "confidence". This is two things the
                        extractor measured, multiplied — not a model score. */}
                    <dt>Demo confidence</dt>
                    <dd>{(result.demoConfidence * 100).toFixed(0)}%</dd>
                  </div>
                </dl>

                <p className="source-note">
                  Illustrative prototype confidence — rectangularity × colour
                  agreement, both measured from this image. Not a model
                  probability; not survey-grade or legally authoritative.
                </p>
              </>
            )}


            {/* ADOPT — the footprint becomes the record. */}
            <div className="source-actions source-actions-end">
              {phase === 'detected' && result !== null ? (
                <button
                  type="button"
                  className="generate-button"
                  onClick={() => onAdopt(result)}
                >
                  Use this footprint →
                </button>
              ) : null}

              <button type="button" className="generate-reset" onClick={useFallback}>
                Load fallback demo footprint
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          {phase === 'detected'
            ? 'Footprint Extracted — Awaiting Adoption'
            : 'Source Image Loaded — Awaiting Footprint Extraction'}
        </p>
        <p className="hint">
          Prototype / non-authoritative · A production system would replace this
          stage with a trained building segmentation model over licensed imagery
        </p>
      </footer>
    </div>
  )
}

export default FootprintSourceStage
