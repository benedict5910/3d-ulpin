import { useMemo, useState } from 'react'

import SceneViewer from './scene/SceneViewer'
import GISMap from './map/GISMap'
import ParcelInfoPanel from './map/ParcelInfoPanel'
import BuildingSummary from './ui/BuildingSummary'
import PropertyInspector from './ui/PropertyInspector'
import { DEMO_PARCEL } from './data/demoParcel'
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
 *
 * Phase 7 adds a second, parallel flow beside it — the horizontal one:
 *
 *   DEMO_PARCEL_IDENTITY ──┬─► buildApartmentUnits ──► unit.parentParcelId
 *                          │                            (property inspector)
 *                          └─► DEMO_PARCEL ──► GISMap + ParcelInfoPanel
 *
 * Both branches start at the *same* constant. That is the point of the phase:
 * the parcel drawn on the 2D map and the parcel named on every unit's record
 * are one parcel by construction, not two constants that happen to match.
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

      {/* Three columns, left to right: where the property is on the ground,
          what it looks like in space, and what the record says about the
          selected unit. Each is a real grid column now — before Phase 7 the
          two panels floated over the canvas, which worked while the 3D scene
          was the only content and stops working the moment a second view
          needs room of its own. */}
      <main className="viewer">
        <section className="map-panel" aria-label="Cadastral parcel map">
          <GISMap parcel={DEMO_PARCEL} />
          <ParcelInfoPanel parcel={DEMO_PARCEL} />
        </section>

        <section className="scene-panel">
          <SceneViewer
            units={units}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
          />
          {/* Still an overlay, and still deliberately so: the summary
              describes the scene it sits on. `.scene-panel` is now its
              positioning context instead of `.viewer`. */}
          <BuildingSummary config={config} units={units} />
        </section>

        <section className="inspector-panel">
          <PropertyInspector unit={selectedUnit} />
        </section>
      </main>

      <footer className="app-footer">
        <p className="status">
          <span className="status-dot" aria-hidden="true" />
          Vertical Property Units Active
        </p>
        <p className="hint">
          Click a unit to inspect &middot; Drag to orbit &middot; Scroll to zoom
          &middot; Right-drag to pan &middot; Basemap &copy; OpenStreetMap
          contributors
        </p>
      </footer>
    </div>
  )
}

export default App
