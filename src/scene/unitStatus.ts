/**
 * The semantic status of one property unit — the project's colour hierarchy,
 * written down once.
 *
 * WHY THIS IS A MODULE AND NOT AN EXPRESSION IN THE RENDERER
 * By Subphase D there were four reasons a unit might be drawn differently, and
 * the rule for which one wins was a nested ternary inside a `.map()` — repeated,
 * in slightly different form, for the fill colour, the emissive, the emissive
 * intensity and the edge opacity. Four copies of one decision is four chances
 * for them to disagree, and the way they disagree is subtle: a unit whose fill
 * says "disputed" and whose edges say "selected".
 *
 * So the decision is made once, here, and the renderer asks.
 *
 * THE HIERARCHY, AND WHY IT IS THIS WAY ROUND
 *
 *     conflict   red        this property is disputed          highest
 *     selected   amber      this is the one being inspected
 *     hovered    faint glow this is the one under the cursor
 *     normal     slate      everything else                    lowest
 *
 * **Conflict outranks selection**, and that ordering is the substantive one. A
 * presenter clicking a red volume to read its record would otherwise turn the
 * evidence off in the act of examining it — the box would go amber and the
 * dispute would vanish from the picture at exactly the moment someone asked
 * about it. Selection stays legible through its *cage*, which is a different
 * channel: colour says what a property **is**, the outline says which one you
 * **picked**. Two meanings, two channels, no collision.
 *
 * **Hover ranks below selection** for the older reason: hover is transient
 * feedback about the pointer, selection is a decision the user made, and a
 * transient state must never be able to overwrite a deliberate one.
 *
 * WHAT DELIBERATELY HAS NO COLOUR: "VALID"
 * Every unit that is not in conflict is valid, which means colouring valid units
 * green would paint nineteen of twenty boxes green and leave the palette with no
 * way to say anything else. Worse, it would make "valid" the loudest thing on
 * screen when it is the *unremarkable* thing — the default state of a register
 * is that it is consistent.
 *
 * So validity is reported where it is actually a question being asked: on the
 * status bar, which states the standing condition of the whole record, and in
 * the property inspector for the one unit a user has selected. In the 3D scene,
 * valid is simply the absence of red. That is a deliberate restraint and it is
 * the reason the conflict colour reads as loudly as it does.
 *
 * No React, no Three.js.
 */

/** How a unit should be drawn, in priority order. */
export type UnitStatus = 'conflict' | 'selected' | 'hovered' | 'normal'

/** Everything the decision depends on. */
export interface UnitStatusInput {
  /** Ids the validation engine has flagged. A set, so the test is O(1). */
  readonly conflictedUnitIds: ReadonlySet<string>
  /** The selected unit's id, or `null`. */
  readonly selectedUnitId: string | null
  /** The hovered unit's id, or `null`. */
  readonly hoveredUnitId: string | null
  /**
   * Whether this unit can be interacted with at all.
   *
   * False during the generation animation, and false for a ghosted floor while
   * another is isolated. A unit that cannot be clicked must not show hover
   * feedback, because the feedback would be promising something that will not
   * happen. It can still show conflict and selection: both are statements about
   * the record rather than invitations to click.
   */
  readonly isTargetable: boolean
}

/**
 * Decide how one unit should be drawn.
 *
 * Total, pure, and the only place the priority ordering exists.
 */
export function getUnitStatus(unitId: string, input: UnitStatusInput): UnitStatus {
  if (input.conflictedUnitIds.has(unitId)) return 'conflict'
  if (unitId === input.selectedUnitId) return 'selected'
  if (input.isTargetable && unitId === input.hoveredUnitId) return 'hovered'
  return 'normal'
}

/**
 * Whether a unit should still be marked as selected *in addition* to its status.
 *
 * The companion to the rule above. A disputed unit that the user has selected
 * reads as `conflict` — red — but must still show its selection cage, or the
 * inspector would be describing a property with nothing on screen to say which
 * one it is. This is the function that says "draw the cage", separate from the
 * one that says "use this colour", because they answer different questions.
 */
export function shouldShowSelectionCage(
  unitId: string,
  selectedUnitId: string | null,
): boolean {
  return unitId === selectedUnitId
}
