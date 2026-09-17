import type { ContactAttempt, ContactChannel, Patient, Settings, Treatment, Visit } from '../domain/types';

export type TreatmentRow = { id: string; name: string; recall_days: number | null };
export type PatientRow = {
  id: string; first_name: string; last_name: string; phone: string; email: string;
  birth_date: string | null; tags: string[]; notes: string; do_not_contact: boolean; created_at: string;
};
export type VisitRow = { id: string; patient_id: string; treatment_id: string; date: string; notes: string };
export type ContactRow = { id: string; patient_id: string; date: string; channel: ContactChannel; snooze_until: string | null };
export type SettingsRow = {
  clinic_name: string; global_dormant_days: number; recall_window_days: number; snooze_days: number;
  templates: Settings['templates'];
};

export function rowToTreatment(r: TreatmentRow): Treatment {
  return { id: r.id, name: r.name, recallDays: r.recall_days };
}

export function treatmentToRow(t: Partial<Treatment>): Partial<TreatmentRow> {
  return {
    ...(t.id !== undefined && { id: t.id }),
    ...(t.name !== undefined && { name: t.name }),
    ...(t.recallDays !== undefined && { recall_days: t.recallDays }),
  };
}

export function rowToPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    email: r.email,
    birthDate: r.birth_date ?? '',
    tags: r.tags,
    notes: r.notes,
    doNotContact: r.do_not_contact,
    createdAt: r.created_at.slice(0, 10),
  };
}

export function patientToRow(p: Partial<Patient>): Partial<PatientRow> {
  return {
    ...(p.id !== undefined && { id: p.id }),
    ...(p.firstName !== undefined && { first_name: p.firstName }),
    ...(p.lastName !== undefined && { last_name: p.lastName }),
    ...(p.phone !== undefined && { phone: p.phone }),
    ...(p.email !== undefined && { email: p.email }),
    ...(p.birthDate !== undefined && { birth_date: p.birthDate === '' ? null : p.birthDate }),
    ...(p.tags !== undefined && { tags: p.tags }),
    ...(p.notes !== undefined && { notes: p.notes }),
    ...(p.doNotContact !== undefined && { do_not_contact: p.doNotContact }),
    ...(p.createdAt !== undefined && { created_at: p.createdAt }),
  };
}

export function rowToVisit(r: VisitRow): Visit {
  return { id: r.id, patientId: r.patient_id, treatmentId: r.treatment_id, date: r.date, notes: r.notes };
}

export function visitToRow(v: Visit): VisitRow {
  return { id: v.id, patient_id: v.patientId, treatment_id: v.treatmentId, date: v.date, notes: v.notes };
}

export function rowToContact(r: ContactRow): ContactAttempt {
  return {
    id: r.id,
    patientId: r.patient_id,
    date: r.date,
    channel: r.channel,
    ...(r.snooze_until !== null && { snoozeUntil: r.snooze_until }),
  };
}

export function contactToRow(c: ContactAttempt): ContactRow {
  return { id: c.id, patient_id: c.patientId, date: c.date, channel: c.channel, snooze_until: c.snoozeUntil ?? null };
}

export function rowToSettings(r: SettingsRow): Settings {
  return {
    clinicName: r.clinic_name,
    globalDormantDays: r.global_dormant_days,
    recallWindowDays: r.recall_window_days,
    snoozeDays: r.snooze_days,
    templates: r.templates,
  };
}

export function settingsToRow(s: Partial<Settings>): Partial<SettingsRow> {
  return {
    ...(s.clinicName !== undefined && { clinic_name: s.clinicName }),
    ...(s.globalDormantDays !== undefined && { global_dormant_days: s.globalDormantDays }),
    ...(s.recallWindowDays !== undefined && { recall_window_days: s.recallWindowDays }),
    ...(s.snoozeDays !== undefined && { snooze_days: s.snoozeDays }),
    ...(s.templates !== undefined && { templates: s.templates }),
  };
}
