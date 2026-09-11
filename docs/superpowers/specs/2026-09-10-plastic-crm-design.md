# Plastic CRM — Design

Data: 2026-09-10
Stato: bozza approvata in chat, in attesa di revisione scritta

## 1. Obiettivo

Demo/portfolio di un CRM per studi di chirurgia plastica ed estetica. Focus unico:
individuare i pazienti che non si fanno vivi da troppo tempo e aiutare lo studio a
ricontattarli con un messaggio precompilato. Tutto il resto (anagrafica, storico,
statistiche) esiste solo per sostenere quel flusso.

Non è un prodotto multi-tenant: un solo studio, dati fittizi, nessun backend.

## 2. Vincoli

- SPA statica, deploy su GitHub Pages. Nessun server.
- Persistenza in `localStorage`, con seed deterministico di dati finti al primo avvio.
- Nessun invio automatico di messaggi: l'app prepara il testo e apre WhatsApp/email
  tramite link (`wa.me`, `mailto:`) o lo copia negli appunti.
- Lingua UI: italiano. Badge fisso "DEMO — dati fittizi" in header.

## 3. Modello dati

```ts
type Treatment = {
  id: string;
  name: string;            // "Botox", "Filler labbra", "Rinoplastica"
  recallDays: number | null; // intervallo richiamo; null = nessun richiamo specifico
};

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;           // formato internazionale, es. +39333...
  email: string;
  birthDate: string;       // ISO date
  tags: string[];          // "VIP", "Nuovo", ...
  notes: string;
  doNotContact: boolean;
  createdAt: string;       // ISO date
};

type Visit = {
  id: string;
  patientId: string;
  treatmentId: string;
  date: string;            // ISO date
  notes: string;
};

type ContactAttempt = {
  id: string;
  patientId: string;
  date: string;            // ISO date
  channel: 'call' | 'whatsapp' | 'email';
  snoozeUntil?: string;    // ISO date, presente se l'utente ha scelto "Rimanda"
};

type Settings = {
  clinicName: string;
  globalDormantDays: number;   // default 180
  recallWindowDays: number;    // default 14: quanti giorni prima della scadenza compare in lista
  snoozeDays: number;          // default 30
  templates: {
    whatsapp: string;          // placeholder: {nome}, {trattamento}, {mesi}, {clinica}
    email: { subject: string; body: string };
  };
  simulatedToday?: string;     // ISO date, opzionale, per la demo
};

type AppState = {
  version: number;             // versione schema storage
  treatments: Treatment[];
  patients: Patient[];
  visits: Visit[];
  contacts: ContactAttempt[];
  settings: Settings;
};
```

## 4. Regola di richiamo

Funzione pura `computeRecalls(state, today): Recall[]`.

Per ogni paziente:

1. Se `doNotContact` è true: escluso.
2. Se non ha visite: escluso (non è "dormiente", non è mai stato attivo).
3. Calcolo `dueDate`:
   - Per ogni trattamento con `recallDays != null`, prendo l'ultima visita di quel
     trattamento e calcolo `visit.date + recallDays`. Candidato = il più vicino nel tempo.
   - Se nessun candidato (solo trattamenti senza richiamo), fallback:
     `lastVisit.date + globalDormantDays`.
   - Si considera sempre e solo l'ultima visita per trattamento: se il paziente è
     tornato per un altro trattamento, quel trattamento ha il suo ciclo e l'altro
     resta com'è. Nel fallback conta l'ultima visita in assoluto.
4. Esclusioni post-calcolo:
   - `snoozeUntil > today` su qualunque `ContactAttempt` del paziente: escluso.
   - Esiste un `ContactAttempt` senza `snoozeUntil` con `date >= dueDate - recallWindowDays`:
     escluso (già contattato per questo ciclo). I contatti di tipo "rimanda" non contano
     come contatto: scaduto lo snooze il paziente torna in lista.
5. Stato:
   - `overdue` se `dueDate < today`
   - `due` se `today <= dueDate <= today + recallWindowDays`
   - altrimenti non compare in lista.
6. Output per ogni riga:

```ts
type Recall = {
  patient: Patient;
  treatment: Treatment | null;   // null se fallback globale
  lastVisitDate: string;
  dueDate: string;
  daysOverdue: number;           // negativo se ancora "due"
  status: 'overdue' | 'due';
};
```

Ordinamento: `overdue` prima di `due`; a parità, `daysOverdue` decrescente; poi
cognome e nome del paziente (`localeCompare`).

## 5. Viste

### 5.1 Dashboard richiami (home, `#/`)

- KPI: pazienti dormienti (overdue), in scadenza (due), contattati negli ultimi 30 giorni (senza rimandi).
- Tabella `Recall[]` ordinata: nome, trattamento, ultima visita, giorni di ritardo, pulsante "Contatta".
- Filtri: stato, trattamento, tag. Ricerca per nome.

### 5.2 Drawer contatto

Aperto da "Contatta". Contiene:

- Riepilogo paziente (telefono, email, ultimo trattamento, note).
- Selettore canale: WhatsApp / Email / Chiamata.
- Messaggio precompilato da template con placeholder sostituiti (`fillTemplate`).
  Editabile prima dell'invio.
- Azioni: "Apri WhatsApp" (`https://wa.me/<phone>?text=<encoded>`), "Apri email"
  (`mailto:<email>?subject=&body=`), "Copia testo".
- "Segna contattato": crea `ContactAttempt` con canale e data odierna, chiude drawer.
- "Rimanda N giorni": crea `ContactAttempt` con `snoozeUntil = today + snoozeDays`.

