import { describe, expect, it } from 'vitest';
import { newDay, newItem } from './editable';
import { coverageFor } from './muscleCoverage';

describe('coverageFor', () => {
  it('reports the muscle groups an empty day trains: none', () => {
    expect(coverageFor([newDay('Rest')])).toEqual(new Set());
  });

  it('derives groups from each item exercise\'s primary muscles', () => {
    const day = { ...newDay('Push'), blocks: [{ clientId: 'b1', items: [newItem('bench-press')] }] };
    // bench-press's primaryMuscles is ['chest'] → the 'chest' group.
    expect(coverageFor([day])).toEqual(new Set(['chest']));
  });

  it('unions coverage across every day passed in, for a whole-program view', () => {
    const push = { ...newDay('Push'), blocks: [{ clientId: 'b1', items: [newItem('bench-press')] }] };
    const legs = { ...newDay('Legs'), blocks: [{ clientId: 'b2', items: [newItem('back-squat')] }] };
    // back-squat's primaryMuscles is ['quads', 'glutes'] → 'quads' and 'hamstrings_glutes'.
    const covered = coverageFor([push, legs]);
    expect(covered.has('chest')).toBe(true);
    expect(covered.has('quads')).toBe(true);
    expect(covered.has('hamstrings_glutes')).toBe(true);
    expect(covered.has('back')).toBe(false);
  });
});
