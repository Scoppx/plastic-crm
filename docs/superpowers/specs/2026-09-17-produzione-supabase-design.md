# Plastic CRM — Produzione con Supabase

Data: 2026-09-17
Stato: approvato in chat, in attesa di revisione scritta
Spec precedente: `2026-09-10-plastic-crm-design.md` (demo, resta valida per tutto ciò che non è qui modificato)

## 1. Obiettivo

Portare la demo in produzione per un primo medico reale. I dati passano da
`localStorage` a un database online con login. L'app deve funzionare da più
dispositivi dello stesso medico e i dati devono sopravvivere alla cancellazione
della cache del browser.

Il modello dati e lo schema DB nascono già multi-tenant (un medico = un
account, ogni riga appartiene a un `owner_id`), così vendere ad altri medici
non richiede migrazioni. Non si costruisce ora niente di più (nessuno studio
con più utenti, nessun ruolo segretaria, nessuna fatturazione).

La demo pubblica su GitHub Pages resta viva, con seed e banner, come strumento
di vendita.

## 2. Vincoli

- Frontend invariato: Vite 5 + React 18 + TypeScript + Tailwind 4. Nessun
  backend custom.
- Supabase come DB (Postgres), auth e API. Progetto già creato, regione
  Frankfurt (EU), ref `tsclykbqwmiytqpvxayn`.
- Il dominio (`src/domain/`) e il reducer (`src/store/actions.ts`) non
  cambiano. Il layer dati si sostituisce sotto di loro.
- App online-only. Nessuna coda offline.
- Niente prezzi né valori economici (decisione del 2026-09-11, invariata).
- Lingua UI: italiano.
- Dati sanitari (GDPR art. 9): hosting EU, accesso solo con credenziali, RLS
  attiva su ogni tabella. La base giuridica dei richiami (consenso o rapporto
  di cura) è responsabilità del medico titolare del trattamento.

## 3. Schema DB

Migrazioni SQL versionate in `supabase/migrations/*.sql`, applicate con
Supabase CLI (`supabase db push`). Lo schema vive nel repo, non nella dashboard.

Colonne comuni a tutte le tabelle:

```sql
id         uuid primary key default gen_random_uuid(),
owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()   -- trigger set_updated_at()
```

Tabelle:

```sql
treatments (
  name        text not null,
  recall_days int  null,       -- null = nessun richiamo specifico
  sort        int  not null default 0
)

patients (
  first_name     text not null,
  last_name      text not null,
  phone          text not null default '',
  email          text not null default '',
  birth_date     date null,
  tags           text[] not null default '{}',
  notes          text not null default '',
  do_not_contact boolean not null default false
)

visits (
  patient_id   uuid not null references patients(id) on delete cascade,
  treatment_id uuid not null references treatments(id) on delete restrict,
  date         date not null,
  notes        text not null default ''
)

contacts (
  patient_id   uuid not null references patients(id) on delete cascade,
  date         date not null,
  channel      text not null check (channel in ('call','whatsapp','email')),
  snooze_until date null
)

settings (
  owner_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  clinic_name         text not null default 'Il mio studio',
  global_dormant_days int  not null default 180,
  recall_window_days  int  not null default 14,
  snooze_days         int  not null default 30,
  templates           jsonb not null,   -- { whatsapp: string, email: { subject, body } }
  updated_at          timestamptz not null default now()
)
```

`simulatedToday` non va in DB: è uno strumento demo e resta solo nello stato
locale del backend `local`.

Indici: `(owner_id)` su ogni tabella; `visits(patient_id)`; `contacts(patient_id)`;
`treatments(owner_id, sort)`.

Row Level Security attiva su tutte le tabelle, una policy `for all`
(select/insert/update/delete) per tabella con:

```sql
using (owner_id = auth.uid()) with check (owner_id = auth.uid())
```

Trigger `on insert` su `auth.users`: crea la riga `settings` con i default
(template presi da `DEFAULT_SETTINGS` di `src/domain/types.ts`) e gli 8
trattamenti di esempio del seed attuale (`src/data/seed.ts`). Un nuovo medico parte pronto.

