import type { AppState, ContactAttempt, Patient, Settings, Treatment, Visit } from '../domain/types';
import type { ResetReason } from './storage';

export type LoadResult = { state: AppState; resetReason: ResetReason };

export interface Repository {
  loadAll(): Promise<LoadResult>;
  addPatient(p: Patient): Promise<void>;
  updatePatient(id: string, changes: Partial<Patient>): Promise<void>;
  deletePatient(id: string): Promise<void>;
  addVisit(v: Visit): Promise<void>;
  deleteVisit(id: string): Promise<void>;
  addContact(c: ContactAttempt): Promise<void>;
  addTreatment(t: Treatment): Promise<void>;
  updateTreatment(id: string, changes: Partial<Treatment>): Promise<void>;
  deleteTreatment(id: string): Promise<void>;
  updateSettings(changes: Partial<Settings>): Promise<void>;
  /** Solo backend local: sostituisce tutto lo stato (import JSON, reset demo). */
  replaceState?(state: AppState): Promise<void>;
}
