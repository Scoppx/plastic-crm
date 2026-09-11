import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/data/seed';
import { computeRecalls } from '../src/domain/recalls';

const TODAY = '2026-09-11';

describe('createSeed', () => {
  it('is deterministic', () => {
    expect(createSeed(TODAY)).toEqual(createSeed(TODAY));
  });
  it('has 8 treatments and ~40 patients with visits', () => {
    const s = createSeed(TODAY);
    expect(s.treatments).toHaveLength(8);
    expect(s.patients.length).toBeGreaterThanOrEqual(38);
    expect(s.patients.length).toBeLessThanOrEqual(42);
    for (const p of s.patients) {
      expect(s.visits.filter((v) => v.patientId === p.id).length).toBeGreaterThanOrEqual(1);
    }
  });
  it('produces a sensible recall list', () => {
    const s = createSeed(TODAY);
    const r = computeRecalls(s, TODAY);
    const overdue = r.filter((x) => x.status === 'overdue').length;
    const due = r.filter((x) => x.status === 'due').length;
    expect(overdue).toBeGreaterThanOrEqual(8);
    expect(due).toBeGreaterThanOrEqual(2);
    expect(s.patients.filter((p) => p.doNotContact)).toHaveLength(2);
    expect(s.contacts.some((c) => c.snoozeUntil)).toBe(true);
  });
  it('all visits are on or before today', () => {
    const s = createSeed(TODAY);
    expect(s.visits.every((v) => v.date <= TODAY)).toBe(true);
  });
});