`delete` su `treatments` con visite collegate fallisce per `on delete restrict`:
l'UI mostra "Trattamento in uso, non eliminabile" (comportamento già presente
in demo, ora garantito dal DB).

## 4. Auth e sessione

- Supabase Auth, email + password.
- Registrazione pubblica disattivata nella dashboard (Authentication >
  Sign In / Providers > "Allow new users to sign up" = off). Gli account li
  crea l'amministratore da Authentication > Users. Conferma email disattivata.
- Pagina `/login`: email, password, link "Password dimenticata" che usa il
  reset di Supabase (template email in italiano, redirect a `/reset-password`).
- Sessione persistita dal client Supabase in `localStorage`, refresh token
  automatico. Il medico riapre l'app e la trova loggata.
- `AuthProvider` (nuovo, in `src/auth/`) sopra `AppProvider`. Stato:
  `loading | signedOut | signedIn(user)`. Con `loading` si mostra uno spinner
  a tutto schermo; con `signedOut` ogni route protetta reindirizza a `/login`.
- Logout nel menu (`Layout`). Cambio password in Impostazioni.
- Con backend `local` l'`AuthProvider` è un passthrough: sempre `signedIn`
  con utente fittizio, nessuna pagina di login.

## 5. Layer dati

### Repository

`src/data/repository.ts`:

```ts
export interface Repository {
  loadAll(): Promise<{ state: AppState; resetReason: ResetReason }>; // resetReason serve al banner demo, null su Supabase
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

Due implementazioni:

- `src/data/localRepository.ts`: wrappa `storage.ts` attuale (seed, JSON in
  `localStorage`). Usato dalla demo pubblica e dai test. Implementa
  `replaceState`.
- `src/data/supabaseRepository.ts`: client `@supabase/supabase-js`. `loadAll`
  fa 5 select (una per tabella) in parallelo e compone `AppState` con
  `version: SCHEMA_VERSION`. Ogni metodo di scrittura fa una sola chiamata.
  Non implementa `replaceState`.

Scelta via `VITE_DATA_BACKEND=supabase|local` in `src/data/index.ts`
(`createRepository()`). Default `local` se la variabile manca, così `npm run
dev` senza `.env.local` continua a funzionare come oggi.

### Mapper

`src/data/mappers.ts`: funzioni pure `rowToPatient`/`patientToRow` e simili
per ogni tabella. Snake_case ↔ camelCase, `birth_date null` ↔ `birthDate ''`,
`templates jsonb` ↔ `Settings.templates`. Unico punto dove i due mondi si
toccano. Testato con round-trip.

### AppProvider

- Al mount chiama `repo.loadAll()`. Stato `loading` con spinner; su errore
  schermata "Impossibile caricare i dati" con pulsante Riprova.
- `dispatch(action)` diventa asincrono sotto il cofano: applica subito il
  reducer (aggiornamento ottimistico), poi chiama il metodo repo
  corrispondente. Se la chiamata fallisce: ripristina lo stato precedente
  all'azione e mostra un toast "Salvataggio fallito, riprova". Le azioni sono
  serializzate in una coda FIFO in memoria: la seconda parte quando la prima
  ha risposto, così il rollback è sempre coerente.
- `REPLACE_STATE` chiama `repo.replaceState`; se assente l'azione è vietata e
  l'UI non la espone (import JSON e reset demo compaiono solo con backend
  `local`). Export JSON resta su entrambi i backend come backup manuale.
- `saveState` su `localStorage` a ogni cambio di stato resta solo nel
  `localRepository`; con Supabase nessuna copia locale dei dati.
- ID generati lato client con `crypto.randomUUID()` (già così in demo), stesso
  id nel reducer e nel DB.

### Toast

Componente `Toast` minimo in `src/components/`, contesto `useToast()`. Usato
solo per errori di salvataggio. Nessuna libreria.

## 6. Import xls

Fuori scope di questa spec: il file del medico non è ancora disponibile.

Piano quando arriva: script una tantum `scripts/import-xlsx.ts` (Node,
libreria `xlsx`), mapping colonne scritto a mano dopo aver visto il file,
`--dry-run` che stampa il riepilogo (N pazienti, N visite, righe scartate con
motivo) prima di scrivere. Inserisce via Supabase con la `service_role` key
letta da variabile d'ambiente, mai committata. L'`owner_id` è passato
esplicitamente come argomento (uuid dell'utente medico).

## 7. Deploy, ambienti, keep-alive

Un solo repo, due deploy:

| | Demo | Produzione |
|---|---|---|
| Backend | `local` | `supabase` |
| Hosting | GitHub Pages (`npm run deploy`) | Cloudflare Pages, build automatica da `main` |
| Base URL | `/plastic-crm/` | `/` |
| Banner demo, data simulata, reset, import | sì | no |

- `vite.config.ts`: `base` da `process.env.VITE_BASE_PATH ?? '/'`. Lo script
  `deploy` (GitHub Pages) imposta `VITE_BASE_PATH=/plastic-crm/`.
- Router resta `HashRouter`: funziona su entrambi gli hosting senza rewrite.
- Variabili Cloudflare Pages: `VITE_DATA_BACKEND=supabase`,
  `VITE_SUPABASE_URL=https://tsclykbqwmiytqpvxayn.supabase.co`,
  `VITE_SUPABASE_ANON_KEY=<anon key>`. La anon key è pubblica per design;
  la sicurezza sta nelle policy RLS.
