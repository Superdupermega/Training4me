/**
 * `propose_change` — the one tool the coach may call, and the first half of
 * this chunk's trust boundary (`docs/11-COACH-PLATFORM.md §4`): "the
 * boundary is `src/core/coach/tools.ts` and `applyProposal.ts`, not the
 * prompt." A zod schema is both the runtime validator *and*, via zod v4's
 * own `z.toJSONSchema`, the JSON schema handed to the Anthropic SDK's
 * `tools` parameter — one definition, not a hand-written duplicate kept in
 * sync by hand. `@anthropic-ai/sdk` (pinned in chunk 25) has no zod-to-tool
 * helper of its own to check for (confirmed by reading its shipped `.d.ts`
 * files directly, not assumed), so this is the real answer to this file's
 * own "check whether the SDK can derive a tool schema from zod directly"
 * instruction: it can't, but zod itself can generate the JSON Schema half,
 * which is the stronger of the two options this file's own brief offered.
 *
 * Pure — no fetch, no Anthropic SDK (not even its types: `AnthropicTool`
 * below is a small local shape, not `Anthropic.Tool`, because `src/core`
 * "no Anthropic SDK" is `docs/11-COACH-PLATFORM.md §4`'s own rule, not just
 * an ESLint one). `applyProposal.ts` imports `ProposedChange` from here and
 * never redefines it; so does `src/server/coach/actions.ts`.
 */

import { z } from 'zod';

const swapExerciseSchema = z.object({
  action: z.literal('swap_exercise'),
  sessionId: z.string().uuid()
    .describe('The t4m_session row this change targets.'),
  blockLetter: z.string().min(1).max(2)
    .describe("The session block's letter, e.g. 'D'."),
  slot: z.string().min(1).max(4)
    .describe("The exercise's slot within that block, e.g. 'D1'."),
  toExerciseId: z.string().min(1)
    .describe('The library id of the exercise to swap in, e.g. "walking-lunge".'),
  reason: z.string().min(1).max(500)
    .describe('One short sentence explaining why this swap is being proposed.'),
}).strict();

const adjustSetsSchema = z.object({
  action: z.literal('adjust_sets'),
  sessionId: z.string().uuid()
    .describe('The t4m_session row this change targets.'),
  blockLetter: z.string().min(1).max(2)
    .describe("The session block's letter, e.g. 'D'."),
  slot: z.string().min(1).max(4)
    .describe("The exercise's slot within that block, e.g. 'D1'."),
  // Absolute count, not a delta — "make this exercise 4 sets", not "+1
  // set" — one unambiguous number for both the model to produce and the
  // proposal card to show as a plain "3 -> 4" diff (`DECISIONS.md`).
  // Never valid against a `main` block — `applyProposal` refuses that
  // outright regardless of the number given (`01-METHODOLOGY.md §1.3`'s
  // "never trim T1", applied to the coach too).
  sets: z.number().int().min(1).max(8)
    .describe('The new absolute number of sets for this exercise (never for a main/T1 block).'),
}).strict();

const adjustLoadSchema = z.object({
  action: z.literal('adjust_load'),
  sessionId: z.string().uuid()
    .describe('The t4m_session row this change targets.'),
  blockLetter: z.string().min(1).max(2)
    .describe("The session block's letter, e.g. 'B'."),
  slot: z.string().min(1).max(4)
    .describe("The exercise's slot within that block, e.g. 'B'."),
  setNumber: z.number().int().min(1).max(20)
    .describe("The prescribed set's number within that exercise (1-indexed, ramp sets included where present)."),
  percentTm: z.number().min(0).max(1).optional()
    .describe('New target as a fraction of training max, e.g. 0.8 for 80%. Omit if only changing RPE.'),
  rpe: z.number().min(0).max(10).optional()
    .describe('New target RPE. Omit if only changing the percent-of-training-max target.'),
}).strict()
  .refine((v) => v.percentTm != null || v.rpe != null, {
    message: 'adjust_load must set percentTm and/or rpe.',
    path: ['percentTm'],
  });

/**
 * The discriminated union in `docs/11-COACH-PLATFORM.md §5`, verbatim.
 * Anything that doesn't fit — an extra field, a wrong type, an `action`
 * outside these three — fails `.safeParse`, which is what makes a proposal
 * fail *closed*: a reply whose tool call doesn't parse is stored as a plain
 * chat message with no proposal at all (`src/server/coach/actions.ts`), not
 * a broken proposal card.
 */
export const proposedChangeSchema = z.discriminatedUnion('action', [
  swapExerciseSchema,
  adjustSetsSchema,
  adjustLoadSchema,
]);

export type ProposedChange = z.infer<typeof proposedChangeSchema>;
export type SwapExerciseChange = z.infer<typeof swapExerciseSchema>;
export type AdjustSetsChange = z.infer<typeof adjustSetsSchema>;
export type AdjustLoadChange = z.infer<typeof adjustLoadSchema>;

/**
 * The minimal shape `coachCompletion`'s own `tools?: Anthropic.Tool[]`
 * parameter needs (`src/server/coach/anthropic.ts`) — structurally
 * compatible with the real `Anthropic.Tool` (a required `type: 'object'`
 * `input_schema` plus a `name`/`description`), without importing the SDK
 * itself into `src/core` to get that type.
 */
export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; [key: string]: unknown };
}

// z.toJSONSchema on a discriminated union produces `{ oneOf: [...] }` with
// no top-level `type` (the type varies per branch — except it doesn't here,
// every branch is `type: 'object'`). Anthropic's own `InputSchema` requires
// a top-level `type: 'object'`; JSON Schema allows `type` and `oneOf` as
// sibling keywords with AND semantics, so wrapping the generated `oneOf`
// under an explicit `type: 'object'` is valid and keeps this file's only
// schema definition the zod one above.
const { oneOf } = z.toJSONSchema(proposedChangeSchema, { target: 'draft-7' }) as { oneOf: unknown[] };

export const PROPOSE_CHANGE_TOOL: AnthropicToolDefinition = {
  name: 'propose_change',
  description: `Propose one concrete change to a single, not-yet-started ('planned') session
in the athlete's current training block. This does not change anything by
itself — the athlete sees it as a card with Apply/Dismiss buttons and must
apply it explicitly.

Three kinds of change, pick exactly one:
- swap_exercise: replace one exercise in one slot with another, keeping its
  existing sets/reps/rest exactly as prescribed.
- adjust_sets: change how many sets one exercise has. Never valid for a
  main/T1 block (the exercise the whole session is built around) — the app
  never trims that, including when you suggest it.
- adjust_load: retarget one specific prescribed set's percent-of-training-max
  and/or RPE. Every tier has its own honest ceiling (a T1 main-lift set never
  goes past 88% training max or RPE 8.5); a proposal past that ceiling is
  refused, not capped.

Only ever propose a change for a session whose status is 'planned' — not one
already started, finished, or skipped.`,
  input_schema: { type: 'object', oneOf },
};
