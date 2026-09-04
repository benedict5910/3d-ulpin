import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Leaflet ships its own stylesheet, and it is not optional: without it the tile
// images are unpositioned (the map degenerates into a vertical stack of square
// pictures) and the zoom and attribution controls render as unstyled text. It
// is imported here, at the entry point, rather than inside the map component,
// for two reasons — it is a global stylesheet with global effects, and
// importing it *before* `./index.css` guarantees our own rules win any
// specificity tie, which is what lets the dark-theme overrides in `index.css`
// restyle Leaflet's controls rather than fight them.
import 'leaflet/dist/leaflet.css'

import App from './App'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
