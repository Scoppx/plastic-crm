import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { state, patient, visit, contact, BOTOX, FILLER } from './fixtures';

const TODAY = '2026-09-11';

describe('computeStats', () => {
  it('counts totals', () => {
    const s = state({
      patients: [patient('active'), patient('dormant'), patient('dnc', { doNotContact: true }), patient('novisit')],
      visits: [visit('active', BOTOX.id, '2026-08-01'), visit('dormant', BOTOX.id, '2026-01-01'), visit('dnc', BOTOX.id, '2026-01-01')],
    });
    const st = computeStats(s, TODAY);
    expect(st.totalPatients).toBe(4);
    expect(st.activePatients).toBe(1);
    expect(st.dormantPatients).toBe(1);
    expect(st.doNotContact).toBe(1);
  });

  it('buckets due dates by month for last 6 months', () => {
    const s = state({
      patients: [patient('a'), patient('b')],
      visits: [visit('a', BOTOX.id, '2026-04-01'), visit('b', BOTOX.id, '2026-05-01')], // due 07-30, 08-29
    });
    const st = computeStats(s, TODAY);
    expect(st.recallsByMonth.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(st.recallsByMonth.find((m) => m.month === '2026-07')!.count).toBe(1);
    expect(st.recallsByMonth.find((m) => m.month === '2026-08')!.count).toBe(1);
  });

  it('recovery rate = contacts followed by a visit within 60 days', () => {
    const s = state({
      patients: [patient('yes'), patient('no'), patient('snz')],
      visits: [visit('yes', BOTOX.id, '2026-01-01'), visit('yes', BOTOX.id, '2026-06-10'), visit('no', BOTOX.id, '2026-01-01')],
      contacts: [contact('yes', '2026-06-01'), contact('no', '2026-06-01'), contact('snz', '2026-06-01', '2026-07-01')],
    });
    expect(computeStats(s, TODAY).recoveryRate).toBe(0.5);
  });

  it('recovery rate null without contacts', () => {
    expect(computeStats(state(), TODAY).recoveryRate).toBeNull();
  });

  it('recalls by treatment from current recalls', () => {
    const s = state({
      patients: [patient('a'), patient('b'), patient('c')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('b', BOTOX.id, '2026-01-01'), visit('c', FILLER.id, '2025-10-01')],
    });
    expect(computeStats(s, TODAY).recallsByTreatment).toEqual([
      { name: 'Botox', count: 2 },
      { name: 'Filler labbra', count: 1 },
    ]);
  });

  it('contactedLast30Days counts real contacts in the last 30 days, excludes older and snoozed', () => {
    const s = state({
      patients: [patient('recent'), patient('old'), patient('snz')],
      contacts: [
        contact('recent', '2026-09-01'), // 10 days ago
        contact('old', '2026-08-02'), // 40 days ago
        contact('snz', '2026-09-01', '2026-10-01'), // snoozed
      ],
    });
    expect(computeStats(s, TODAY).contactedLast30Days).toBe(1);
  });
});
