import { describe, it, expect } from 'vitest';
import { createSupabaseRepository } from '../src/data/supabaseRepository';
import { fakeSupabase } from './fakeSupabase';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../src/domain/types';
import { patient, visit, contact } from './fixtures';

const OWNER = 'user-1';

describe('supabaseRepository', () => {
  it('loadAll composes AppState from five tables', async () => {
    const { client } = fakeSupabase({
      treatments: { data: [{ id: 't', name: 'Botox', recall_days: 120 }], error: null },
      patients: { data: [{ id: 'a', first_name: 'N', last_name: 'C', phone: '', email: '', birth_date: null, tags: [], notes: '', do_not_contact: false, created_at: '2024-01-01T00:00:00Z' }], error: null },
      visits: { data: [{ id: 'v', patient_id: 'a', treatment_id: 't', date: '2026-01-01', notes: '' }], error: null },
      contacts: { data: [{ id: 'c', patient_id: 'a', date: '2026-02-01', channel: 'email', snooze_until: null }], error: null },
      settings: { data: { clinic_name: 'S', global_dormant_days: 180, recall_window_days: 14, snooze_days: 30, templates: DEFAULT_SETTINGS.templates }, error: null },
    });
    const { state, resetReason } = await createSupabaseRepository(client, OWNER).loadAll();
    expect(resetReason).toBeNull();
    expect(state.version).toBe(SCHEMA_VERSION);
    expect(state.treatments).toEqual([{ id: 't', name: 'Botox', recallDays: 120 }]);
    expect(state.patients[0].createdAt).toBe('2024-01-01');
    expect(state.visits[0].treatmentId).toBe('t');
    expect(state.contacts[0].snoozeUntil).toBeUndefined();
    expect(state.settings.clinicName).toBe('S');
  });

  it('loadAll throws on error', async () => {
    const { client } = fakeSupabase({ patients: { data: null, error: { message: 'boom' } } });
    await expect(createSupabaseRepository(client, OWNER).loadAll()).rejects.toThrow('boom');
  });

  it('writes map to insert/update/delete with filters', async () => {
    const { client, calls } = fakeSupabase();
    const repo = createSupabaseRepository(client, OWNER);
    await repo.addPatient(patient('a'));
    await repo.updatePatient('a', { notes: 'n' });
    await repo.deletePatient('a');
    await repo.addVisit(visit('a', 't', '2026-01-01'));
    await repo.deleteVisit('v');
    await repo.addContact(contact('a', '2026-02-01'));
    await repo.addTreatment({ id: 't2', name: 'X', recallDays: null });
    await repo.updateTreatment('t2', { recallDays: 10 });
    await repo.deleteTreatment('t2');
    await repo.updateSettings({ clinicName: 'S' });

    expect(calls.map((c) => [c.table, c.op])).toEqual([
      ['patients', 'insert'], ['patients', 'update'], ['patients', 'delete'],
      ['visits', 'insert'], ['visits', 'delete'], ['contacts', 'insert'],
      ['treatments', 'insert'], ['treatments', 'update'], ['treatments', 'delete'],
      ['settings', 'update'],
    ]);
    expect(calls[0].payload).toMatchObject({ id: 'a', first_name: 'Nomea', birth_date: '1980-01-01' });
    expect(calls[1]).toMatchObject({ payload: { notes: 'n' }, filters: [['id', 'eq', 'a']] });
    expect(calls[2].filters).toEqual([['id', 'eq', 'a']]);
    expect(calls[7]).toMatchObject({ payload: { recall_days: 10 }, filters: [['id', 'eq', 't2']] });
    expect(calls[9]).toMatchObject({ payload: { clinic_name: 'S' }, filters: [['owner_id', 'eq', OWNER]] });
  });

  it('maps foreign key error on deleteTreatment', async () => {
    const { client } = fakeSupabase({ treatments: { data: null, error: { code: '23503', message: 'fk' } } });
    await expect(createSupabaseRepository(client, OWNER).deleteTreatment('t')).rejects.toThrow('Trattamento in uso, non eliminabile');
  });

  it('has no replaceState', () => {
    const { client } = fakeSupabase();
    expect(createSupabaseRepository(client, OWNER).replaceState).toBeUndefined();
  });
});
