# Produzione con Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare Plastic CRM da demo `localStorage` a produzione con Supabase (Postgres + auth), mantenendo la demo pubblica e senza toccare dominio e reducer.

**Architecture:** Un'interfaccia `Repository` con due implementazioni (`local`, `supabase`) scelte da `VITE_DATA_BACKEND`. `AppProvider` carica lo stato con `loadAll()`, applica ogni azione al reducer in modo ottimistico e la persiste in coda FIFO con rollback su errore. `AuthProvider` (Supabase Auth email+password) protegge le route; con backend `local` è un passthrough. Schema DB multi-tenant via `owner_id` + RLS.

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind 4, react-router-dom 6 (HashRouter), Vitest + jsdom + @testing-library/react, `@supabase/supabase-js` v2, Supabase CLI, GitHub Actions, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-09-17-produzione-supabase-design.md`

## Global Constraints

- `src/domain/` e `src/store/actions.ts` non cambiano.
- Niente prezzi né valori economici.
- Lingua UI: italiano.
- Progetto Supabase: ref `tsclykbqwmiytqpvxayn`, URL `https://tsclykbqwmiytqpvxayn.supabase.co`, regione Frankfurt.
- `VITE_DATA_BACKEND` ∈ `supabase | local`, default `local` se assente.
- Canali contatto: `'call' | 'whatsapp' | 'email'`.
- Nessuna coda offline. App online-only.
- `simulatedToday` mai in DB.
- Commit dopo ogni task, messaggi Conventional Commits.
- Ogni task termina con `npm test` e `npm run build` verdi.

---

## File Structure

Creati:

- `supabase/config.toml` — generato da `supabase init`
- `supabase/migrations/20260917000000_schema.sql` — tabelle, indici, trigger, RLS, `handle_new_user`
- `.env.example` — variabili vuote
- `src/data/repository.ts` — interfaccia `Repository`, `LoadResult`
- `src/data/localRepository.ts` — wrappa `storage.ts`
- `src/data/mappers.ts` — riga ↔ modello
- `src/data/supabaseClient.ts` — `createClient` da env
- `src/data/supabaseRepository.ts` — implementazione Supabase
- `src/data/persist.ts` — `Action` → chiamata `Repository`
- `src/data/index.ts` — `createRepository(ownerId)`, `isDemo`, `BACKEND`
- `src/components/Toast.tsx` — `ToastProvider`, `useToast`
- `src/auth/AuthContext.tsx` — `AuthProvider`, `useAuth`
- `src/auth/RequireAuth.tsx` — route guard che monta `AppProvider`
- `src/pages/Login.tsx`, `src/pages/ResetPassword.tsx`
- `.github/workflows/keepalive.yml`
- `docs/CHECKLIST-PROD.md`
- `tests/localRepository.test.ts`, `tests/mappers.test.ts`, `tests/supabaseRepository.test.ts`, `tests/persist.test.ts`, `tests/createRepository.test.ts`, `tests/appProvider.test.tsx`, `tests/fakeSupabase.ts`

Modificati:

- `src/store/AppContext.tsx` — caricamento async, dispatch ottimistico con coda, rollback, toast
- `src/App.tsx` — `ToastProvider`, `AuthProvider`, route login/reset, `RequireAuth`
- `src/components/Layout.tsx` — logout, banner solo demo
- `src/components/DemoBanner.tsx` — invariato nel contenuto, montato solo se `isDemo`
- `src/pages/Settings.tsx` — sezione Demo solo se `isDemo`, sezione Account solo se `!isDemo`
- `vite.config.ts` — `base` da env, test include `.tsx`
- `package.json` — dipendenze, script `deploy`
- `.gitignore` — `.env.local`, `supabase/.temp`
- `README.md` — sezione ambienti

---

### Task 1: Schema DB e migrazione Supabase

**Files:**
- Create: `supabase/migrations/20260917000000_schema.sql`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: tabelle `treatments`, `patients`, `visits`, `contacts`, `settings` con i nomi colonna usati da `mappers.ts` (Task 3).

- [ ] **Step 1: Installa e collega Supabase CLI**

```bash
brew install supabase/tap/supabase
cd ~/plastic-crm
supabase login          # apre il browser, incolla il token
supabase init           # crea supabase/config.toml
supabase link --project-ref tsclykbqwmiytqpvxayn   # chiede la password DB
```

- [ ] **Step 2: Aggiorna `.gitignore`**

```
.superpowers/
node_modules
dist
.env.local
.env.*.local
supabase/.temp
```

- [ ] **Step 3: Scrivi la migrazione**

`supabase/migrations/20260917000000_schema.sql`:

