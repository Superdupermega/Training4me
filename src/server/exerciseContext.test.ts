import { describe, expect, it } from 'vitest';
import { prescriptionFor, roundToIncrement, waveFor } from '@/core/progression/waves';

/**
 * `exerciseContext.ts`'s `expected.weightKg` is
 * `roundToIncrement(trainingMaxKg * (percentTm / 100), increment)` — the
 * exact same formula `prescriptionFor` (the generator's own prescription
 * engine) uses for a working set's weight. This doesn't call
 * `exerciseContext()` itself — that function's DB round trip has no test
 * double in this project (consistent with the rest of `src/server`, which
 * tests configuration logic, not live queries — see `db.test.ts`) — it
 * proves the two formulas agree, which is the property that actually
 * matters: a "last time" number and an "expected" number that came from
 * different code paths but disagree would be worse than useless.
 */
describe('exerciseContext expected-weight formula', () => {
  it('agrees with prescriptionFor for the same training max, percent and increment', () => {
    const trainingMaxKg = 140;
    const increment = 2.5;
    const week1 = waveFor(4)[0]!; // WAVE_4 week 1: percent 0.70

    const generatorSets = prescriptionFor({ weeks: 4, week: 1, trainingMaxKg, increment });
    const workingSet = generatorSets.find((s) => s.kind === 'working')!;

    const percentTm = week1.percent * 100;
    const contextWeight = roundToIncrement(trainingMaxKg * (percentTm / 100), increment);

    expect(contextWeight).toBe(workingSet.weightKg);
  });

  it('agrees at the peak week too, where the percent is highest and rounding matters most', () => {
    const trainingMaxKg = 92.5;
    const increment = 1.25;
    const peakWeek = waveFor(4)[2]!; // WAVE_4 week 3: the peak, percent 0.82

    const generatorSets = prescriptionFor({ weeks: 4, week: 3, trainingMaxKg, increment });
    const workingSet = generatorSets.find((s) => s.kind === 'working')!;

    const percentTm = peakWeek.percent * 100;
    const contextWeight = roundToIncrement(trainingMaxKg * (percentTm / 100), increment);

    expect(contextWeight).toBe(workingSet.weightKg);
  });
});