### 5.3 Pazienti (`#/patients`)

Lista completa con ricerca (nome, telefono, email), filtro tag e trattamento
(ha almeno una visita di quel tipo). Colonna "prossimo richiamo" calcolata.
Pulsante "Nuovo paziente".

### 5.4 Dettaglio paziente (`#/patients/:id`)

- Anagrafica modificabile inline, tag (aggiungi/rimuovi), toggle "Non contattare", note.
- Prossimo richiamo calcolato con la stessa regola (anche se oltre la finestra).
- Timeline visite in ordine cronologico inverso. Form "Aggiungi visita":
  trattamento, data (default oggi), note.
- Storico contatti (data, canale, eventuale snooze).
- Elimina paziente (con conferma).

### 5.5 Statistiche (`#/stats`)

Funzione pura `computeStats(state, today)`:

- Totali: pazienti, attivi (visita negli ultimi `globalDormantDays`), dormienti, non contattabili.
- Richiami generati per mese, ultimi 6 mesi (grafico a barre).
- Tasso di recupero: contatti (senza snooze) seguiti da una visita dello stesso
  paziente entro 60 giorni / contatti totali.
- Dormienti e in scadenza per trattamento (barre orizzontali, conteggio pazienti).

Grafici con Recharts. Colori da palette neutra, leggibili in chiaro e scuro.

### 5.6 Impostazioni (`#/settings`)

- Nome clinica.
- Catalogo trattamenti: tabella modificabile (nome, giorni richiamo o vuoto), aggiungi/elimina.
  Un trattamento con visite associate non si può eliminare.
- Soglia globale, finestra richiamo, giorni di snooze.
- Template WhatsApp ed email, con legenda placeholder.
- "Simula data odierna": date picker; se impostato, tutta l'app usa quella data come
  `today`. Banner visibile finché attivo.
- "Esporta JSON" (download dello stato), "Importa JSON", "Reset dati demo" (con conferma).

## 6. Dati demo

`seed.ts` genera lo stato iniziale in modo deterministico (PRNG con seme fisso):

- 8 trattamenti: Botox (120gg), Filler labbra (270gg), Filler zigomi (365gg),
  Biorivitalizzazione (180gg), Peeling (90gg), Rinoplastica (null),
  Mastoplastica (null), Blefaroplastica (null).
- ~40 pazienti con nomi italiani, telefoni +39 finti, email finte.
- 1-6 visite ciascuno distribuite negli ultimi 24 mesi, in modo che al momento del
  seed circa 10-12 siano overdue, 4-6 due, il resto ok.
- Alcuni con tag "VIP", 2 con `doNotContact`, 3 con contatto recente, 1 con snooze attivo.

Le date del seed sono relative alla data di generazione, così la demo resta
sensata nel tempo.

## 7. Struttura tecnica

Stack: Vite, React 18, TypeScript, Tailwind CSS, react-router (HashRouter),
Recharts, date-fns, Vitest. Cartella progetto: `~/plastic-crm`.

```
src/
  domain/
    types.ts          tipi sopra
    recalls.ts        computeRecalls
    stats.ts          computeStats
    template.ts       fillTemplate(template, vars)
    dates.ts          helper su date-fns, "today" iniettato
  data/
    seed.ts           generatore deterministico
    storage.ts        load/save localStorage, chiave "plastic-crm", versione schema, migrazione o reset
  store/
    AppContext.tsx    Context + useReducer, azioni tipizzate, persistenza automatica
    actions.ts
  pages/
    Dashboard.tsx  Patients.tsx  PatientDetail.tsx  Stats.tsx  Settings.tsx
  components/
    Layout.tsx  KpiCard.tsx  RecallTable.tsx  ContactDrawer.tsx  PatientForm.tsx
    VisitTimeline.tsx  TagInput.tsx  ConfirmDialog.tsx  DemoBanner.tsx
  main.tsx  App.tsx
```

`today` viene da `settings.simulatedToday ?? new Date()`, calcolato in un hook
`useToday()` e passato alle funzioni di dominio: mai `new Date()` dentro `domain/`.

## 8. Errori e casi limite

- localStorage assente o corrotto (JSON non valido, `version` mancante o diversa
  senza migrazione): si carica il seed e si mostra un avviso una volta.
- Telefono senza prefisso: link WhatsApp assume `+39`.
- Paziente senza email: pulsante "Apri email" disabilitato. Senza telefono: WhatsApp disabilitato.
- Import JSON non valido: errore inline, stato invariato.

## 9. Test

Vitest, solo unit sul dominio e sullo storage:

- `computeRecalls`: richiamo per trattamento; fallback globale; più trattamenti prende
  il più vicino; `doNotContact`; snooze attivo / scaduto; contatto recente dentro/fuori
  finestra; paziente tornato dopo il contatto; ordinamento; stato `due` vs `overdue`.
- `computeStats`: conteggi, tasso di recupero con e senza visite successive.
- `fillTemplate`: sostituzione placeholder, placeholder mancante resta invariato.
- `storage`: versione diversa resetta a seed; JSON corrotto resetta a seed.
- `seed`: deterministico (due chiamate producono lo stesso output).

Niente test e2e.

## 10. Deploy

GitHub Pages da branch `gh-pages` via `npm run deploy` (pacchetto `gh-pages`),
`base` in `vite.config.ts` impostato al nome repo. HashRouter evita 404 su refresh.

## 11. Fuori scope

Multi-utente, autenticazione, invio automatico, calendario appuntamenti, fatturazione,
foto prima/dopo, consenso privacy, backend di qualsiasi tipo.
