import type { BalanceViolation } from '@/core/generator/balance';

/**
 * Human copy for each balance-check code (`src/core/generator/balance.ts`),
 * shown alongside the raw advisory in the builder — what the ratio/count is
 * actually protecting against, and one concrete thing to try. Advisory only:
 * this never blocks a save, it just explains what the number in the Alert
 * means and how to move it. A code with no entry here still shows its raw
 * message on its own — this dictionary only ever adds detail, never gates.
 */
export interface AdvisoryCopy {
  /** Why this check exists — what actually goes wrong if it's left as-is. */
  why: string;
  /** One concrete move to bring it back in range, given the specific violation. */
  suggest: (v: BalanceViolation) => string;
}

export const ADVISORY_COPY: Record<string, AdvisoryCopy> = {
  B1: {
    why: 'Pulling volume should roughly match, or slightly outweigh, pressing volume — otherwise the shoulders round forward over time. The target band is 1.00–1.45 pulling sets for every pressing set.',
    suggest: (v) => (v.value != null && v.value < 1
      ? 'Add a row or pulldown (or trim a pressing set) — pulling is behind pressing right now.'
      : 'Add a push exercise (or trim a pulling set) — pulling has run well ahead of pressing.'),
  },
  B2: {
    why: 'Hinge work (hamstrings/glutes — deadlifts, RDLs) and squat work (quads) should stay close to even, or the back of the legs falls behind the front. The target band is 0.75–1.30 hinge sets for every squat set.',
    suggest: (v) => (v.value != null && v.value < 0.75
      ? 'Add a hinge movement — RDL, hip thrust, back extension — squat volume is well ahead of hinge.'
      : 'Add a squat movement (or trim a hinge set) — hinge volume has run ahead of squat.'),
  },
  B3: {
    why: 'Single-leg work (lunges, split squats, step-ups) exposes side-to-side strength gaps a bilateral squat or hinge can hide, and builds stability nothing bilateral asks for.',
    suggest: () => 'Add a lunge, split squat, step-up, or single-leg RDL somewhere in the week.',
  },
  B4: {
    why: 'Same idea for the upper body — a single-arm row, press, or carry exposes imbalances a barbell movement lets slide.',
    suggest: () => 'Add a single-arm dumbbell row, press, or a suitcase/offset carry.',
  },
  B5: {
    why: "Carries build grip and trunk bracing under load in a way no isolated lift reaches — that's why the generator always schedules one, even in a light week.",
    suggest: () => 'Add a farmer, suitcase, front-rack, or mixed carry — even a single set at the end of a session covers it.',
  },
  B6a: {
    why: 'Vertical pulling (pull-ups, chin-ups, lat pulldowns) trains the lats through a range horizontal rows never reach.',
    suggest: () => 'Add a pull-up, chin-up, or lat-pulldown variation.',
  },
  B6b: {
    why: 'Vertical pressing (overhead press) is the counterpart horizontal bench/push work never covers.',
    suggest: () => 'Add an overhead press or landmine press variation.',
  },
  B7: {
    why: "The same heavy pattern trained twice inside 48 hours doesn't leave enough time to recover before it's asked to work hard again.",
    suggest: () => 'Move one of the two sessions further apart, or make the second one an accessory instead of the main lift.',
  },
  B8: {
    why: 'Too few weekly sets under-stimulates growth; too many outpaces what a week can recover from.',
    suggest: (v) => (v.allowed
      ? `Aim for ${v.allowed} total working sets this week — add sets if under, trim if over.`
      : 'Adjust total weekly working sets to land inside the recommended band.'),
  },
  B9: {
    why: "A loaded session works best built around exactly one centrepiece lift — two splits recovery between them, none leaves nothing to build the day around.",
    suggest: () => 'Mark exactly one exercise per session as the "Main lift" block.',
  },
  B10: {
    why: "The same movement more than three times a week doesn't leave the joint or pattern time to recover before its next session.",
    suggest: () => 'Swap in a substitute exercise for one or two of those sessions.',
  },
};
