import { describe, it, expect, beforeEach } from 'vitest';
import { createLocalRepository } from '../src/data/localRepository';
import { loadState, STORAGE_KEY } from '../src/data/storage';
import { patient, visit, contact, BOTOX } from './fixtures';

const TODAY = '2026-09-17';

describe('localRepository', () => {
  beforeEach(() => localStorage.clear());

  it('loadAll equals loadState', async () => {
    const repo = createLocalRepository(TODAY);
    const { state, resetReason } = await repo.loadAll();
    expect(resetReason).toBe('missing');
    expect(state).toEqual(loadState(TODAY).state);
  });

  it('persists every write to localStorage', async () => {
    const repo = createLocalRepository(TODAY);
    await repo.loadAll();
    await repo.addPatient(patient('a'));
    await repo.updatePatient('a', { notes: 'n' });
    await repo.addVisit(visit('a', BOTOX.id, '2026-01-01'));
    await repo.addContact(contact('a', '2026-02-01'));
    await repo.addTreatment({ id: 't-new', name: 'Nuovo', recallDays: 30 });
    await repo.updateTreatment('t-new', { name: 'Nuovo2' });
    await repo.updateSettings({ clinicName: 'X' });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.patients.find((p: { id: string }) => p.id === 'a').notes).toBe('n');
    expect(saved.visits.some((v: { patientId: string }) => v.patientId === 'a')).toBe(true);
    expect(saved.contacts.some((c: { patientId: string }) => c.patientId === 'a')).toBe(true);
    expect(saved.treatments.find((t: { id: string }) => t.id === 't-new').name).toBe('Nuovo2');
    expect(saved.settings.clinicName).toBe('X');

    await repo.deleteVisit(saved.visits.find((v: { patientId: string }) => v.patientId === 'a').id);
    await repo.deleteTreatment('t-new');
    await repo.deletePatient('a');
    const after = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(after.patients.some((p: { id: string }) => p.id === 'a')).toBe(false);
    expect(after.treatments.some((t: { id: string }) => t.id === 't-new')).toBe(false);
  });

  it('replaceState overwrites everything', async () => {
    const repo = createLocalRepository(TODAY);
    const { state } = await repo.loadAll();
    await repo.replaceState!({ ...state, patients: [] });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patients).toEqual([]);
  });
});