```sql
-- updated_at automatico
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tabelle ----------
create table public.treatments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  recall_days int,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name     text not null,
  last_name      text not null,
  phone          text not null default '',
  email          text not null default '',
  birth_date     date,
  tags           text[] not null default '{}',
  notes          text not null default '',
  do_not_contact boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.visits (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  date         date not null,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  date         date not null,
  channel      text not null check (channel in ('call', 'whatsapp', 'email')),
  snooze_until date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.settings (
  owner_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  clinic_name         text not null default 'Il mio studio',
  global_dormant_days int not null default 180,
  recall_window_days  int not null default 14,
  snooze_days         int not null default 30,
  templates           jsonb not null,
  updated_at          timestamptz not null default now()
);

-- ---------- indici ----------
create index treatments_owner_idx on public.treatments (owner_id, sort);
create index patients_owner_idx   on public.patients (owner_id);
create index visits_owner_idx     on public.visits (owner_id);
create index visits_patient_idx   on public.visits (patient_id);
create index contacts_owner_idx   on public.contacts (owner_id);
create index contacts_patient_idx on public.contacts (patient_id);

-- ---------- trigger updated_at ----------
create trigger treatments_updated_at before update on public.treatments for each row execute function public.set_updated_at();
create trigger patients_updated_at   before update on public.patients   for each row execute function public.set_updated_at();
create trigger visits_updated_at     before update on public.visits     for each row execute function public.set_updated_at();
create trigger contacts_updated_at   before update on public.contacts   for each row execute function public.set_updated_at();
create trigger settings_updated_at   before update on public.settings   for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.treatments enable row level security;
alter table public.patients   enable row level security;
alter table public.visits     enable row level security;
alter table public.contacts   enable row level security;
alter table public.settings   enable row level security;

create policy "own rows" on public.treatments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.patients   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.visits     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.contacts   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own rows" on public.settings   for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- nuovo utente: settings + trattamenti di default ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.settings (owner_id, templates) values (
    new.id,
    '{"whatsapp": "Ciao {nome}, sono {clinica}. Sono passati circa {mesi} mesi dal tuo ultimo {trattamento}: vuoi prenotare un controllo? Rispondi pure a questo messaggio.", "email": {"subject": "Il tuo prossimo appuntamento da {clinica}", "body": "Gentile {nome},\n\nsono passati circa {mesi} mesi dal tuo ultimo trattamento ({trattamento}). Saremmo felici di rivederti per un controllo.\n\nRispondi a questa email o chiamaci per fissare un appuntamento.\n\nA presto,\n{clinica}"}}'::jsonb
  );
  insert into public.treatments (owner_id, name, recall_days, sort) values
    (new.id, 'Botox', 120, 0),
    (new.id, 'Filler labbra', 270, 1),
    (new.id, 'Filler zigomi', 365, 2),
    (new.id, 'Biorivitalizzazione', 180, 3),
    (new.id, 'Peeling', 90, 4),
    (new.id, 'Rinoplastica', null, 5),
    (new.id, 'Mastoplastica', null, 6),
    (new.id, 'Blefaroplastica', null, 7);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Applica la migrazione**

```bash
supabase db push
```

Expected: `Applying migration 20260917000000_schema.sql... Finished supabase db push.`

- [ ] **Step 5: Verifica manuale nella dashboard**

1. Table Editor: esistono `treatments`, `patients`, `visits`, `contacts`, `settings`, tutte con lucchetto RLS.
2. Authentication > Sign In / Providers > Email: "Allow new users to sign up" = **off**, "Confirm email" = **off**.
3. Authentication > Users > Add user: crea `test-a@example.com` con password. Poi Table Editor: `settings` ha 1 riga con `owner_id` di quell'utente, `treatments` ha 8 righe.
4. Crea anche `test-b@example.com` (serve alla checklist finale per verificare l'isolamento).

- [ ] **Step 6: `.env.example`**

```
VITE_DATA_BACKEND=local
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BASE_PATH=/
```

- [ ] **Step 7: Commit**

```bash
git add supabase .env.example .gitignore
git commit -m "feat(db): schema multi-tenant con RLS e setup nuovo utente"
```

---

### Task 2: Interfaccia `Repository` e `localRepository`

**Files:**
- Create: `src/data/repository.ts`
- Create: `src/data/localRepository.ts`
- Test: `tests/localRepository.test.ts`

**Interfaces:**
- Consumes: `loadState`, `saveState`, `ResetReason` da `src/data/storage.ts`; `reducer` da `src/store/actions.ts`.
- Produces:

```ts
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
  replaceState?(state: AppState): Promise<void>;
}
export function createLocalRepository(today: string): Repository;
```

- [ ] **Step 1: Scrivi il test**

`tests/localRepository.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui, deve fallire**

Run: `npx vitest run tests/localRepository.test.ts`
Expected: FAIL, `Cannot find module '../src/data/localRepository'`

- [ ] **Step 3: Implementa**

`src/data/repository.ts`:

```ts
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
```

`src/data/localRepository.ts`:

```ts
import type { AppState } from '../domain/types';
import { reducer, type Action } from '../store/actions';
import { loadState, saveState } from './storage';
import type { Repository } from './repository';

/** Demo/test: lo stato vive in memoria e viene riscritto per intero in localStorage a ogni azione. */
export function createLocalRepository(today: string): Repository {
  let state: AppState | null = null;

  function apply(action: Action): Promise<void> {
    if (!state) return Promise.reject(new Error('loadAll non ancora chiamato'));
    state = reducer(state, action);
    saveState(state);
    return Promise.resolve();
  }

  return {
    loadAll() {
      const r = loadState(today);
      state = r.state;
      return Promise.resolve(r);
    },
    addPatient: (patient) => apply({ type: 'ADD_PATIENT', patient }),
    updatePatient: (id, changes) => apply({ type: 'UPDATE_PATIENT', id, changes }),
    deletePatient: (id) => apply({ type: 'DELETE_PATIENT', id }),
    addVisit: (visit) => apply({ type: 'ADD_VISIT', visit }),
    deleteVisit: (id) => apply({ type: 'DELETE_VISIT', id }),
    addContact: (contact) => apply({ type: 'ADD_CONTACT', contact }),
    addTreatment: (treatment) => apply({ type: 'ADD_TREATMENT', treatment }),
    updateTreatment: (id, changes) => apply({ type: 'UPDATE_TREATMENT', id, changes }),
    deleteTreatment: (id) => apply({ type: 'DELETE_TREATMENT', id }),
    updateSettings: (changes) => apply({ type: 'UPDATE_SETTINGS', changes }),
    replaceState: (s) => apply({ type: 'REPLACE_STATE', state: s }),
  };
}
```

- [ ] **Step 4: Esegui, deve passare**

Run: `npx vitest run tests/localRepository.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/data/repository.ts src/data/localRepository.ts tests/localRepository.test.ts
git commit -m "feat(data): interfaccia Repository e implementazione locale"
```

---

### Task 3: Mapper riga ↔ modello

**Files:**
- Create: `src/data/mappers.ts`
- Test: `tests/mappers.test.ts`

**Interfaces:**
- Produces:

```ts
export type TreatmentRow = { id: string; name: string; recall_days: number | null };
export type PatientRow = { id: string; first_name: string; last_name: string; phone: string; email: string; birth_date: string | null; tags: string[]; notes: string; do_not_contact: boolean; created_at: string };
export type VisitRow = { id: string; patient_id: string; treatment_id: string; date: string; notes: string };
export type ContactRow = { id: string; patient_id: string; date: string; channel: ContactChannel; snooze_until: string | null };
export type SettingsRow = { clinic_name: string; global_dormant_days: number; recall_window_days: number; snooze_days: number; templates: Settings['templates'] };

export function rowToTreatment(r: TreatmentRow): Treatment;
export function treatmentToRow(t: Partial<Treatment>): Partial<TreatmentRow>;
export function rowToPatient(r: PatientRow): Patient;
export function patientToRow(p: Partial<Patient>): Partial<PatientRow>;
export function rowToVisit(r: VisitRow): Visit;
export function visitToRow(v: Visit): VisitRow;
export function rowToContact(r: ContactRow): ContactAttempt;
export function contactToRow(c: ContactAttempt): ContactRow;
export function rowToSettings(r: SettingsRow): Settings;
export function settingsToRow(s: Partial<Settings>): Partial<SettingsRow>;
```

