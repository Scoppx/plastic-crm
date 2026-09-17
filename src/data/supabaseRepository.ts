import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type Settings } from '../domain/types';
import type { Repository } from './repository';
import {
  contactToRow, patientToRow, rowToContact, rowToPatient, rowToSettings, rowToTreatment, rowToVisit,
  settingsToRow, treatmentToRow, visitToRow,
  type ContactRow, type PatientRow, type SettingsRow, type TreatmentRow, type VisitRow,
} from './mappers';

type PgError = { code?: string; message: string } | null;

/** PostgREST tronca le risposte a 1000 righe: si legge a pagine. */
const PAGE = 1000;

function check(error: PgError): void {
  if (!error) return;
  console.error(error);
  throw new Error('Salvataggio fallito, riprova', { cause: error });
}

function checkDeleteTreatment(error: PgError): void {
  if (!error) return;
  if (error.code === '23503') throw new Error('Trattamento in uso, non eliminabile');
  check(error);
}

function isEmpty(row: object): boolean {
  return Object.keys(row).length === 0;
}

export function createSupabaseRepository(client: SupabaseClient, ownerId: string): Repository {
  /** Ordine stabile (ultimo criterio `id`) così le pagine non si sovrappongono. */
  async function list<T>(table: string, orderBy: string[]): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = client.from(table).select('*');
      for (const col of [...orderBy, 'id']) q = q.order(col);
      const { data, error } = await q.range(from, from + PAGE - 1);
      check(error);
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  async function loadSettings(): Promise<Settings> {
    const { data, error } = await client.from('settings').select('*').eq('owner_id', ownerId).maybeSingle();
    check(error as PgError);
    if (data) return rowToSettings(data as SettingsRow);
    const { simulatedToday: _ignored, ...defaults } = DEFAULT_SETTINGS;
    check((await client.from('settings').upsert({ owner_id: ownerId, ...settingsToRow(defaults) })).error);
    return defaults;
  }

  return {
    async loadAll() {
      const [treatments, patients, visits, contacts, settings] = await Promise.all([
        list<TreatmentRow>('treatments', ['sort', 'created_at']),
        list<PatientRow>('patients', ['created_at']),
        list<VisitRow>('visits', ['date']),
        list<ContactRow>('contacts', ['date']),
        loadSettings(),
      ]);
      return {
        resetReason: null,
        state: {
          version: SCHEMA_VERSION,
          treatments: treatments.map(rowToTreatment),
          patients: patients.map(rowToPatient),
          visits: visits.map(rowToVisit),
          contacts: contacts.map(rowToContact),
          settings,
        },
      };
    },
    async addPatient(p) { check((await client.from('patients').insert(patientToRow(p))).error); },
    async updatePatient(id, changes) {
      const row = patientToRow(changes);
      if (isEmpty(row)) return;
      check((await client.from('patients').update(row).eq('id', id)).error);
    },
    async deletePatient(id) { check((await client.from('patients').delete().eq('id', id)).error); },
    async addVisit(v) { check((await client.from('visits').insert(visitToRow(v))).error); },
    async deleteVisit(id) { check((await client.from('visits').delete().eq('id', id)).error); },
    async addContact(c) { check((await client.from('contacts').insert(contactToRow(c))).error); },
    async addTreatment(t) { check((await client.from('treatments').insert(treatmentToRow(t))).error); },
    async updateTreatment(id, changes) {
      const row = treatmentToRow(changes);
      if (isEmpty(row)) return;
      check((await client.from('treatments').update(row).eq('id', id)).error);
    },
    async deleteTreatment(id) { checkDeleteTreatment((await client.from('treatments').delete().eq('id', id)).error); },
    async updateSettings(changes) {
      const row = settingsToRow(changes);
      if (isEmpty(row)) return;
      check((await client.from('settings').update(row).eq('owner_id', ownerId)).error);
    },
  };
}
