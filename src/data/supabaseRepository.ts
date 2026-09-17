import type { SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_VERSION } from '../domain/types';
import type { Repository } from './repository';
import {
  contactToRow, patientToRow, rowToContact, rowToPatient, rowToSettings, rowToTreatment, rowToVisit,
  settingsToRow, treatmentToRow, visitToRow,
  type ContactRow, type PatientRow, type SettingsRow, type TreatmentRow, type VisitRow,
} from './mappers';

type PgError = { code?: string; message: string } | null;

function check(error: PgError): void {
  if (!error) return;
  throw new Error(error.message);
}

function checkDeleteTreatment(error: PgError): void {
  if (!error) return;
  if (error.code === '23503') throw new Error('Trattamento in uso, non eliminabile');
  throw new Error(error.message);
}

export function createSupabaseRepository(client: SupabaseClient, ownerId: string): Repository {
  async function list<T>(table: string, orderBy: string): Promise<T[]> {
    const { data, error } = await client.from(table).select('*').order(orderBy);
    check(error);
    return (data ?? []) as T[];
  }

  return {
    async loadAll() {
      const [treatments, patients, visits, contacts, settingsRes] = await Promise.all([
        list<TreatmentRow>('treatments', 'sort'),
        list<PatientRow>('patients', 'created_at'),
        list<VisitRow>('visits', 'date'),
        list<ContactRow>('contacts', 'date'),
        client.from('settings').select('*').eq('owner_id', ownerId).single(),
      ]);
      check(settingsRes.error as PgError);
      return {
        resetReason: null,
        state: {
          version: SCHEMA_VERSION,
          treatments: treatments.map(rowToTreatment),
          patients: patients.map(rowToPatient),
          visits: visits.map(rowToVisit),
          contacts: contacts.map(rowToContact),
          settings: rowToSettings(settingsRes.data as SettingsRow),
        },
      };
    },
    async addPatient(p) { check((await client.from('patients').insert(patientToRow(p))).error); },
    async updatePatient(id, changes) { check((await client.from('patients').update(patientToRow(changes)).eq('id', id)).error); },
    async deletePatient(id) { check((await client.from('patients').delete().eq('id', id)).error); },
    async addVisit(v) { check((await client.from('visits').insert(visitToRow(v))).error); },
    async deleteVisit(id) { check((await client.from('visits').delete().eq('id', id)).error); },
    async addContact(c) { check((await client.from('contacts').insert(contactToRow(c))).error); },
    async addTreatment(t) { check((await client.from('treatments').insert(treatmentToRow(t))).error); },
    async updateTreatment(id, changes) { check((await client.from('treatments').update(treatmentToRow(changes)).eq('id', id)).error); },
    async deleteTreatment(id) { checkDeleteTreatment((await client.from('treatments').delete().eq('id', id)).error); },
    async updateSettings(changes) { check((await client.from('settings').update(settingsToRow(changes)).eq('owner_id', ownerId)).error); },
  };
}
