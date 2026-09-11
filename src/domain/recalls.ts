import type { AppState, DueInfo, Recall, Visit } from './types';
import { addDaysISO, daysBetween } from './dates';

function lastVisitPerTreatment(visits: Visit[]): Map<string, Visit> {
  const map = new Map<string, Visit>();
  for (const v of visits) {
    const prev = map.get(v.treatmentId);
    if (!prev || v.date > prev.date) map.set(v.treatmentId, v);
  }
  return map;
}

export function computeDueDate(patientId: string, state: AppState): DueInfo | null {
  const visits = state.visits.filter((v) => v.patientId === patientId);
  if (visits.length === 0) return null;

  const byTreatment = lastVisitPerTreatment(visits);
  let best: DueInfo | null = null;

  for (const [treatmentId, v] of byTreatment) {
    const t = state.treatments.find((x) => x.id === treatmentId);
    if (!t || t.recallDays === null) continue;
    const dueDate = addDaysISO(v.date, t.recallDays);
    if (!best || dueDate < best.dueDate) {
      best = { treatment: t, lastVisitDate: v.date, dueDate, estimatedValue: t.price };
    }
  }
  if (best) return best;

  const last = visits.reduce((a, b) => (b.date > a.date ? b : a));
  return {
    treatment: null,
    lastVisitDate: last.date,
    dueDate: addDaysISO(last.date, state.settings.globalDormantDays),
    estimatedValue: last.price,
  };
}

export function computeRecalls(state: AppState, today: string): Recall[] {
  const window = state.settings.recallWindowDays;
  const windowEnd = addDaysISO(today, window);
  const out: Recall[] = [];

  for (const p of state.patients) {
    if (p.doNotContact) continue;
    const due = computeDueDate(p.id, state);
    if (!due) continue;
    if (due.dueDate > windowEnd) continue;

    const contacts = state.contacts.filter((c) => c.patientId === p.id);
    if (contacts.some((c) => c.snoozeUntil && c.snoozeUntil > today)) continue;
    const cycleStart = addDaysISO(due.dueDate, -window);
    if (contacts.some((c) => !c.snoozeUntil && c.date >= cycleStart)) continue;

    const daysOverdue = daysBetween(due.dueDate, today);
    out.push({
      ...due,
      patient: p,
      daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'due',
    });
  }

  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.estimatedValue - a.estimatedValue;
  });
}