- `.env.local` per sviluppo, in `.gitignore`. `.env.example` committato con
  le chiavi vuote.
- Keep-alive free tier: workflow GitHub Actions `keepalive.yml`, cron ogni 3
  giorni, `curl` su `${SUPABASE_URL}/rest/v1/settings?select=owner_id&limit=1`
  con header `apikey`. URL e anon key come secrets del repo. Evita la pausa
  dopo 7 giorni di inattività.
- `DemoBanner` e i controlli demo di `Settings` leggono `isDemo` da
  `src/data/index.ts` (`VITE_DATA_BACKEND !== 'supabase'`).

## 8. Gestione errori

| Caso | Comportamento |
|---|---|
| `loadAll` fallisce (rete, sessione scaduta) | schermata errore con Riprova; se 401, logout e redirect a `/login` |
| scrittura fallisce | rollback ottimistico + toast |
| `delete treatment` con visite | errore DB `23503` mappato a messaggio "Trattamento in uso" |
| sessione scade durante l'uso | client Supabase tenta refresh; se fallisce, `AuthProvider` passa a `signedOut` |
| `localStorage` non disponibile | solo backend `local`: già gestito (in memoria) |

## 9. Test

- Test esistenti (`tests/*.test.ts`) restano verdi senza modifiche: dominio,
  reducer, storage locale, seed.
- Nuovi:
  - `tests/mappers.test.ts`: round-trip riga ↔ modello per ogni tabella,
    inclusi `birth_date null` e `templates jsonb`.
  - `tests/localRepository.test.ts`: `loadAll` equivale a `loadState`,
    ogni metodo persiste in `localStorage`.
  - `tests/appProvider.test.tsx` (React Testing Library, jsdom; estendere
    `test.include` in `vite.config.ts` a `.tsx`): con un
    repository finto, verifica aggiornamento ottimistico, rollback e toast
    su rifiuto, coda FIFO.
  - `tests/createRepository.test.ts`: scelta backend da variabile.
- Supabase reale: fuori dai test automatici. Checklist manuale in
  `docs/CHECKLIST-PROD.md`: login, crea paziente, visita, contatto, refresh
  pagina, secondo browser vede gli stessi dati, logout, utente B non vede
  dati di A, elimina trattamento in uso.

## 10. Fuori scope

- Studio con più utenti, ruoli, inviti.
- Coda offline / sync in background.
- Invio automatico di messaggi.
- Foto, allegati.
- Prezzi, valori economici, fatturazione.
- Import xls (spec separata quando arriva il file).
