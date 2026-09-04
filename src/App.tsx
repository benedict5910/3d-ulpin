import { useMemo, useState } from 'react'

import SceneViewer from './scene/SceneViewer'
import BuildingSummary from './ui/BuildingSummary'
import PropertyInspector from './ui/PropertyInspector'
import { DEFAULT_BUILDING_CONFIG } from './scene/buildingConfig'
import { buildApartmentUnits, findUnitById } from './scene/unitLayout'
import { runPrototypeUlpinSelfCheck } from './ulpin/ulpinSelfCheck'

/**
 * The application shell — and, as of Phase 5, the owner of two things the whole
 * app agrees on: the generated property units, and which one is selected.
 *
 * Both live here for the same reason: this is the nearest component that
 * contains *every* reader. The 3D scene and the inspector panel are siblings,
 * so nothing lower than `App` can serve both, and nothing higher would add
 * anything but distance.
 *
 *   DEFAULT_BUILDING_CONFIG
 *          ↓ buildApartmentUnits()
 *        units  ──────────────► SceneViewer ──► Building ──► one mesh per unit
 *          │                                                        │ click
 *          │                                                        ↓
 *          │                                          onSelectUnit(unitId)
 *          │                                                        ↓
 *          │                                          selectedUnitId (state)
 *          │                                                        ↓
 *          └──────────── findUnitById ──► selectedUnit ──► PropertyInspector
 *
 * Note that the arrow into the inspector starts at the *same* `units` array the
 * meshes were built from. The panel is not given a description of the selected
 * unit; it is given the unit.
 */

function App() {
  const config = DEFAULT_BUILDING_CONFIG

  /**
   * The twenty property units, generated once.
   *
   * `useMemo` over the config, which is a module constant, so in practice this
   * runs exactly once for the life of the page. Generating the array here
   * rather than inside each consumer is what makes "one source of truth"
   * literal rather than merely likely: the scene and the panels hold the same
   * objects, not equal copies.
   */
  const units = useMemo(() => {
    const generated = buildApartmentUnits(config)

    // Development-only. `import.meta.env.DEV` is a compile-time constant, so
    // this whole branch is removed from the production bundle. It checks the
    // identifiers that were *actually attached to these units*, not a freshly
    // generated look-alike set — the point is to catch a wiring mistake in the
    // model layer, which a self-contained check would sail straight past.
    if (import.meta.env.DEV) {
      runPrototypeUlpinSelfCheck(generated.map((unit) => unit.prototypeUlpin))
    }

    return generated
  }, [config])

  /**
   * Which unit is selected — stored as an **id**, not as the unit object.
   *
   * A string is a stable, comparable primitive: React can tell "unchanged" from
   * "changed" without a deep compare, and `unit.id === selectedUnitId` inside
   * the render loop is a cheap test that each of the twenty meshes can make for
   * itself. Storing the object would mean the app held a second reference to a
   * unit that also lives in `units`, and if the config ever changed, that
   * reference would keep pointing at a unit the scene no longer draws — a
   * selection of something invisible. An id cannot go stale in that way: it
   * either still resolves, or resolves to `null` and the panel returns to its
   * empty state. The id is the *question*; `units` remains the only place with
   * the answer.
   */
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)

  /** Resolve the id back to the one generated record it names. */
  const selectedUnit = useMemo(
    () => findUnitById(units, selectedUnitId),
    [units, selectedUnitId],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="title">3D ULPIN</h1>
        <p className="subtitle">Vertical Property &amp; Spatial Cadastre Platform</p>
      </header>

      <main className="viewer">
        <SceneViewer
          units={units}
          selectedUnitId={selectedUnitId}
          onSelectUnit={setSelectedUnitId}
        />
        {/* HTML overlays, not 3D — they sit above the canvas, not inside it. */}
        <BuildingSummary config={config} units={units} />
        <PropertyInspector unit={selectedUnit} />
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          Vertical Property Units Active
        </p>
        <p className="hint">
          Click a unit to inspect &middot; Drag to orbit &middot; Scroll to zoom
          &middot; Right-drag to pan
        </p>
      </footer>
    </div>
  )
}

export default App
