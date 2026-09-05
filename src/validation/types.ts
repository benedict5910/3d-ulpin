/**
 * The validation result model.
 *
 * WHY THIS IS A TYPE FILE AND NOT A LIST OF STRINGS
 * A validator that returns `"3 units overlap"` has thrown away everything that
 * makes the result usable: which units, by how much, which rule, and whether the
 * caller should paint something red or merely note it. The interface can then
 * only print the sentence — it cannot highlight the offending volumes, cannot
 * sort by severity, and cannot tell a warning from a failure without parsing
 * English.
 *
 * So every check returns a **structured** `ValidationResult` carrying its
 * category, its status, the units it implicates, and a `details` record of the
 * actual figures. The status bar reads the statuses, the 3D scene reads
 * `affectedUnitIds` to colour the conflicting volumes, and the details panel
 * reads `details`. Three consumers, one record, no string parsing anywhere.
 *
 * No React, no Three.js, no imports at all.
 */

/**
 * Which rule produced a result.
 *
 * A closed union rather than a free string, so the compiler finds every consumer
 * when a rule is added — and so a typo cannot invent a category that no view
 * knows how to render.
 */
export type ValidationCategory =
  /** Is the building footprint inside its parent parcel? */
  | 'parcel-containment'
  /** Is every property volume inside the building, horizontally and vertically? */
  | 'unit-containment'
  /** Are the floors ordered, non-overlapping and above ground? */
  | 'floor-hierarchy'
  /** Is every prototype 3D ULPIN unique? */
  | 'identifier-uniqueness'
  /** Do any two ownership volumes intersect? */
  | 'ownership-overlap'
  /** Does the generated structure match what the configuration asks for? */
  | 'structure-count'

/**
 * How a single check came out.
 *
 * Three states, not two. `warning` exists because some findings are genuinely
 * "this is unusual, look at it" rather than "this record is impossible" — a
 * reversed ring winding, for instance, produces correct areas and is still a
 * sign that something upstream is confused. Collapsing warnings into failures
 * would make the overall status useless (everything fails); collapsing them into
 * passes would hide them.
 */
export type ValidationStatus = 'pass' | 'warning' | 'fail'

/** One check's outcome. */
export interface ValidationResult {
  /** Stable identifier for this specific check, e.g. `ownership-overlap`. */
  readonly id: string
  /** Which rule it belongs to. */
  readonly category: ValidationCategory
  /** How it came out. */
  readonly status: ValidationStatus
  /** One sentence, written for a human reading a details panel. */
  readonly message: string
  /**
   * Two or three words for the compact status bar, e.g. `Parcel valid`,
   * `20 unique IDs`, `1 conflict`.
   *
   * Supplied by the **rule**, not by the view. The rule already holds the
   * figures, so having it write the short form too means the status bar formats
   * nothing and cannot disagree with the sentence beside it — and a chip can
   * never say "20 units" while its own details say nineteen.
   */
  readonly chip: string
  /**
   * The property units this result implicates.
   *
   * Empty for a passing check and for checks that are not about units. **This is
   * what lets the 3D scene paint a conflict**: the renderer looks up each id and
   * colours that volume, so the finding and the geometry it is about are tied
   * together by data rather than by a second hard-coded list.
   */
  readonly affectedUnitIds: readonly string[]
  /**
   * The figures behind the message.
   *
   * A record rather than prose, so the details panel can lay them out as a table
   * and so a future export can serialise them. Values are pre-formatted strings
   * or numbers — whichever the check naturally produces.
   */
  readonly details: Readonly<Record<string, string | number>>
}

/**
 * The overall verdict for a whole model.
 *
 * Deliberately *not* the same union as `ValidationStatus`. A single check
 * passes, warns or fails; a whole cadastral record is **valid**, has
 * **warnings**, or contains a **conflict** — and "conflict" is the word a
 * cadastral audience uses for the thing that matters, which is two people
 * holding the same volume. Using the check-level words at the model level would
 * make the headline read "FAIL", which says something went wrong with the
 * software rather than something is wrong with the record.
 */
export type TopologyStatus = 'valid' | 'warning' | 'conflict'

/** Everything the engine concluded about one model. */
export interface TopologyReport {
  /** The headline. */
  readonly status: TopologyStatus
  /** Every check that ran, in the order they ran. */
  readonly results: readonly ValidationResult[]
  /** How many checks passed. */
  readonly passCount: number
  /** How many warned. */
  readonly warningCount: number
  /** How many failed. */
  readonly failCount: number
  /**
   * The worst result in each category, in rule order — the status bar's input.
   *
   * One chip per category rather than one per check: `parcel-containment` runs
   * two tests and a bar with two parcel chips would spend its width on the
   * distinction between "the ring is simple" and "the ring is inside the plot",
   * which is a details-panel distinction. Worst-wins, so a failing sub-check can
   * never be hidden behind a passing sibling.
   */
  readonly chips: readonly ValidationResult[]
  /**
   * Every unit implicated by any failing check, de-duplicated.
   *
   * The renderer's single input for conflict colouring. Derived here rather than
   * in the view so that "which units are in conflict" has exactly one answer.
   */
  readonly conflictedUnitIds: readonly string[]
}

/** Roll a set of results up into a report. */
export function summariseResults(
  results: readonly ValidationResult[],
): TopologyReport {
  let passCount = 0
  let warningCount = 0
  let failCount = 0

  const conflicted = new Set<string>()
  /** Worst result seen per category, preserving first-seen order. */
  const worstByCategory = new Map<string, ValidationResult>()
  const rank: Record<ValidationStatus, number> = { pass: 0, warning: 1, fail: 2 }

  for (const result of results) {
    const incumbent = worstByCategory.get(result.category)
    if (incumbent === undefined || rank[result.status] > rank[incumbent.status]) {
      worstByCategory.set(result.category, result)
    }
  }

  for (const result of results) {
    if (result.status === 'pass') passCount++
    else if (result.status === 'warning') warningCount++
    else {
      failCount++
      for (const unitId of result.affectedUnitIds) conflicted.add(unitId)
    }
  }

  return {
    // Worst wins. A model with one conflict and nineteen passes is a model with
    // a conflict; averaging or counting would let a real problem be outvoted.
    status: failCount > 0 ? 'conflict' : warningCount > 0 ? 'warning' : 'valid',
    results,
    passCount,
    warningCount,
    failCount,
    chips: [...worstByCategory.values()],
    conflictedUnitIds: [...conflicted],
  }
}
