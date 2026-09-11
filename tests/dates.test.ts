import { describe, it, expect } from 'vitest';
import { toISODate, addDaysISO, daysBetween, monthKey, formatIT } from '../src/domain/dates';

describe('dates', () => {
  it('toISODate formats yyyy-MM-dd', () => {
    expect(toISODate(new Date(2026, 8, 11))).toBe('2026-09-11');
  });
  it('addDaysISO adds and subtracts days', () => {
    expect(addDaysISO('2026-01-30', 5)).toBe('2026-02-04');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween is positive when to is later', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10);
  });
  it('monthKey', () => {
    expect(monthKey('2026-09-11')).toBe('2026-09');
  });
  it('formatIT', () => {
    expect(formatIT('2026-09-11')).toBe('11/09/2026');
  });
});
