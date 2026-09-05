/**
 * The scene's semantic colours — the ones that carry **meaning** rather than
 * material.
 *
 * WHY THIS FILE EXISTS, AND WHAT IT DELIBERATELY DOES NOT CONTAIN
 * Until Phase 11 there was one component drawing property volumes, so the
 * colours for "selected" and "in conflict" lived beside it and that was the right
 * place for them. There are two now — `Building.tsx` above ground and
 * `Basement.tsx` below it — and a second copy of `SELECTED_COLOR` would be a
 * second answer to the question *what does amber mean*. The first time the two
 * drifted, a selected apartment and a selected parking bay would be different
 * shades of the same idea, which is exactly the kind of small incoherence that
 * makes an interface feel unconsidered.
 *
 * So the colours that mean something are here, once. The colours that merely
 * *are* something stay with the thing they describe: the slate blues of the
 * apartments are in `Building.tsx`, the warmer greys of the basement are in
 * `Basement.tsx`, the slab grey is in `FloorSlabs.tsx`. A resting colour is a
 * property of one kind of object; a state colour is a property of the whole
 * language.
 *
 * THE LANGUAGE, IN FULL
 *
 *     conflict   saturated red    two records claim this volume     highest
 *     selected   amber            this is the one being inspected
 *     hovered    faint cool glow  this is the one under the cursor
 *     resting    per-tier         everything else                   lowest
 *     datum      neutral          the ground surface, y = 0          reference
 *
 * The ordering is decided in `unitStatus.ts`; this file holds what each decision
 * resolves to. Adding a tier did not add a colour, and that is the restraint the
 * phase was asked for: the basement is a **subdued variation of the resting
 * palette**, not a new hue. Underground is not purple. It is the same building,
 * lower down, and it is drawn as such — the only reason to spend a hue on it
 * would be to make it *exciting*, and this is a register.
 *
 * No React, no Three.js — plain strings and numbers, so a self-check can assert
 * that two components resolve the same state to the same colour.
 */

/* ── Selection: amber ─────────────────────────────────────────────────────── */

/**
 * A warm amber against the cold slate of everything else.
 *
 * Chosen for the reason surveying and CAD tools tend to choose it: it is the one
 * hue that is unmistakably *not* part of a neutral building palette, so a single
 * amber box in a field of slate reads instantly without turning the model into a
 * colour chart. One colour, one meaning: selected.
 */
export const SELECTED_COLOR = '#d99b3f'
/** A gentle self-lit component, so a selected volume still reads in shadow. */
export const SELECTED_EMISSIVE = '#6b4310'
export const SELECTED_EMISSIVE_INTENSITY = 0.6
/** Wireframe cage drawn around the selected volume's true bounds. */
export const SELECTION_OUTLINE_COLOR = '#f7d79b'
/** The selected volume's edges are the ordinary edge line, turned up. */
export const SELECTED_EDGE_OPACITY = 0.75

/* ── Hover: a lift, not a hue ─────────────────────────────────────────────── */

/**
 * The resting colour, lifted by a faint cool glow.
 *
 * Deliberately weaker than selection and in a different *kind* of channel —
 * hover brightens, selection changes hue and adds an outline. Hovering a volume
 * while another is selected can never make the hovered one look selected.
 */
export const HOVER_EMISSIVE = '#22384d'
export const HOVER_EMISSIVE_INTENSITY = 0.5

/** No emissive contribution at rest. */
export const IDLE_EMISSIVE = '#000000'

/* ── Conflict: red, and it outranks everything ────────────────────────────── */

/**
 * Saturated signal red — **not** neon.
 *
 * A colour that could not occur in a building reads as a rendering artefact
 * rather than as a finding. The ordering that puts this above selection lives in
 * `unitStatus.ts`, with the argument for it.
 */
export const CONFLICT_COLOR = '#c0453d'
export const CONFLICT_EMISSIVE = '#5c1512'
export const CONFLICT_EMISSIVE_INTENSITY = 0.75
/** A disputed volume's edges are brighter still, and red. */
export const CONFLICT_EDGE_COLOR = '#ff9b93'
export const CONFLICT_EDGE_OPACITY = 0.9

/* ── The quiet edge on every volume ───────────────────────────────────────── */

/** Present, never loud. Crisp property boundaries are the drawing's subject. */
export const UNIT_EDGE_COLOR = '#93a9bd'
export const UNIT_EDGE_OPACITY = 0.24

/* ── The ground datum: a reference, not a subject ─────────────────────────── */

/**
 * The colour of the `y = 0` reference plane and its outline.
 *
 * Neutral, and quieter than anything it separates. The datum's job is to be
 * *locatable* — to let a viewer say "that is the ground, so this is above it and
 * that is below it" — and a datum that competed with the properties for attention
 * would be a grid line pretending to be a finding. It is the one element in the
 * scene whose success is measured by how little it is noticed.
 */
export const DATUM_COLOR = '#7d8f9e'
/** The datum line, at rest. Barely there. */
export const DATUM_OPACITY = 0.34
/** And while the underground view is on, where it becomes the key reference. */
export const DATUM_OPACITY_EMPHASISED = 0.85
