import type { AppState, ContactAttempt, Patient, Settings, Treatment, Visit } from '../domain/types';

export type Action =
  | { type: 'ADD_PATIENT'; patient: Patient }
  | { type: 'UPDATE_PATIENT'; id: string; changes: Partial<Patient> }
  | { type: 'DELETE_PATIENT'; id: string }
  | { type: 'ADD_VISIT'; visit: Visit }
  | { type: 'DELETE_VISIT'; id: string }
  | { type: 'ADD_CONTACT'; contact: ContactAttempt }
  | { type: 'ADD_TREATMENT'; treatment: Treatment }
  | { type: 'UPDATE_TREATMENT'; id: string; changes: Partial<Treatment> }
  | { type: 'DELETE_TREATMENT'; id: string }
  | { type: 'UPDATE_SETTINGS'; changes: Partial<Settings> }
  | { type: 'REPLACE_STATE'; state: AppState };

export function newId(): string {
  return crypto.randomUUID();
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PATIENT':
      return { ...state, patients: [...state.patients, action.patient] };
    case 'UPDATE_PATIENT':
      return { ...state, patients: state.patients.map((p) => (p.id === action.id ? { ...p, ...action.changes } : p)) };
    case 'DELETE_PATIENT':
      return {
        ...state,
        patients: state.patients.filter((p) => p.id !== action.id),
        visits: state.visits.filter((v) => v.patientId !== action.id),
        contacts: state.contacts.filter((c) => c.patientId !== action.id),
      };
    case 'ADD_VISIT':
      return { ...state, visits: [...state.visits, action.visit] };
    case 'DELETE_VISIT':
      return { ...state, visits: state.visits.filter((v) => v.id !== action.id) };
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.contact] };
    case 'ADD_TREATMENT':
      return { ...state, treatments: [...state.treatments, action.treatment] };
    case 'UPDATE_TREATMENT':
      return { ...state, treatments: state.treatments.map((t) => (t.id === action.id ? { ...t, ...action.changes } : t)) };
    case 'DELETE_TREATMENT':
      if (state.visits.some((v) => v.treatmentId === action.id)) return state;
      return { ...state, treatments: state.treatments.filter((t) => t.id !== action.id) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case 'REPLACE_STATE':
      return action.state;
  }
}
