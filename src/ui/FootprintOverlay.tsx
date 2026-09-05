import type { PixelPoint } from '../extraction/footprintExtraction'

/**
 * The detected footprint, drawn over the source image.
 *
 * WHY SVG AND NOT A CANVAS
 * The polygon is four points that never animate. An SVG with the image's own
 * pixel dimensions as its `viewBox` draws them in **the extractor's coordinate
 * system**, which means there is no mapping step between the numbers and the
 * picture — and therefore no second place where the two could disagree. It also
 * scales with the element for free, so the same markup serves the full-size
 * stage and the thumbnail in the workspace's provenance card.
 *
 * WHY IT LOOKS LIKE THIS
 * One thin stroke, a very light fill, four small corner marks, and nothing else.
 * The claim being made is "the polygon lands on the building", which a restrained
 * outline makes better than a saturated overlay would: a neon computer-vision
 * screenshot invites the audience to judge the graphics rather than the
 * geometry. `vectorEffect="non-scaling-stroke"` keeps the outline the same
 * visual weight at both sizes it is used at.
 */

interface FootprintOverlayProps {
  /** The detected ring, in source-image pixels. Empty draws nothing. */
  polygon: readonly PixelPoint[]
  /** The source image's natural size, which is the overlay's coordinate space. */
  widthPx: number
  heightPx: number
  /** Corner marks are useful at full size and noise on a thumbnail. */
  showCorners?: boolean
  className?: string
}

function FootprintOverlay({
  polygon,
  widthPx,
  heightPx,
  showCorners = true,
  className,
}: FootprintOverlayProps) {
  if (polygon.length < 3) return null

  const points = polygon.map((point) => `${point.x},${point.y}`).join(' ')
  // Sized against the image's smaller dimension so the marks stay proportionate
  // whatever raster is supplied, rather than being tuned to this one.
  const cornerPx = Math.max(4, Math.round(Math.min(widthPx, heightPx) * 0.009))

  return (
    <svg
      className={className}
      viewBox={`0 0 ${widthPx} ${heightPx}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon
        points={points}
        fill="rgba(74, 222, 128, 0.13)"
        stroke="rgba(74, 222, 128, 0.92)"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showCorners
        ? polygon.map((point) => (
            <rect
              key={`${point.x}-${point.y}`}
              x={point.x - cornerPx}
              y={point.y - cornerPx}
              width={cornerPx * 2}
              height={cornerPx * 2}
              fill="rgba(232, 238, 245, 0.94)"
            />
          ))
        : null}
    </svg>
  )
}

export default FootprintOverlay
