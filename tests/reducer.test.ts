import { describe, it, expect } from 'vitest';
import { reducer } from '../src/store/actions';
import { state, patient, visit, contact, BOTOX } from './fixtures';

describe('reducer', () => {
  it('adds and updates a patient', () => {
    let s = reducer(state(), { type: 'ADD_PATIENT', patient: patient('a') });
    expect(s.patients).toHaveLength(1);
    s = reducer(s, { type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'x' } });
    expect(s.patients[0].notes).toBe('x');
  });

  it('deleting a patient removes visits and contacts', () => {
    const s0 = state({ patients: [patient('a')], visits: [visit('a', BOTOX.id, '2026-01-01')], contacts: [contact('a', '2026-02-01')] });
    const s = reducer(s0, { type: 'DELETE_PATIENT', id: 'a' });
    expect(s.patients).toHaveLength(0);
    expect(s.visits).toHaveLength(0);
    expect(s.contacts).toHaveLength(0);
  });

  it('adds visit and contact', () => {
    let s = reducer(state({ patients: [patient('a')] }), { type: 'ADD_VISIT', visit: visit('a', BOTOX.id, '2026-01-01') });
    expect(s.visits).toHaveLength(1);
    s = reducer(s, { type: 'ADD_CONTACT', contact: contact('a', '2026-02-01') });
    expect(s.contacts).toHaveLength(1);
  });

  it('refuses to delete a treatment with visits', () => {
    const s0 = state({ patients: [patient('a')], visits: [visit('a', BOTOX.id, '2026-01-01')] });
    const s = reducer(s0, { type: 'DELETE_TREATMENT', id: BOTOX.id });
    expect(s.treatments.find((t) => t.id === BOTOX.id)).toBeDefined();
  });

  it('updates settings and replaces state', () => {
    let s = reducer(state(), { type: 'UPDATE_SETTINGS', changes: { clinicName: 'Z' } });
    expect(s.settings.clinicName).toBe('Z');
    s = reducer(s, { type: 'REPLACE_STATE', state: state() });
    expect(s.settings.clinicName).toBe('Studio Demo');
  });
});