Regole: `birth_date null` ↔ `birthDate ''`; `snooze_until null` ↔ `snoozeUntil undefined`; `created_at` (timestamptz) → `createdAt` = primi 10 caratteri (`YYYY-MM-DD`); `simulatedToday` ignorato in `settingsToRow`; le funzioni `*ToRow` con `Partial` emettono solo le chiavi presenti.

- [ ] **Step 1: Scrivi il test**

`tests/mappers.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui, deve fallire**

Run: `npx vitest run tests/mappers.test.ts`
Expected: FAIL, `Cannot find module '../src/data/mappers'`

- [ ] **Step 3: Implementa**

`src/data/mappers.ts`:

```ts
import type { ContactAttempt, ContactChannel, Patient, Settings, Treatment, Visit } from '../domain/types';

export type TreatmentRow = { id: string; name: string; recall_days: number | null };
export type PatientRow = {
  id: string; first_name: string; last_name: string; phone: string; email: string;
  birth_date: string | null; tags: string[]; notes: string; do_not_contact: boolean; created_at: string;
};
export type VisitRow = { id: string; patient_id: string; treatment_id: string; date: string; notes: string };
export type ContactRow = { id: string; patient_id: string; date: string; channel: ContactChannel; snooze_until: string | null };
export type SettingsRow = {
  clinic_name: string; global_dormant_days: number; recall_window_days: number; snooze_days: number;
  templates: Settings['templates'];
};

export function rowToTreatment(r: TreatmentRow): Treatment {
  return { id: r.id, name: r.name, recallDays: r.recall_days };
}

export function treatmentToRow(t: Partial<Treatment>): Partial<TreatmentRow> {
  return {
    ...(t.id !== undefined && { id: t.id }),
    ...(t.name !== undefined && { name: t.name }),
    ...(t.recallDays !== undefined && { recall_days: t.recallDays }),
  };
}

export function rowToPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone,
    email: r.email,
    birthDate: r.birth_date ?? '',
    tags: r.tags,
    notes: r.notes,
    doNotContact: r.do_not_contact,
    createdAt: r.created_at.slice(0, 10),
  };
}

export function patientToRow(p: Partial<Patient>): Partial<PatientRow> {
  return {
    ...(p.id !== undefined && { id: p.id }),
    ...(p.firstName !== undefined && { first_name: p.firstName }),
    ...(p.lastName !== undefined && { last_name: p.lastName }),
    ...(p.phone !== undefined && { phone: p.phone }),
    ...(p.email !== undefined && { email: p.email }),
    ...(p.birthDate !== undefined && { birth_date: p.birthDate === '' ? null : p.birthDate }),
    ...(p.tags !== undefined && { tags: p.tags }),
    ...(p.notes !== undefined && { notes: p.notes }),
    ...(p.doNotContact !== undefined && { do_not_contact: p.doNotContact }),
    ...(p.createdAt !== undefined && { created_at: p.createdAt }),
  };
}

export function rowToVisit(r: VisitRow): Visit {
  return { id: r.id, patientId: r.patient_id, treatmentId: r.treatment_id, date: r.date, notes: r.notes };
}

export function visitToRow(v: Visit): VisitRow {
  return { id: v.id, patient_id: v.patientId, treatment_id: v.treatmentId, date: v.date, notes: v.notes };
}

export function rowToContact(r: ContactRow): ContactAttempt {
  return {
    id: r.id,
    patientId: r.patient_id,
    date: r.date,
    channel: r.channel,
    ...(r.snooze_until !== null && { snoozeUntil: r.snooze_until }),
  };
}

export function contactToRow(c: ContactAttempt): ContactRow {
  return { id: c.id, patient_id: c.patientId, date: c.date, channel: c.channel, snooze_until: c.snoozeUntil ?? null };
}

export function rowToSettings(r: SettingsRow): Settings {
  return {
    clinicName: r.clinic_name,
    globalDormantDays: r.global_dormant_days,
    recallWindowDays: r.recall_window_days,
    snoozeDays: r.snooze_days,
    templates: r.templates,
  };
}

export function settingsToRow(s: Partial<Settings>): Partial<SettingsRow> {
  return {
    ...(s.clinicName !== undefined && { clinic_name: s.clinicName }),
    ...(s.globalDormantDays !== undefined && { global_dormant_days: s.globalDormantDays }),
    ...(s.recallWindowDays !== undefined && { recall_window_days: s.recallWindowDays }),
    ...(s.snoozeDays !== undefined && { snooze_days: s.snoozeDays }),
    ...(s.templates !== undefined && { templates: s.templates }),
  };
}
```

- [ ] **Step 4: Esegui, deve passare**

Run: `npx vitest run tests/mappers.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers.ts tests/mappers.test.ts
git commit -m "feat(data): mapper riga Supabase <-> modello dominio"
```

---

### Task 4: `supabaseRepository` con client finto

**Files:**
- Create: `src/data/supabaseClient.ts`
- Create: `src/data/supabaseRepository.ts`
- Create: `tests/fakeSupabase.ts`
- Test: `tests/supabaseRepository.test.ts`
- Modify: `package.json` (dipendenza)

**Interfaces:**
- Consumes: mapper di Task 3, `Repository` di Task 2.
- Produces:

```ts
// src/data/supabaseClient.ts
export function getSupabase(): SupabaseClient;   // singleton da VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// src/data/supabaseRepository.ts
export function createSupabaseRepository(client: SupabaseClient, ownerId: string): Repository;
```

Errore Postgres `23503` (foreign key) su `deleteTreatment` → `new Error('Trattamento in uso, non eliminabile')`. Ogni altro errore → `new Error(error.message)`.

- [ ] **Step 1: Installa la dipendenza**

```bash
npm install @supabase/supabase-js@^2
```

- [ ] **Step 2: Scrivi il client finto**

`tests/fakeSupabase.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, string, unknown]> };
type Result = { data: unknown; error: { code?: string; message: string } | null };

