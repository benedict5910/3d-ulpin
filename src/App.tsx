import SceneViewer from './scene/SceneViewer'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">3D ULPIN</h1>
        <p className="subtitle">Vertical Property &amp; Spatial Cadastre Platform</p>
      </header>

      <main className="viewer">
        <SceneViewer />
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          Prototype Environment Ready
        </p>
        <p className="hint">Drag to orbit · Scroll to zoom · Right-drag to pan</p>
      </footer>
    </div>
  )
}

export default App
