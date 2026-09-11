import { describe, it, expect } from 'vitest';
import { computeDueDate, computeRecalls } from '../src/domain/recalls';
import { state, patient, visit, contact, BOTOX, FILLER, RINO } from './fixtures';

const TODAY = '2026-09-11';

describe('computeDueDate', () => {
  it('returns null without visits', () => {
    const s = state({ patients: [patient('a')] });
    expect(computeDueDate('a', s)).toBeNull();
  });

  it('uses treatment recallDays from last visit of that treatment', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('a', BOTOX.id, '2026-05-01')],
    });
    const d = computeDueDate('a', s)!;
    expect(d.dueDate).toBe('2026-08-29'); // 2026-05-01 + 120
    expect(d.treatment?.id).toBe(BOTOX.id);
    expect(d.lastVisitDate).toBe('2026-05-01');
    expect(d.estimatedValue).toBe(350);
  });

  it('picks the nearest due date across treatments', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', FILLER.id, '2026-01-01'), visit('a', BOTOX.id, '2026-06-01')],
    });
    // filler: 2026-01-01+270 = 2026-09-28 ; botox: 2026-06-01+120 = 2026-09-29
    expect(computeDueDate('a', s)!.treatment?.id).toBe(FILLER.id);
  });

  it('falls back to globalDormantDays when only null-recall treatments', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', RINO.id, '2026-01-10', 6500)],
    });
    const d = computeDueDate('a', s)!;
    expect(d.dueDate).toBe('2026-07-09'); // +180
    expect(d.treatment).toBeNull();
    expect(d.estimatedValue).toBe(6500); // last visit price
  });
});

describe('computeRecalls', () => {
  it('marks overdue and due, excludes ok', () => {
    const s = state({
      patients: [patient('over'), patient('due'), patient('ok')],
      visits: [
        visit('over', BOTOX.id, '2026-04-01'), // due 2026-07-30 → overdue 43 days
        visit('due', BOTOX.id, '2026-05-20'),  // due 2026-09-17 → due in 6 days
        visit('ok', BOTOX.id, '2026-08-01'),   // due 2026-11-29 → ok
      ],
    });
    const r = computeRecalls(s, TODAY);
    expect(r.map((x) => [x.patient.id, x.status, x.daysOverdue])).toEqual([
      ['over', 'overdue', 43],
      ['due', 'due', -6],
    ]);
  });

  it('excludes doNotContact', () => {
    const s = state({
      patients: [patient('a', { doNotContact: true })],
      visits: [visit('a', BOTOX.id, '2026-01-01')],
    });
    expect(computeRecalls(s, TODAY)).toHaveLength(0);
  });

  it('excludes active snooze, includes expired snooze', () => {
    const s = state({
      patients: [patient('a'), patient('b')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('b', BOTOX.id, '2026-01-01')],
      contacts: [contact('a', '2026-05-01', '2026-10-01'), contact('b', '2026-04-01', '2026-05-01')],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['b']);
  });

  it('excludes patient contacted within the current cycle window', () => {
    // due = 2026-04-01+120 = 2026-07-30 ; window start = 2026-07-16
    const s = state({
      patients: [patient('recent'), patient('old')],
      visits: [visit('recent', BOTOX.id, '2026-04-01'), visit('old', BOTOX.id, '2026-04-01')],
      contacts: [contact('recent', '2026-07-20'), contact('old', '2026-07-10')],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['old']);
  });

  it('orders overdue first, then daysOverdue desc', () => {
    const s = state({
      patients: [patient('d1'), patient('o43'), patient('o42'), patient('o-older')],
      visits: [
        visit('d1', BOTOX.id, '2026-05-20'),      // due 2026-09-17 → due
        visit('o43', BOTOX.id, '2026-04-01'),     // due 2026-07-30 → 43 days overdue
        visit('o42', FILLER.id, '2025-11-03'),    // due 2026-07-31 → 42 days overdue
        visit('o-older', BOTOX.id, '2026-03-01'), // due 2026-06-29 → 74 days overdue
      ],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['o-older', 'o43', 'o42', 'd1']);
  });

  it('breaks ties on estimatedValue desc', () => {
    const s = state({
      treatments: [RINO],
      patients: [patient('cheap'), patient('rich')],
      visits: [visit('cheap', RINO.id, '2026-01-10', 100), visit('rich', RINO.id, '2026-01-10', 9000)],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['rich', 'cheap']);
  });
});