/** Registra ogni chiamata e risponde con i risultati preimpostati per tabella. */
export function fakeSupabase(results: Record<string, Result | (() => Result)> = {}) {
  const calls: Call[] = [];

  function query(table: string) {
    const call: Call = { table, op: '', filters: [] };
    calls.push(call);
    const q = {
      select: () => { call.op = 'select'; return q; },
      insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return q; },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return q; },
      delete: () => { call.op = 'delete'; return q; },
      eq: (col: string, val: unknown) => { call.filters.push([col, 'eq', val]); return q; },
      order: () => q,
      single: () => q,
      then: (resolve: (r: Result) => void) => {
        const r = results[table];
        resolve(typeof r === 'function' ? r() : r ?? { data: [], error: null });
      },
    };
    return q;
  }

  const client = { from: query } as unknown as SupabaseClient;
  return { client, calls };
}
```

- [ ] **Step 3: Scrivi il test**

`tests/supabaseRepository.test.ts`:

```ts
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
```

- [ ] **Step 4: Esegui, deve fallire**

Run: `npx vitest run tests/supabaseRepository.test.ts`
Expected: FAIL, `Cannot find module '../src/data/supabaseRepository'`

- [ ] **Step 5: Implementa**

`src/data/supabaseClient.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY mancanti');
  client = createClient(url, key);
  return client;
}
```

`src/data/supabaseRepository.ts`:

```ts
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
    async deleteTreatment(id) { check((await client.from('treatments').delete().eq('id', id)).error); },
    async updateSettings(changes) { check((await client.from('settings').update(settingsToRow(changes)).eq('owner_id', ownerId)).error); },
  };
}
```

- [ ] **Step 6: Esegui, deve passare**

Run: `npx vitest run tests/supabaseRepository.test.ts`
Expected: PASS (5 test)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/data/supabaseClient.ts src/data/supabaseRepository.ts tests/fakeSupabase.ts tests/supabaseRepository.test.ts
git commit -m "feat(data): repository Supabase con mapping errori"
```

---

### Task 5: `persist` (Action → Repository) e `createRepository`

**Files:**
- Create: `src/data/persist.ts`
- Create: `src/data/index.ts`
- Test: `tests/persist.test.ts`, `tests/createRepository.test.ts`

**Interfaces:**
- Consumes: `Repository` (Task 2), `createLocalRepository` (Task 2), `createSupabaseRepository` + `getSupabase` (Task 4), `Action` da `src/store/actions.ts`.
- Produces:

```ts
// src/data/persist.ts
export function persist(repo: Repository, action: Action): Promise<void>;
// src/data/index.ts
export const BACKEND: 'supabase' | 'local';
export const isDemo: boolean;                       // BACKEND !== 'supabase'
export function createRepository(ownerId: string, today: string): Repository;
```

- [ ] **Step 1: Scrivi i test**

`tests/persist.test.ts`:

```ts
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
```

`tests/createRepository.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('createRepository', () => {
  it('defaults to local and isDemo=true', async () => {
    vi.stubEnv('VITE_DATA_BACKEND', '');
    const mod = await import('../src/data/index');
    expect(mod.BACKEND).toBe('local');
    expect(mod.isDemo).toBe(true);
    const repo = mod.createRepository('u', '2026-09-17');
    expect(typeof repo.replaceState).toBe('function');
  });

  it('selects supabase and isDemo=false', async () => {
    vi.stubEnv('VITE_DATA_BACKEND', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    const mod = await import('../src/data/index');
    expect(mod.BACKEND).toBe('supabase');
    expect(mod.isDemo).toBe(false);
    const repo = mod.createRepository('u', '2026-09-17');
    expect(repo.replaceState).toBeUndefined();
  });
});
```

- [ ] **Step 2: Esegui, deve fallire**

Run: `npx vitest run tests/persist.test.ts tests/createRepository.test.ts`
Expected: FAIL, moduli mancanti

- [ ] **Step 3: Implementa**

`src/data/persist.ts`:

```ts
import type { Action } from '../store/actions';
import type { Repository } from './repository';

/** Traduce un'azione del reducer nella chiamata Repository corrispondente. */
export function persist(repo: Repository, action: Action): Promise<void> {
  switch (action.type) {
    case 'ADD_PATIENT': return repo.addPatient(action.patient);
    case 'UPDATE_PATIENT': return repo.updatePatient(action.id, action.changes);
    case 'DELETE_PATIENT': return repo.deletePatient(action.id);
    case 'ADD_VISIT': return repo.addVisit(action.visit);
    case 'DELETE_VISIT': return repo.deleteVisit(action.id);
    case 'ADD_CONTACT': return repo.addContact(action.contact);
    case 'ADD_TREATMENT': return repo.addTreatment(action.treatment);
    case 'UPDATE_TREATMENT': return repo.updateTreatment(action.id, action.changes);
    case 'DELETE_TREATMENT': return repo.deleteTreatment(action.id);
    case 'UPDATE_SETTINGS': return repo.updateSettings(action.changes);
    case 'REPLACE_STATE':
      if (!repo.replaceState) return Promise.reject(new Error('Operazione non disponibile'));
      return repo.replaceState(action.state);
  }
}
```

`src/data/index.ts`:

```ts
import type { Repository } from './repository';
import { createLocalRepository } from './localRepository';

export const BACKEND: 'supabase' | 'local' = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'local';
export const isDemo = BACKEND !== 'supabase';

export function createRepository(ownerId: string, today: string): Repository {
  if (BACKEND === 'supabase') {
    // import statico: il bundle demo include comunque il client, ma non lo istanzia mai
    return createSupabaseRepositoryFromEnv(ownerId);
  }
  return createLocalRepository(today);
}

import { createSupabaseRepository } from './supabaseRepository';
import { getSupabase } from './supabaseClient';

function createSupabaseRepositoryFromEnv(ownerId: string): Repository {
  return createSupabaseRepository(getSupabase(), ownerId);
}
```

Sposta i due `import` in testa al file (sono qui per leggibilità del piano; TypeScript li accetta ovunque ma oxlint preferisce in testa).

- [ ] **Step 4: Esegui, deve passare**

Run: `npx vitest run tests/persist.test.ts tests/createRepository.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/data/persist.ts src/data/index.ts tests/persist.test.ts tests/createRepository.test.ts
git commit -m "feat(data): persist per azione e scelta backend da env"
```

---

