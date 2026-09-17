import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSupabaseRepository } from '../src/data/supabaseRepository';
import { fakeSupabase, type Call } from './fakeSupabase';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../src/domain/types';
import { patient, visit, contact } from './fixtures';

const OWNER = 'user-1';
const SETTINGS_ROW = { clinic_name: 'S', global_dormant_days: 180, recall_window_days: 14, snooze_days: 30, templates: DEFAULT_SETTINGS.templates };

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('supabaseRepository', () => {
  it('loadAll composes AppState from five tables', async () => {
    const { client, calls } = fakeSupabase({
      treatments: { data: [{ id: 't', name: 'Botox', recall_days: 120 }], error: null },
      patients: { data: [{ id: 'a', first_name: 'N', last_name: 'C', phone: '', email: '', birth_date: null, tags: [], notes: '', do_not_contact: false, created_at: '2024-01-01T00:00:00Z' }], error: null },
      visits: { data: [{ id: 'v', patient_id: 'a', treatment_id: 't', date: '2026-01-01', notes: '' }], error: null },
      contacts: { data: [{ id: 'c', patient_id: 'a', date: '2026-02-01', channel: 'email', snooze_until: null }], error: null },
      settings: { data: SETTINGS_ROW, error: null },
    });
    const { state, resetReason } = await createSupabaseRepository(client, OWNER).loadAll();
    expect(resetReason).toBeNull();
    expect(state.version).toBe(SCHEMA_VERSION);
    expect(state.treatments).toEqual([{ id: 't', name: 'Botox', recallDays: 120 }]);
    expect(state.patients[0].createdAt).toBe('2024-01-01');
    expect(state.visits[0].treatmentId).toBe('t');
    expect(state.contacts[0].snoozeUntil).toBeUndefined();
    expect(state.settings.clinicName).toBe('S');
    expect(calls.find((c) => c.table === 'treatments')?.order).toEqual(['sort', 'created_at', 'id']);
    expect(calls.find((c) => c.table === 'patients')?.order).toEqual(['created_at', 'id']);
  });

  it('loadAll pages through results larger than 1000 rows', async () => {
    const row = (i: number) => ({ id: 'p' + i, first_name: 'N', last_name: 'C', phone: '', email: '', birth_date: null, tags: [], notes: '', do_not_contact: false, created_at: '2024-01-01T00:00:00Z' });
    const { client, calls } = fakeSupabase({
      patients: (call: Call) => {
        const [from] = call.range!;
        return { data: from === 0 ? Array.from({ length: 1000 }, (_, i) => row(i)) : [row(1000), row(1001), row(1002)], error: null };
      },
      settings: { data: SETTINGS_ROW, error: null },
    });
    const { state } = await createSupabaseRepository(client, OWNER).loadAll();
    expect(state.patients).toHaveLength(1003);
    expect(state.patients[1002].id).toBe('p1002');
    expect(calls.filter((c) => c.table === 'patients').map((c) => c.range)).toEqual([[0, 999], [1000, 1999]]);
  });

  it('loadAll throws an italian message on error', async () => {
    const { client } = fakeSupabase({ patients: { data: null, error: { message: 'boom' } } });
    await expect(createSupabaseRepository(client, OWNER).loadAll()).rejects.toThrow('Salvataggio fallito, riprova');
    expect(console.error).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('loadAll creates the settings row from defaults when missing', async () => {
    const { client, calls } = fakeSupabase({ settings: { data: null, error: null } });
    const { state } = await createSupabaseRepository(client, OWNER).loadAll();
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    const upsert = calls.find((c) => c.table === 'settings' && c.op === 'upsert');
    expect(upsert?.payload).toMatchObject({ owner_id: OWNER, clinic_name: DEFAULT_SETTINGS.clinicName, templates: DEFAULT_SETTINGS.templates });
    expect(upsert?.payload).not.toHaveProperty('simulatedToday');
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

  it('skips updates whose mapped row is empty', async () => {
    const { client, calls } = fakeSupabase();
    const repo = createSupabaseRepository(client, OWNER);
    await repo.updateSettings({ simulatedToday: '2026-01-01' });
    await repo.updatePatient('a', {});
    await repo.updateTreatment('t', {});
    expect(calls).toEqual([]);
  });

  it('maps any write error to an italian message and logs the original', async () => {
    const err = { message: 'TypeError: Failed to fetch' };
    const { client } = fakeSupabase({ patients: { data: null, error: err } });
    await expect(createSupabaseRepository(client, OWNER).addPatient(patient('a'))).rejects.toThrow('Salvataggio fallito, riprova');
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('maps foreign key error on deleteTreatment', async () => {
    const { client } = fakeSupabase({ treatments: { data: null, error: { code: '23503', message: 'fk' } } });
    await expect(createSupabaseRepository(client, OWNER).deleteTreatment('t')).rejects.toThrow('Trattamento in uso, non eliminabile');
  });

  it('does not remap 23503 on addVisit', async () => {
    const { client } = fakeSupabase({ visits: { data: null, error: { code: '23503', message: 'fk' } } });
    await expect(createSupabaseRepository(client, OWNER).addVisit(visit('a', 't', '2026-01-01'))).rejects.toThrow('Salvataggio fallito, riprova');
  });

  it('has no replaceState', () => {
    const { client } = fakeSupabase();
    expect(createSupabaseRepository(client, OWNER).replaceState).toBeUndefined();
  });
});
