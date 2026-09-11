import type { AppState } from './types';
import { computeDueDate, computeRecalls } from './recalls';
import { addDaysISO, monthKey } from './dates';

export type Stats = {
  totalPatients: number;
  activePatients: number;
  dormantPatients: number;
  doNotContact: number;
  recallsByMonth: { month: string; count: number }[];
  recoveryRate: number | null;
  recallsByTreatment: { name: string; count: number }[];
  contactedLast30Days: number;
};

function lastSixMonths(today: string): string[] {
  const out: string[] = [];
  let cursor = today.slice(0, 7) + '-01';
  for (let i = 0; i < 6; i++) {
    out.unshift(monthKey(cursor));
    cursor = addDaysISO(cursor, -1).slice(0, 7) + '-01';
  }
  return out;
}

export function computeStats(state: AppState, today: string): Stats {
  const activeSince = addDaysISO(today, -state.settings.globalDormantDays);
  const recalls = computeRecalls(state, today);

  const activePatients = state.patients.filter((p) =>
    state.visits.some((v) => v.patientId === p.id && v.date >= activeSince && v.date <= today),
  ).length;

  const months = lastSixMonths(today);
  const counts = new Map(months.map((m) => [m, 0]));
  for (const p of state.patients) {
    const due = computeDueDate(p.id, state);
    if (!due) continue;
    const k = monthKey(due.dueDate);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }

  const realContacts = state.contacts.filter((c) => !c.snoozeUntil);
  let recovered = 0;
  for (const c of realContacts) {
    const limit = addDaysISO(c.date, 60);
    if (state.visits.some((v) => v.patientId === c.patientId && v.date > c.date && v.date <= limit)) recovered++;
  }

  const treatmentCounts = new Map<string, number>();
  for (const r of recalls) {
    const name = r.treatment?.name ?? 'Controllo generale';
    treatmentCounts.set(name, (treatmentCounts.get(name) ?? 0) + 1);
  }

  const since30 = addDaysISO(today, -30);
  const contactedLast30Days = state.contacts.filter(
    (c) => !c.snoozeUntil && c.date > since30 && c.date <= today,
  ).length;

  return {
    totalPatients: state.patients.length,
    activePatients,
    dormantPatients: recalls.filter((r) => r.status === 'overdue').length,
    doNotContact: state.patients.filter((p) => p.doNotContact).length,
    recallsByMonth: months.map((m) => ({ month: m, count: counts.get(m)! })),
    recoveryRate: realContacts.length === 0 ? null : recovered / realContacts.length,
    recallsByTreatment: [...treatmentCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    contactedLast30Days,
  };
}
