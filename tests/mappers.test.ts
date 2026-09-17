import { describe, it, expect } from 'vitest';
import {
  rowToTreatment, treatmentToRow, rowToPatient, patientToRow, rowToVisit, visitToRow,
  rowToContact, contactToRow, rowToSettings, settingsToRow,
  type PatientRow, type SettingsRow,
} from '../src/data/mappers';
import { DEFAULT_SETTINGS } from '../src/domain/types';
import { patient, visit, contact, BOTOX } from './fixtures';

describe('mappers', () => {
  it('treatment round-trip', () => {
    expect(rowToTreatment({ id: 't', name: 'Botox', recall_days: 120 })).toEqual({ id: 't', name: 'Botox', recallDays: 120 });
    expect(treatmentToRow({ id: 't', name: 'Botox', recallDays: null })).toEqual({ id: 't', name: 'Botox', recall_days: null });
    expect(treatmentToRow({ name: 'X' })).toEqual({ name: 'X' });
  });

  it('patient round-trip with null birth_date and timestamp created_at', () => {
    const row: PatientRow = {
      id: 'a', first_name: 'Nomea', last_name: 'Cognomea', phone: '+39333000a', email: 'a@example.com',
      birth_date: null, tags: ['VIP'], notes: '', do_not_contact: true, created_at: '2024-01-01T00:00:00+00:00',
    };
    expect(rowToPatient(row)).toEqual(patient('a', { birthDate: '', tags: ['VIP'], doNotContact: true }));
    expect(patientToRow(patient('a', { birthDate: '' }))).toEqual({ ...row, tags: [], do_not_contact: false, created_at: '2024-01-01' });
    expect(patientToRow({ notes: 'n', birthDate: '1990-05-05' })).toEqual({ notes: 'n', birth_date: '1990-05-05' });
  });

  it('visit round-trip', () => {
    const v = visit('a', BOTOX.id, '2026-01-01');
    expect(rowToVisit(visitToRow(v))).toEqual(v);
    expect(visitToRow(v)).toEqual({ id: v.id, patient_id: 'a', treatment_id: BOTOX.id, date: '2026-01-01', notes: '' });
  });

  it('contact round-trip with and without snooze', () => {
    const c1 = contact('a', '2026-02-01');
    const c2 = contact('a', '2026-02-01', '2026-03-01');
    expect(contactToRow(c1).snooze_until).toBeNull();
    expect(rowToContact(contactToRow(c1))).toEqual(c1);
    expect(rowToContact(contactToRow(c2))).toEqual(c2);
  });

  it('settings round-trip ignores simulatedToday', () => {
    const row: SettingsRow = {
      clinic_name: 'Studio', global_dormant_days: 100, recall_window_days: 7, snooze_days: 10, templates: DEFAULT_SETTINGS.templates,
    };
    expect(rowToSettings(row)).toEqual({ ...DEFAULT_SETTINGS, clinicName: 'Studio', globalDormantDays: 100, recallWindowDays: 7, snoozeDays: 10 });
    expect(settingsToRow({ clinicName: 'Studio', simulatedToday: '2026-01-01' })).toEqual({ clinic_name: 'Studio' });
    expect(settingsToRow({ templates: DEFAULT_SETTINGS.templates })).toEqual({ templates: DEFAULT_SETTINGS.templates });
  });
});
