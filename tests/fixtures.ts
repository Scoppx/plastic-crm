import type { AppState, Patient, Visit, ContactAttempt, Treatment } from '../src/domain/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../src/domain/types';

export const BOTOX: Treatment = { id: 't-botox', name: 'Botox', recallDays: 120 };
export const FILLER: Treatment = { id: 't-filler', name: 'Filler labbra', recallDays: 270 };
export const RINO: Treatment = { id: 't-rino', name: 'Rinoplastica', recallDays: null };

export function patient(id: string, overrides: Partial<Patient> = {}): Patient {
  return {
    id,
    firstName: 'Nome' + id,
    lastName: 'Cognome' + id,
    phone: '+39333000' + id,
    email: id + '@example.com',
    birthDate: '1980-01-01',
    tags: [],
    notes: '',
    doNotContact: false,
    createdAt: '2024-01-01',
    ...overrides,
  };
}

export function visit(patientId: string, treatmentId: string, date: string): Visit {
  return { id: `v-${patientId}-${treatmentId}-${date}`, patientId, treatmentId, date, notes: '' };
}

export function contact(patientId: string, date: string, snoozeUntil?: string): ContactAttempt {
  return { id: `c-${patientId}-${date}`, patientId, date, channel: 'whatsapp', snoozeUntil };
}

export function state(partial: Partial<AppState> = {}): AppState {
  return {
    version: SCHEMA_VERSION,
    treatments: [BOTOX, FILLER, RINO],
    patients: [],
    visits: [],
    contacts: [],
    settings: { ...DEFAULT_SETTINGS },
    ...partial,
  };
}
