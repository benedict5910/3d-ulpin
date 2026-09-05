import {
  DEMO_AERIAL_GEOREFERENCE,
  DEMO_AERIAL_IMAGE_URL,
} from '../extraction/demoImageSource'
import type { ExtractedFootprint } from '../extraction/footprintExtraction'
import FootprintOverlay from './FootprintOverlay'

/**
 * Where this parcel's horizontal geometry came from.
 *
 * WHY THE PROVENANCE TRAVELS WITH THE MODEL
 * Once the workspace is open, the footprint is just *the footprint* — the map
 * draws it, the generator extrudes it, the validator checks against it. That is
 * the right architecture and it has one cost: the record stops saying where it
 * came from. In a cadastral system that is precisely the fact a reviewer needs,
 * because a boundary derived from an image and a boundary derived from a signed
 * survey plan carry entirely different weight.
 *
 * So the provenance is a small card in the source column rather than a message
 * that appeared once on the previous screen. It reads from `extraction.provenance`
 * — the same object the extractor stamped — so it cannot describe geometry the
 * application is not actually using, and it says `Prototype / non-authoritative`
 * on every path including the fallback.
 *
 * WHY IT IS DELIBERATELY SMALL
 * Four rows and a disclosure. This is a footnote on the record, not a second
 * account of the detection stage: the image, the overlay and the measurements
 * are behind the `details`, where a presenter can open them to show the chain
 * and where they cost nothing the rest of the time.
 */

interface FootprintSourcePanelProps {
  /** The extraction the whole workspace was built from. */
  extraction: ExtractedFootprint
  /** Return to the source stage and start from an image again. */
  onNewSource: () => void
}

function FootprintSourcePanel({ extraction, onNewSource }: FootprintSourcePanelProps) {
  const { provenance } = extraction
  const detected = !provenance.isFallback

  return (
    <section className="source-panel" aria-label="Footprint provenance">
      <h2 className="summary-title">Footprint source</h2>

      <dl className="summary-list">
        <div className="summary-row">
          <dt>Method</dt>
          <dd className="source-panel-method">{provenance.method}</dd>
        </div>
        <div className="summary-row">
          <dt>Input</dt>
          <dd className="source-panel-input">{provenance.input}</dd>
        </div>
        <div className="summary-row">
          <dt>Status</dt>
          <dd
            className={
              detected ? 'source-panel-status' : 'source-panel-status source-panel-status-fallback'
            }
          >
            {provenance.status}
          </dd>
        </div>
        {/* No confidence row on the fallback path: nothing was measured, so
            there is no figure to quote. See `fallbackFootprint`. */}
        {detected && (
          <div className="summary-row">
            <dt>Demo confidence</dt>
            <dd>{(extraction.demoConfidence * 100).toFixed(0)}%</dd>
          </div>
        )}
      </dl>

      <details className="summary-details source-panel-details">
        <summary className="summary-details-toggle">
          {detected ? 'Source image' : 'About the fallback'}
        </summary>
        <div className="summary-details-body">
          {detected ? (
            <>
              <div className="source-thumb">
                <img
                  className="source-thumb-image"
                  src={DEMO_AERIAL_IMAGE_URL}
                  alt="The source aerial scene with the detected building footprint outlined."
                />
                <FootprintOverlay
                  className="source-overlay"
                  polygon={extraction.pixelPolygon}
                  widthPx={DEMO_AERIAL_GEOREFERENCE.widthPx}
                  heightPx={DEMO_AERIAL_GEOREFERENCE.heightPx}
                  showCorners={false}
                />
              </div>
              <dl className="summary-list">
                <div className="summary-row">
                  <dt>Extent</dt>
                  <dd>
                    {extraction.widthM.toFixed(2)} × {extraction.depthM.toFixed(2)} m
                  </dd>
                </div>
                <div className="summary-row">
                  <dt>Mask</dt>
                  <dd>{extraction.maskPixelCount.toLocaleString('en-IN')} px</dd>
                </div>
              </dl>
              <p className="summary-note">
                Deterministic image-processing demo, not a trained model and not
                survey-grade. A production system would use a trained building
                segmentation model over licensed imagery, with height from
                building records, LiDAR or photogrammetry.
              </p>
            </>
          ) : (
            <p className="summary-note">
              The image extraction stage did not run, so the project’s authored
              demo footprint ring is in use instead. The geometry is the same
              18 × 14 m plan; only its provenance differs.
            </p>
          )}

          <button type="button" className="generate-reset" onClick={onNewSource}>
            Start from source image
          </button>
        </div>
      </details>
    </section>
  )
}

export default FootprintSourcePanel
