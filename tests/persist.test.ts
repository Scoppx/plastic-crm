import { describe, it, expect, vi } from 'vitest';
import { persist } from '../src/data/persist';
import type { Repository } from '../src/data/repository';
import { patient, visit, contact, state } from './fixtures';

function fakeRepo(): Repository {
  return {
    loadAll: vi.fn(), addPatient: vi.fn(), updatePatient: vi.fn(), deletePatient: vi.fn(),
    addVisit: vi.fn(), deleteVisit: vi.fn(), addContact: vi.fn(), addTreatment: vi.fn(),
    updateTreatment: vi.fn(), deleteTreatment: vi.fn(), updateSettings: vi.fn(), replaceState: vi.fn(),
  };
}

describe('persist', () => {
  it('routes every action to the matching repository method', async () => {
    const repo = fakeRepo();
    const p = patient('a');
    const v = visit('a', 't', '2026-01-01');
    const c = contact('a', '2026-02-01');
    const t = { id: 't', name: 'X', recallDays: null };
    const s = state();
    await persist(repo, { type: 'ADD_PATIENT', patient: p });
    await persist(repo, { type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'n' } });
    await persist(repo, { type: 'DELETE_PATIENT', id: 'a' });
    await persist(repo, { type: 'ADD_VISIT', visit: v });
    await persist(repo, { type: 'DELETE_VISIT', id: 'v' });
    await persist(repo, { type: 'ADD_CONTACT', contact: c });
    await persist(repo, { type: 'ADD_TREATMENT', treatment: t });
    await persist(repo, { type: 'UPDATE_TREATMENT', id: 't', changes: { name: 'Y' } });
    await persist(repo, { type: 'DELETE_TREATMENT', id: 't' });
    await persist(repo, { type: 'UPDATE_SETTINGS', changes: { clinicName: 'S' } });
    await persist(repo, { type: 'REPLACE_STATE', state: s });

    expect(repo.addPatient).toHaveBeenCalledWith(p);
    expect(repo.updatePatient).toHaveBeenCalledWith('a', { notes: 'n' });
    expect(repo.deletePatient).toHaveBeenCalledWith('a');
    expect(repo.addVisit).toHaveBeenCalledWith(v);
    expect(repo.deleteVisit).toHaveBeenCalledWith('v');
    expect(repo.addContact).toHaveBeenCalledWith(c);
    expect(repo.addTreatment).toHaveBeenCalledWith(t);
    expect(repo.updateTreatment).toHaveBeenCalledWith('t', { name: 'Y' });
    expect(repo.deleteTreatment).toHaveBeenCalledWith('t');
    expect(repo.updateSettings).toHaveBeenCalledWith({ clinicName: 'S' });
    expect(repo.replaceState).toHaveBeenCalledWith(s);
  });

  it('rejects REPLACE_STATE when repository lacks replaceState', async () => {
    const repo = fakeRepo();
    delete repo.replaceState;
    await expect(persist(repo, { type: 'REPLACE_STATE', state: state() })).rejects.toThrow('Operazione non disponibile');
  });
});