### Task 6: Toast e `AppProvider` asincrono con coda e rollback

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/store/AppContext.tsx`
- Modify: `vite.config.ts` (test include `.tsx`)
- Modify: `package.json` (devDependencies)
- Test: `tests/appProvider.test.tsx`

**Interfaces:**
- Consumes: `Repository`, `LoadResult` (Task 2), `persist` (Task 5), `createRepository` (Task 5), `reducer` (`src/store/actions.ts`).
- Produces:

```ts
// src/components/Toast.tsx
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element;
export function useToast(): { show: (message: string) => void };

// src/store/AppContext.tsx
export function realToday(): string;
export function AppProvider({ repository, children }: { repository: Repository; children: ReactNode }): JSX.Element;
export function useApp(): { state: AppState; dispatch: (a: Action) => void; resetReason: ResetReason };
export function useToday(): string;
```

`AppProvider` riceve il repository come prop (chi lo monta lo crea: Task 7). Comportamento:
- mount → `loading` (spinner a tutto schermo) → `repository.loadAll()` → `ready`; su errore → schermata "Impossibile caricare i dati" con pulsante "Riprova".
- `dispatch(action)`: `next = reducer(current, action)`; se `next === current` non fa nulla; altrimenti aggiorna subito lo stato e accoda `{ action, snapshot: current }`.
- Coda FIFO: una `persist` alla volta. Su rifiuto: stato = `snapshot` dell'azione fallita, coda svuotata, `toast.show(err.message || 'Salvataggio fallito, riprova')`.

- [ ] **Step 1: Installa Testing Library e abilita `.tsx` nei test**

```bash
npm install -D @testing-library/react@^16 @testing-library/dom@^10
```

`vite.config.ts`, riga `include`:

```ts
    include: ['tests/**/*.test.{ts,tsx}'],
```

- [ ] **Step 2: Scrivi il test**

`tests/appProvider.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../src/store/AppContext';
import { ToastProvider } from '../src/components/Toast';
import type { Repository } from '../src/data/repository';
import { patient, state } from './fixtures';

type Deferred = { resolve: () => void; reject: (e: Error) => void };

