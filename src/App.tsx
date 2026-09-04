import SceneViewer from './scene/SceneViewer'
import BuildingSummary from './ui/BuildingSummary'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">3D ULPIN</h1>
        <p className="subtitle">Vertical Property &amp; Spatial Cadastre Platform</p>
      </header>

      <main className="viewer">
        <SceneViewer />
        {/* HTML overlay, not 3D — it sits above the canvas, not inside it. */}
        <BuildingSummary />
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          Procedural Floors Active
        </p>
        <p className="hint">Drag to orbit · Scroll to zoom · Right-drag to pan</p>
      </footer>
    </div>
  )
}

export default App
