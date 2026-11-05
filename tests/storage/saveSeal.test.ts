import { describe, expect, it } from 'vitest';
import { canonicalJson, sealMatches, sealOf } from '../../src/storage/saveSeal';
import { createDefaultGameSave } from '../../src/storage/gameSave';

describe('save seal', () => {
  it('ignores key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 2], c: undefined } })).toBe(canonicalJson({ a: { d: [1, 2] }, b: 1 }));
    expect(sealOf({ b: 1, a: 2 })).toBe(sealOf({ a: 2, b: 1 }));
  });

  it('changes when any score, total, or rank changes', () => {
    const save = createDefaultGameSave();
    const seal = sealOf(save);
    const edits = [
      { ...save, career: { ...save.career, totalSafeLandings: 1 } },
      { ...save, career: { ...save.career, earnedRankId: 'air-boss' } },
      { ...save, mapRecords: { ...save.mapRecords, 'blue-water': { ...save.mapRecords['blue-water'], bestScores: { portrait: 99, landscape: 0 } } } },
    ];
    for (const edit of edits) expect(sealOf(edit)).not.toBe(seal);
  });

  it('ignores a seal field carried inside the value', () => {
    const save = createDefaultGameSave();
    const seal = sealOf(save);
    expect(sealOf({ ...save, seal: 'anything' })).toBe(seal);
    expect(sealMatches({ ...save, seal }, seal)).toBe(true);
    expect(sealMatches(save, 42)).toBe(false);
  });
});