function repoWith(overrides: Partial<Repository> = {}): Repository {
  return {
    loadAll: vi.fn().mockResolvedValue({ state: state(), resetReason: null }),
    addPatient: vi.fn().mockResolvedValue(undefined),
    updatePatient: vi.fn().mockResolvedValue(undefined),
    deletePatient: vi.fn().mockResolvedValue(undefined),
    addVisit: vi.fn().mockResolvedValue(undefined),
    deleteVisit: vi.fn().mockResolvedValue(undefined),
    addContact: vi.fn().mockResolvedValue(undefined),
    addTreatment: vi.fn().mockResolvedValue(undefined),
    updateTreatment: vi.fn().mockResolvedValue(undefined),
    deleteTreatment: vi.fn().mockResolvedValue(undefined),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let captured: ReturnType<typeof useApp> | null = null;
function Probe() {
  captured = useApp();
  return <span data-testid="count">{captured.state.patients.length}</span>;
}

function mount(repo: Repository) {
  return render(
    <ToastProvider>
      <AppProvider repository={repo}><Probe /></AppProvider>
    </ToastProvider>,
  );
}

describe('AppProvider', () => {
  it('shows spinner then renders loaded state', async () => {
    mount(repoWith());
    expect(screen.getByText('Caricamento…')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('shows error screen with retry when loadAll fails', async () => {
    const loadAll = vi.fn().mockRejectedValueOnce(new Error('rete')).mockResolvedValue({ state: state(), resetReason: null });
    mount(repoWith({ loadAll }));
    await waitFor(() => expect(screen.getByText('Impossibile caricare i dati')).toBeTruthy());
    act(() => { screen.getByText('Riprova').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(loadAll).toHaveBeenCalledTimes(2);
  });

  it('applies optimistically and persists in order', async () => {
    const order: string[] = [];
    const d: Deferred[] = [];
    const pending = () => new Promise<void>((resolve, reject) => d.push({ resolve, reject }));
    const repo = repoWith({
      addPatient: vi.fn((p) => { order.push('add:' + p.id); return pending(); }),
      updatePatient: vi.fn((id) => { order.push('upd:' + id); return pending(); }),
    });
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      captured!.dispatch({ type: 'ADD_PATIENT', patient: patient('a') });
      captured!.dispatch({ type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'n' } });
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(order).toEqual(['add:a']);            // la seconda aspetta la prima
    await act(async () => { d[0].resolve(); });
    await waitFor(() => expect(order).toEqual(['add:a', 'upd:a']));
    await act(async () => { d[1].resolve(); });
    expect(captured!.state.patients[0].notes).toBe('n');
  });

  it('rolls back to pre-action snapshot, drops the queue and shows a toast on failure', async () => {
    const d: Deferred[] = [];
    const pending = () => new Promise<void>((resolve, reject) => d.push({ resolve, reject }));
    const repo = repoWith({
      addPatient: vi.fn(() => pending()),
      updatePatient: vi.fn(() => pending()),
    });
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      captured!.dispatch({ type: 'ADD_PATIENT', patient: patient('a') });
      captured!.dispatch({ type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'n' } });
    });
    await act(async () => { d[0].reject(new Error('Salvataggio fallito')); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(screen.getByText('Salvataggio fallito')).toBeTruthy();
    expect(repo.updatePatient).not.toHaveBeenCalled();
  });

  it('ignores actions that do not change state', async () => {
    const repo = repoWith();
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    act(() => { captured!.dispatch({ type: 'DELETE_PATIENT', id: 'missing' }); });
    // DELETE_PATIENT su id inesistente produce un nuovo oggetto ma uguale: qui ci basta che non esploda.
    act(() => { captured!.dispatch({ type: 'DELETE_TREATMENT', id: 't-botox' }); });
    expect(repo.deleteTreatment).toHaveBeenCalledWith('t-botox');
  });
});
```

Nota: l'ultimo test verifica solo che `DELETE_TREATMENT` senza visite venga persistito; il caso "reducer restituisce lo stesso oggetto" è `DELETE_TREATMENT` con visite collegate, coperto in `tests/reducer.test.ts`.

- [ ] **Step 3: Esegui, deve fallire**

Run: `npx vitest run tests/appProvider.test.tsx`
Expected: FAIL, `Cannot find module '../src/components/Toast'` oppure `AppProvider` non accetta `repository`.

- [ ] **Step 4: Implementa `Toast.tsx`**

```tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastCtx = { show: (message: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((m: string) => {
    setMessage(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 5000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {message && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-sm text-white shadow">
          {message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
```

- [ ] **Step 5: Riscrivi `AppContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from '../domain/types';
import { toISODate } from '../domain/dates';
import type { ResetReason } from '../data/storage';
import type { Repository } from '../data/repository';
import { persist } from '../data/persist';
import { reducer, type Action } from './actions';
import { useToast } from '../components/Toast';

type Ctx = { state: AppState; dispatch: (a: Action) => void; resetReason: ResetReason };
const AppContext = createContext<Ctx | null>(null);

export function realToday(): string {
  return toISODate(new Date());
}

type Status = 'loading' | 'ready' | 'error';
type Pending = { action: Action; snapshot: AppState };

export function AppProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [state, setStateRaw] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const queue = useRef<Pending[]>([]);
  const pumping = useRef(false);
  const toast = useToast();

  const setState = useCallback((s: AppState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    repository.loadAll().then(
      (r) => {
        if (cancelled) return;
        setState(r.state);
        setResetReason(r.resetReason);
        setStatus('ready');
      },
      () => { if (!cancelled) setStatus('error'); },
    );
    return () => { cancelled = true; };
  }, [repository, attempt, setState]);

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    while (queue.current.length > 0) {
      const item = queue.current[0];
      try {
        await persist(repository, item.action);
        queue.current.shift();
      } catch (err) {
        queue.current = [];
        setState(item.snapshot);
        toast.show((err as Error).message || 'Salvataggio fallito, riprova');
      }
    }
    pumping.current = false;
  }, [repository, setState, toast]);

  const dispatch = useCallback((action: Action) => {
    const current = stateRef.current;
    if (!current) return;
    const next = reducer(current, action);
    if (next === current) return;
    setState(next);
    queue.current.push({ action, snapshot: current });
    void pump();
  }, [pump, setState]);

  const value = useMemo(
    () => (state ? { state, dispatch, resetReason } : null),
    [state, dispatch, resetReason],
  );

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-700">
        <p>Impossibile caricare i dati</p>
        <button onClick={() => setAttempt((n) => n + 1)} className="rounded border px-3 py-1 text-sm">Riprova</button>
      </div>
    );
  }
  if (status === 'loading' || !value) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Caricamento…</div>;
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useToday(): string {
  const { state } = useApp();
  return state.settings.simulatedToday ?? realToday();
}
```

- [ ] **Step 6: Adatta `App.tsx` provvisoriamente (compila finché Task 7 non lo sostituisce)**

```tsx
import { useMemo } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, realToday } from './store/AppContext';
import { ToastProvider } from './components/Toast';
import { createRepository } from './data';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  const repository = useMemo(() => createRepository('local', realToday()), []);
  return (
    <ToastProvider>
      <AppProvider repository={repository}>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 7: Esegui tutto**

Run: `npm test && npm run build`
Expected: tutti i test PASS (vecchi + nuovi), build ok. Se `tests/smoke.test.ts` importa `AppProvider` senza `repository`, aggiornalo passando `createLocalRepository('2026-09-17')`.

- [ ] **Step 8: Verifica demo a mano**

```bash
npm run dev
```

Apri l'URL: i dati demo compaiono come prima, crea un paziente, ricarica la pagina: resta.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(store): AppProvider asincrono con dispatch ottimistico, coda e rollback"
```

---

### Task 7: Auth — `AuthProvider`, login, reset password, `RequireAuth`

**Files:**
- Create: `src/auth/AuthContext.tsx`
- Create: `src/auth/RequireAuth.tsx`
- Create: `src/pages/Login.tsx`
- Create: `src/pages/ResetPassword.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isDemo`, `createRepository` (Task 5), `getSupabase` (Task 4), `AppProvider` (Task 6).
- Produces:

```ts
export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; userId: string; email: string };
export function AuthProvider({ children }): JSX.Element;
export function useAuth(): AuthState & { signIn(email, password): Promise<string | null>; signOut(): Promise<void>; resetPassword(email): Promise<string | null>; updatePassword(p): Promise<string | null> };
```

I metodi restituiscono `null` se ok, altrimenti il messaggio d'errore in italiano.

- [ ] **Step 1: `AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isDemo } from '../data';
import { getSupabase } from '../data/supabaseClient';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; userId: string; email: string };

type Methods = {
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<string | null>;
  updatePassword(password: string): Promise<string | null>;
};

const Ctx = createContext<(AuthState & Methods) | null>(null);

const DEMO: AuthState = { status: 'signedIn', userId: 'demo', email: 'demo@example.com' };

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email o password errati';
  if (/rate limit/i.test(message)) return 'Troppi tentativi, riprova tra qualche minuto';
  if (/password should be at least/i.test(message)) return 'La password deve avere almeno 6 caratteri';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(isDemo ? DEMO : { status: 'loading' });

  useEffect(() => {
    if (isDemo) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setAuth(u ? { status: 'signedIn', userId: u.id, email: u.email ?? '' } : { status: 'signedOut' });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setAuth(u ? { status: 'signedIn', userId: u.id, email: u.email ?? '' } : { status: 'signedOut' });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const methods = useMemo<Methods>(() => {
    if (isDemo) {
      return {
        signIn: async () => null,
        signOut: async () => {},
        resetPassword: async () => null,
        updatePassword: async () => null,
      };
    }
    const supabase = getSupabase();
    return {
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? translate(error.message) : null;
      },
      async signOut() { await supabase.auth.signOut(); },
      async resetPassword(email) {
        const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return error ? translate(error.message) : null;
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        return error ? translate(error.message) : null;
      },
    };
  }, []);

  const value = useMemo(() => ({ ...auth, ...methods }), [auth, methods]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: `RequireAuth.tsx`**

```tsx
import { useMemo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppProvider, realToday } from '../store/AppContext';
import { createRepository } from '../data';

export default function RequireAuth() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const repository = useMemo(() => (userId ? createRepository(userId, realToday()) : null), [userId]);

  if (auth.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Caricamento…</div>;
  }
  if (!repository) return <Navigate to="/login" replace />;
  return (
    <AppProvider repository={repository}>
      <Outlet />
    </AppProvider>
  );
}
```

- [ ] **Step 3: `Login.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.status === 'signedIn') return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    const err = await auth.signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  async function onForgot() {
    if (!email) { setError('Inserisci la tua email, poi premi di nuovo'); return; }
    setError(''); setInfo('');
    const err = await auth.resetPassword(email);
    if (err) setError(err); else setInfo('Email inviata: controlla la posta per reimpostare la password');
  }

  const field = 'w-full rounded border px-3 py-2 text-sm';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">Accedi</h1>
        <label className="block text-sm">Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required />
        </label>
        <label className="block text-sm">Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button type="submit" disabled={busy} className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <button type="button" onClick={onForgot} className="w-full text-xs text-slate-500 hover:text-slate-800">Password dimenticata</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: `ResetPassword.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Le password non coincidono'); return; }
    const err = await auth.updatePassword(password);
    if (err) setError(err); else navigate('/', { replace: true });
  }

  const field = 'w-full rounded border px-3 py-2 text-sm';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">Nuova password</h1>
        {auth.status !== 'signedIn' && <p className="text-sm text-slate-500">Apri questa pagina dal link ricevuto via email.</p>}
        <label className="block text-sm">Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required minLength={6} />
        </label>
        <label className="block text-sm">Conferma password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} required minLength={6} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={auth.status !== 'signedIn'} className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salva</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: `App.tsx` definitivo**

```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/patients/:id" element={<PatientDetail />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 6: Test e build**

Run: `npm test && npm run build`
Expected: PASS, build ok.

- [ ] **Step 7: Prova con Supabase reale**

Crea `.env.local`:

```
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://tsclykbqwmiytqpvxayn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

```bash
npm run dev
```

1. Apri l'app: appare `/login`.
2. Entra con `test-a@example.com`: dashboard vuota, 8 trattamenti in Impostazioni.
3. Crea un paziente, ricarica: resta.
4. Nella Network tab la insert su `patients` risponde 201.

- [ ] **Step 8: Commit**

```bash
git add src/auth src/pages/Login.tsx src/pages/ResetPassword.tsx src/App.tsx
git commit -m "feat(auth): login email+password, reset password e route protette"
```

---

### Task 8: UI condizionata al backend — banner, Impostazioni, logout

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `isDemo` (Task 5), `useAuth` (Task 7), `useToast` (Task 6).

- [ ] **Step 1: `Layout.tsx` — banner solo demo, logout solo produzione**

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import DemoBanner from './DemoBanner';
import { useApp } from '../store/AppContext';
import { useAuth } from '../auth/AuthContext';
import { isDemo } from '../data';

const links = [
  { to: '/', label: 'Richiami' },
  { to: '/patients', label: 'Pazienti' },
  { to: '/stats', label: 'Statistiche' },
  { to: '/settings', label: 'Impostazioni' },
];

export default function Layout() {
  const { state } = useApp();
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isDemo && <DemoBanner />}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold">{state.settings.clinicName}</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          {!isDemo && (
            <button onClick={() => auth.signOut()} className="ml-auto text-sm text-slate-500 hover:text-slate-900">Esci</button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: `Settings.tsx` — sezione Demo condizionata, sezione Account**

Modifiche puntuali:

1. Import in testa:

```tsx
import { isDemo } from '../data';
import { useAuth } from '../auth/AuthContext';
```

2. Dentro il componente, dopo `const s = state.settings;`:

```tsx
  const auth = useAuth();
  const [pwd, setPwd] = useState({ next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword() {
    if (pwd.next.length < 6) { setPwdMsg({ ok: false, text: 'Almeno 6 caratteri' }); return; }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ ok: false, text: 'Le password non coincidono' }); return; }
    const err = await auth.updatePassword(pwd.next);
    setPwdMsg(err ? { ok: false, text: err } : { ok: true, text: 'Password aggiornata' });
    if (!err) setPwd({ next: '', confirm: '' });
  }
```

3. Sostituisci l'intera `<section>` "Demo" con:

```tsx
      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">{isDemo ? 'Demo' : 'Dati'}</h2>
        {isDemo && (
          <label className="block text-sm">Simula data odierna
            <div className="flex gap-2">
              <input type="date" value={s.simulatedToday ?? ''} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: e.target.value || undefined } })} className={field} />
              <button onClick={() => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: undefined } })} className="rounded border px-3 py-1 text-sm">Azzera</button>
            </div>
          </label>
        )}
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={download} className="rounded border px-3 py-1">Esporta JSON</button>
          {isDemo && (
            <>
              <label className="cursor-pointer rounded border px-3 py-1">
                Importa JSON
                <input type="file" accept="application/json" onChange={onImport} className="hidden" />
              </label>
              <button onClick={() => setConfirmReset(true)} className="rounded border border-red-300 px-3 py-1 text-red-700">Reset dati demo</button>
            </>
          )}
        </div>
        {importError && <p className="text-sm text-red-600">{importError}</p>}
      </section>

      {!isDemo && (
        <section className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Account</h2>
          <p className="text-sm text-slate-600">{auth.status === 'signedIn' ? auth.email : ''}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>Nuova password
              <input type="password" autoComplete="new-password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className={field} />
            </label>
            <label>Conferma
              <input type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className={field} />
            </label>
          </div>
          <button onClick={changePassword} className="rounded border px-3 py-1 text-sm">Cambia password</button>
          {pwdMsg && <p className={`text-sm ${pwdMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{pwdMsg.text}</p>}
        </section>
      )}
```

- [ ] **Step 3: Test, lint, build**

Run: `npm test && npm run lint && npm run build`
Expected: tutto verde.

- [ ] **Step 4: Verifica a mano in entrambi i backend**

1. Senza `.env.local` (rinominalo temporaneamente): banner demo visibile, sezione Demo completa, nessun "Esci".
2. Con `.env.local` Supabase: nessun banner, sezione "Dati" con solo "Esporta JSON", sezione Account con cambio password, "Esci" funziona e porta a `/login`.
3. In produzione: elimina un trattamento senza visite → sparisce; il pulsante resta disabilitato per quelli in uso.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/pages/Settings.tsx
git commit -m "feat(ui): controlli demo solo in locale, logout e cambio password in produzione"
```

---

### Task 9: Build per ambiente, deploy, keep-alive, checklist

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (script)
- Create: `.github/workflows/keepalive.yml`
- Create: `docs/CHECKLIST-PROD.md`
- Modify: `README.md`

- [ ] **Step 1: `vite.config.ts` con `base` da env**

```ts
/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});
```

- [ ] **Step 2: Script `package.json`**

Sostituisci `predeploy` e `deploy`:

```json
    "predeploy": "VITE_BASE_PATH=/plastic-crm/ VITE_DATA_BACKEND=local npm run build",
    "deploy": "gh-pages -d dist"
```

- [ ] **Step 3: Verifica i due build**

```bash
npm run build && grep -o 'src="[^"]*"' dist/index.html
```

Expected: percorsi che iniziano con `/assets/`.

```bash
VITE_BASE_PATH=/plastic-crm/ VITE_DATA_BACKEND=local npm run build && grep -o 'src="[^"]*"' dist/index.html
```

Expected: percorsi che iniziano con `/plastic-crm/assets/`.

- [ ] **Step 4: Keep-alive**

`.github/workflows/keepalive.yml`:

```yaml
name: Supabase keep-alive

on:
  schedule:
    - cron: '17 6 */3 * *'   # ogni 3 giorni alle 06:17 UTC
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Query settings
        run: |
          curl --fail --silent --show-error \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/settings?select=owner_id&limit=1"
```

Poi nel repo GitHub: Settings > Secrets and variables > Actions > New repository secret: `SUPABASE_URL` = `https://tsclykbqwmiytqpvxayn.supabase.co`, `SUPABASE_ANON_KEY` = anon key. Lancia una volta a mano da Actions > "Supabase keep-alive" > Run workflow: deve finire verde (risposta `[]`, RLS filtra tutto, ma la richiesta conta come attività).

- [ ] **Step 5: Cloudflare Pages**

1. dash.cloudflare.com > Workers & Pages > Create > Pages > Connect to Git > repo `Scoppx/plastic-crm`.
2. Build command: `npm run build`. Build output: `dist`. Branch di produzione: `main`.
3. Environment variables (Production): `VITE_DATA_BACKEND=supabase`, `VITE_SUPABASE_URL=https://tsclykbqwmiytqpvxayn.supabase.co`, `VITE_SUPABASE_ANON_KEY=<anon key>`, `NODE_VERSION=20`.
4. Deploy. Apri `https://<progetto>.pages.dev`: pagina di login.
5. Supabase > Authentication > URL Configuration: Site URL = `https://<progetto>.pages.dev`, Redirect URLs aggiungi `https://<progetto>.pages.dev/**` e `http://localhost:5173/**`.

- [ ] **Step 6: `docs/CHECKLIST-PROD.md`**

```markdown
# Checklist produzione

Da eseguire su https://<progetto>.pages.dev con due utenti (`test-a`, `test-b`).

- [ ] Apertura senza sessione → pagina Accedi
- [ ] Login errato → "Email o password errati"
- [ ] Login test-a → dashboard, 8 trattamenti in Impostazioni, nessun banner demo
- [ ] Crea paziente, visita, contatto → ricarica pagina → tutto presente
- [ ] Secondo browser (o telefono) con test-a → stessi dati
- [ ] Login test-b → nessun paziente di test-a
- [ ] Impostazioni: cambia nome studio → ricarica → resta
- [ ] Impostazioni: elimina trattamento senza visite → sparisce; con visite → pulsante disabilitato
- [ ] Impostazioni: cambia password → logout → login con la nuova
- [ ] Password dimenticata → email ricevuta → link apre /reset-password → nuova password funziona
- [ ] Esci → torna ad Accedi; ricarica → resta su Accedi
- [ ] Rete off (DevTools) → crea paziente → toast "Salvataggio fallito" e paziente sparisce
- [ ] Demo su GitHub Pages ancora funzionante con banner e reset
- [ ] Actions > Supabase keep-alive → run verde
```

- [ ] **Step 7: README**

Sostituisci la sezione "Deploy" con:

```markdown
## Ambienti

| | Demo | Produzione |
|---|---|---|
| Backend | `VITE_DATA_BACKEND=local` (localStorage, seed) | `VITE_DATA_BACKEND=supabase` |
| Hosting | GitHub Pages, `npm run deploy` | Cloudflare Pages, build automatica da `main` |

Variabili in `.env.example`. Per sviluppare contro Supabase copia `.env.example` in `.env.local` e compila URL e anon key.

Schema DB in `supabase/migrations`, applicato con `supabase db push`. Checklist di rilascio in `docs/CHECKLIST-PROD.md`.
```

- [ ] **Step 8: Esegui la checklist**

Compila `docs/CHECKLIST-PROD.md` punto per punto. Ogni riga non spuntata è un bug da aprire prima di consegnare al medico.

- [ ] **Step 9: Commit e deploy demo**

```bash
git add vite.config.ts package.json .github/workflows/keepalive.yml docs/CHECKLIST-PROD.md README.md
git commit -m "chore: build per ambiente, keep-alive Supabase, checklist produzione"
git push
npm run deploy
```

Verifica: https://scoppx.github.io/plastic-crm/ mostra la demo con banner; Cloudflare Pages ha ricostruito da `main`.

---

## Self-review

- Spec §3 schema → Task 1. §4 auth → Task 7 (+ Task 8 per logout/cambio password). §5 repository, mapper, AppProvider, toast → Task 2-6. §6 import xls → fuori scope, invariato. §7 deploy/keep-alive/banner → Task 8-9. §8 errori: `loadAll` fallito → Task 6; scrittura fallita → Task 6; `23503` → Task 4; sessione scaduta → `onAuthStateChange` in Task 7 porta a `signedOut` e `RequireAuth` reindirizza. §9 test → Task 2-6 + checklist Task 9.
- Deviazione dalla spec: `loadAll()` restituisce `{ state, resetReason }` (non solo `AppState`) perché `DemoBanner` mostra `resetReason`; la spec è aggiornata di conseguenza.
- Deviazione dalla spec: una policy `for all` per tabella invece di quattro per comando; equivalente.
- Nomi coerenti tra task: `createLocalRepository(today)`, `createSupabaseRepository(client, ownerId)`, `createRepository(ownerId, today)`, `persist(repo, action)`, `isDemo`, `useToast().show`, `AppProvider({ repository })`, `useAuth()` con `signIn/signOut/resetPassword/updatePassword`.
