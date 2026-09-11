# Plastic CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, single-clinic demo CRM for plastic surgeons whose core flow is listing dormant patients and preparing a pre-filled WhatsApp/email message to re-contact them.

**Architecture:** Vite + React SPA with all state in a single `AppState` object held in a React Context/reducer and persisted to `localStorage`. All business rules (recall computation, stats, template filling) live in pure functions under `src/domain/` that receive `today` as a parameter and are unit-tested with Vitest. Pages are thin: they read state, call domain functions, dispatch actions.

**Tech Stack:** Vite 5, React 18, TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), react-router-dom 6 (HashRouter), Recharts 2, date-fns 3, Vitest 2, gh-pages.

**Spec:** `docs/superpowers/specs/2026-09-10-plastic-crm-design.md`

## Global Constraints

- Project folder: `~/plastic-crm` (already a git repo with the spec committed).
- UI language: Italian. Header shows a fixed badge with the text `DEMO — dati fittizi`.
- No backend, no network calls. Persistence only in `localStorage` under key `plastic-crm`.
- Dates are ISO `YYYY-MM-DD` strings everywhere in state. Never call `new Date()` inside `src/domain/`; `today` is always a parameter.
- Defaults: `globalDormantDays: 180`, `recallWindowDays: 14`, `snoozeDays: 30`.
- Routing via `HashRouter` (GitHub Pages). Routes: `#/`, `#/patients`, `#/patients/:id`, `#/stats`, `#/settings`.
- Commit after every task. Commit messages in English, Conventional Commits.

---

## File Structure

```
plastic-crm/
  index.html
  package.json
  vite.config.ts            base = '/plastic-crm/', tailwind plugin, vitest config
  tsconfig.json
  src/
    main.tsx                mounts <App/>
    App.tsx                 HashRouter + routes + AppProvider
    index.css               @import "tailwindcss"
    domain/
      types.ts              all state types (spec §3) + Recall type
      dates.ts              toISODate, addDaysISO, daysBetween, monthKey
      template.ts           fillTemplate
      recalls.ts            computeDueDate, computeRecalls
      stats.ts              computeStats
    data/
      seed.ts               createSeed(today) deterministic
      storage.ts            loadState, saveState, exportJSON, parseImport
    store/
      actions.ts            Action union + reducer
      AppContext.tsx        AppProvider, useApp, useToday
    components/
      Layout.tsx            nav + DemoBanner + outlet
      DemoBanner.tsx
      KpiCard.tsx
      RecallTable.tsx
      ContactDrawer.tsx
      PatientForm.tsx
      VisitTimeline.tsx
      TagInput.tsx
      ConfirmDialog.tsx
    pages/
      Dashboard.tsx
      Patients.tsx
      PatientDetail.tsx
      Stats.tsx
      Settings.tsx
  tests/
    dates.test.ts  template.test.ts  recalls.test.ts  stats.test.ts  seed.test.ts  storage.test.ts
    fixtures.ts             small hand-built AppState for tests
```

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `tests/smoke.test.ts`, `.gitignore`

**Interfaces:**
- Produces: a runnable Vite app and a working `npm test` (Vitest).

- [ ] **Step 1: Scaffold with Vite and install deps**

```bash
cd ~/plastic-crm
npm create vite@latest . -- --template react-ts
# answer "Ignore files and continue" if prompted about non-empty dir
npm install react@18 react-dom@18 react-router-dom@6 recharts@2 date-fns@3
npm install -D @types/react@18 @types/react-dom@18 tailwindcss@4 @tailwindcss/vite@4 vitest@2 jsdom@25 gh-pages@6
```

- [ ] **Step 2: Configure Vite, Tailwind, Vitest**

`vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/plastic-crm/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
```

`src/index.css` (replace generated content entirely):
```css
@import "tailwindcss";
```

Delete `src/App.css` and `src/assets/react.svg` if generated.

`package.json` scripts — make sure these exist:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

`.gitignore` must contain `node_modules`, `dist`.

- [ ] **Step 3: Minimal App**

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <h1 className="p-4 text-2xl font-bold">Plastic CRM</h1>;
}
```

`index.html`: set `<title>Plastic CRM</title>` and `<html lang="it">`.

- [ ] **Step 4: Smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

Run: `npm run build`
Expected: builds to `dist/` without TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react ts app with tailwind and vitest"
```

---

### Task 2: Domain types and date helpers

**Files:**
- Create: `src/domain/types.ts`, `src/domain/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Produces: all types from spec §3 plus `Recall`, `RecallStatus`. Date helpers:
  - `toISODate(d: Date): string` → `'YYYY-MM-DD'`
  - `addDaysISO(iso: string, days: number): string`
  - `daysBetween(fromISO: string, toISO: string): number` (positive if `to` is after `from`)
  - `monthKey(iso: string): string` → `'YYYY-MM'`
  - `formatIT(iso: string): string` → `'gg/mm/aaaa'`

- [ ] **Step 1: Write types**

`src/domain/types.ts`:
```ts
export type Treatment = {
  id: string;
  name: string;
  recallDays: number | null;
  price: number;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  tags: string[];
  notes: string;
  doNotContact: boolean;
  createdAt: string;
};

export type Visit = {
  id: string;
  patientId: string;
  treatmentId: string;
  date: string;
  price: number;
  notes: string;
};

export type ContactChannel = 'call' | 'whatsapp' | 'email';

export type ContactAttempt = {
  id: string;
  patientId: string;
  date: string;
  channel: ContactChannel;
  snoozeUntil?: string;
};

export type Settings = {
  clinicName: string;
  globalDormantDays: number;
  recallWindowDays: number;
  snoozeDays: number;
  templates: {
    whatsapp: string;
    email: { subject: string; body: string };
  };
  simulatedToday?: string;
};

export type AppState = {
  version: number;
  treatments: Treatment[];
  patients: Patient[];
  visits: Visit[];
  contacts: ContactAttempt[];
  settings: Settings;
};

export type RecallStatus = 'overdue' | 'due';

export type DueInfo = {
  treatment: Treatment | null;
  lastVisitDate: string;
  dueDate: string;
  estimatedValue: number;
};

export type Recall = DueInfo & {
  patient: Patient;
  daysOverdue: number;
  status: RecallStatus;
};

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  clinicName: 'Studio Demo',
  globalDormantDays: 180,
  recallWindowDays: 14,
  snoozeDays: 30,
  templates: {
    whatsapp:
      'Ciao {nome}, sono {clinica}. Sono passati circa {mesi} mesi dal tuo ultimo {trattamento}: vuoi prenotare un controllo? Rispondi pure a questo messaggio.',
    email: {
      subject: 'Il tuo prossimo appuntamento da {clinica}',
      body:
        'Gentile {nome},\n\nsono passati circa {mesi} mesi dal tuo ultimo trattamento ({trattamento}). Saremmo felici di rivederti per un controllo.\n\nRispondi a questa email o chiamaci per fissare un appuntamento.\n\nA presto,\n{clinica}',
    },
  },
};
```

- [ ] **Step 2: Write failing tests**

`tests/dates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toISODate, addDaysISO, daysBetween, monthKey, formatIT } from '../src/domain/dates';

describe('dates', () => {
  it('toISODate formats yyyy-MM-dd', () => {
    expect(toISODate(new Date(2026, 8, 11))).toBe('2026-09-11');
  });
  it('addDaysISO adds and subtracts days', () => {
    expect(addDaysISO('2026-01-30', 5)).toBe('2026-02-04');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween is positive when to is later', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10);
  });
  it('monthKey', () => {
    expect(monthKey('2026-09-11')).toBe('2026-09');
  });
  it('formatIT', () => {
    expect(formatIT('2026-09-11')).toBe('11/09/2026');
  });
});
```

Run: `npm test`
Expected: FAIL, module `../src/domain/dates` not found.

- [ ] **Step 3: Implement**

`src/domain/dates.ts`:
```ts
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISO(iso), days));
}

export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatIT(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy');
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/dates.test.ts
git commit -m "feat: add domain types and date helpers"
```

---

### Task 3: Template filling

**Files:**
- Create: `src/domain/template.ts`
- Test: `tests/template.test.ts`

**Interfaces:**
- Produces: `fillTemplate(template: string, vars: Record<string, string | number>): string`. Replaces `{key}` with `String(vars[key])`; unknown placeholders are left untouched.

- [ ] **Step 1: Failing test**

`tests/template.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { fillTemplate } from '../src/domain/template';

describe('fillTemplate', () => {
  it('replaces known placeholders', () => {
    expect(fillTemplate('Ciao {nome}, {mesi} mesi', { nome: 'Anna', mesi: 4 })).toBe('Ciao Anna, 4 mesi');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(fillTemplate('Ciao {nome} {boh}', { nome: 'Anna' })).toBe('Ciao Anna {boh}');
  });
  it('replaces repeated placeholders', () => {
    expect(fillTemplate('{a}{a}', { a: 'x' })).toBe('xx');
  });
});
```

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 2: Implement**

`src/domain/template.ts`:
```ts
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test` → all pass.

```bash
git add src/domain/template.ts tests/template.test.ts
git commit -m "feat: add fillTemplate"
```

---

### Task 4: Recall engine

**Files:**
- Create: `src/domain/recalls.ts`, `tests/fixtures.ts`
- Test: `tests/recalls.test.ts`

**Interfaces:**
- Consumes: types from Task 2, `addDaysISO`, `daysBetween`.
- Produces:
  - `computeDueDate(patientId: string, state: AppState): DueInfo | null` — null if patient has no visits. No exclusions applied.
  - `computeRecalls(state: AppState, today: string): Recall[]` — applies spec §4 exclusions, status, ordering.

- [ ] **Step 1: Fixtures**

`tests/fixtures.ts`:
```ts
import type { AppState, Patient, Visit, ContactAttempt, Treatment } from '../src/domain/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../src/domain/types';

export const BOTOX: Treatment = { id: 't-botox', name: 'Botox', recallDays: 120, price: 350 };
export const FILLER: Treatment = { id: 't-filler', name: 'Filler labbra', recallDays: 270, price: 450 };
export const RINO: Treatment = { id: 't-rino', name: 'Rinoplastica', recallDays: null, price: 6500 };

export function patient(id: string, overrides: Partial<Patient> = {}): Patient {
  return {
    id,
    firstName: 'Nome' + id,
    lastName: 'Cognome' + id,
    phone: '+39333000' + id,
    email: id + '@example.com',
    birthDate: '1980-01-01',
    tags: [],
    notes: '',
    doNotContact: false,
    createdAt: '2024-01-01',
    ...overrides,
  };
}

export function visit(patientId: string, treatmentId: string, date: string, price = 100): Visit {
  return { id: `v-${patientId}-${treatmentId}-${date}`, patientId, treatmentId, date, price, notes: '' };
}

export function contact(patientId: string, date: string, snoozeUntil?: string): ContactAttempt {
  return { id: `c-${patientId}-${date}`, patientId, date, channel: 'whatsapp', snoozeUntil };
}

export function state(partial: Partial<AppState> = {}): AppState {
  return {
    version: SCHEMA_VERSION,
    treatments: [BOTOX, FILLER, RINO],
    patients: [],
    visits: [],
    contacts: [],
    settings: { ...DEFAULT_SETTINGS },
    ...partial,
  };
}
```

- [ ] **Step 2: Failing tests**

`tests/recalls.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDueDate, computeRecalls } from '../src/domain/recalls';
import { state, patient, visit, contact, BOTOX, FILLER, RINO } from './fixtures';

const TODAY = '2026-09-11';

describe('computeDueDate', () => {
  it('returns null without visits', () => {
    const s = state({ patients: [patient('a')] });
    expect(computeDueDate('a', s)).toBeNull();
  });

  it('uses treatment recallDays from last visit of that treatment', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('a', BOTOX.id, '2026-05-01')],
    });
    const d = computeDueDate('a', s)!;
    expect(d.dueDate).toBe('2026-08-29'); // 2026-05-01 + 120
    expect(d.treatment?.id).toBe(BOTOX.id);
    expect(d.lastVisitDate).toBe('2026-05-01');
    expect(d.estimatedValue).toBe(350);
  });

  it('picks the nearest due date across treatments', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', FILLER.id, '2026-01-01'), visit('a', BOTOX.id, '2026-06-01')],
    });
    // filler: 2026-01-01+270 = 2026-09-28 ; botox: 2026-06-01+120 = 2026-09-29
    expect(computeDueDate('a', s)!.treatment?.id).toBe(FILLER.id);
  });

  it('falls back to globalDormantDays when only null-recall treatments', () => {
    const s = state({
      patients: [patient('a')],
      visits: [visit('a', RINO.id, '2026-01-10', 6500)],
    });
    const d = computeDueDate('a', s)!;
    expect(d.dueDate).toBe('2026-07-09'); // +180
    expect(d.treatment).toBeNull();
    expect(d.estimatedValue).toBe(6500); // last visit price
  });
});

describe('computeRecalls', () => {
  it('marks overdue and due, excludes ok', () => {
    const s = state({
      patients: [patient('over'), patient('due'), patient('ok')],
      visits: [
        visit('over', BOTOX.id, '2026-04-01'), // due 2026-07-30 → overdue 43 days
        visit('due', BOTOX.id, '2026-05-20'),  // due 2026-09-17 → due in 6 days
        visit('ok', BOTOX.id, '2026-08-01'),   // due 2026-11-29 → ok
      ],
    });
    const r = computeRecalls(s, TODAY);
    expect(r.map((x) => [x.patient.id, x.status, x.daysOverdue])).toEqual([
      ['over', 'overdue', 43],
      ['due', 'due', -6],
    ]);
  });

  it('excludes doNotContact', () => {
    const s = state({
      patients: [patient('a', { doNotContact: true })],
      visits: [visit('a', BOTOX.id, '2026-01-01')],
    });
    expect(computeRecalls(s, TODAY)).toHaveLength(0);
  });

  it('excludes active snooze, includes expired snooze', () => {
    const s = state({
      patients: [patient('a'), patient('b')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('b', BOTOX.id, '2026-01-01')],
      contacts: [contact('a', '2026-05-01', '2026-10-01'), contact('b', '2026-04-01', '2026-05-01')],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['b']);
  });

  it('excludes patient contacted within the current cycle window', () => {
    // due = 2026-04-01+120 = 2026-07-30 ; window start = 2026-07-16
    const s = state({
      patients: [patient('recent'), patient('old')],
      visits: [visit('recent', BOTOX.id, '2026-04-01'), visit('old', BOTOX.id, '2026-04-01')],
      contacts: [contact('recent', '2026-07-20'), contact('old', '2026-07-10')],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['old']);
  });

  it('orders overdue first, then daysOverdue desc, then value desc', () => {
    const s = state({
      patients: [patient('d1'), patient('o-small'), patient('o-big'), patient('o-older')],
      visits: [
        visit('d1', BOTOX.id, '2026-05-20'),
        visit('o-small', BOTOX.id, '2026-04-01'),
        visit('o-big', FILLER.id, '2025-11-03'), // due 2026-07-31 → 42 days? no: 2025-11-03+270=2026-07-31 → 42
        visit('o-older', BOTOX.id, '2026-03-01'),
      ],
    });
    const ids = computeRecalls(s, TODAY).map((x) => x.patient.id);
    expect(ids[0]).toBe('o-older');
    expect(ids[ids.length - 1]).toBe('d1');
    expect(ids.indexOf('o-big')).toBeLessThan(ids.indexOf('o-small')); // same-ish days? verify: o-small 43 days, o-big 42 days
  });
});
```

Note for the last test: `o-small` is overdue 43 days, `o-big` 42 days, so `o-small` comes before `o-big` by days. Fix the assertion to match the rule: replace the last `expect` with

```ts
    expect(ids).toEqual(['o-older', 'o-small', 'o-big', 'd1']);
```

and add a tie test:

```ts
  it('breaks ties on estimatedValue desc', () => {
    const s = state({
      patients: [patient('cheap'), patient('rich')],
      visits: [visit('cheap', BOTOX.id, '2026-04-01'), visit('rich', BOTOX.id, '2026-04-01')],
      treatments: [BOTOX],
    });
    s.visits[1] = { ...s.visits[1], price: 999 };
    // both same treatment → same estimatedValue (treatment.price). Use fallback path for tie instead:
    const s2 = state({
      treatments: [RINO],
      patients: [patient('cheap'), patient('rich')],
      visits: [visit('cheap', RINO.id, '2026-01-10', 100), visit('rich', RINO.id, '2026-01-10', 9000)],
    });
    expect(computeRecalls(s2, TODAY).map((x) => x.patient.id)).toEqual(['rich', 'cheap']);
    void s;
  });
```

Simplify: drop the `s` part and keep only `s2`. Final version of that test:

```ts
  it('breaks ties on estimatedValue desc', () => {
    const s = state({
      treatments: [RINO],
      patients: [patient('cheap'), patient('rich')],
      visits: [visit('cheap', RINO.id, '2026-01-10', 100), visit('rich', RINO.id, '2026-01-10', 9000)],
    });
    expect(computeRecalls(s, TODAY).map((x) => x.patient.id)).toEqual(['rich', 'cheap']);
  });
```

Run: `npm test`
Expected: FAIL, module `../src/domain/recalls` not found.

- [ ] **Step 3: Implement**

`src/domain/recalls.ts`:
```ts
import type { AppState, DueInfo, Recall, Visit } from './types';
import { addDaysISO, daysBetween } from './dates';

function lastVisitPerTreatment(visits: Visit[]): Map<string, Visit> {
  const map = new Map<string, Visit>();
  for (const v of visits) {
    const prev = map.get(v.treatmentId);
    if (!prev || v.date > prev.date) map.set(v.treatmentId, v);
  }
  return map;
}

export function computeDueDate(patientId: string, state: AppState): DueInfo | null {
  const visits = state.visits.filter((v) => v.patientId === patientId);
  if (visits.length === 0) return null;

  const byTreatment = lastVisitPerTreatment(visits);
  let best: DueInfo | null = null;

  for (const [treatmentId, v] of byTreatment) {
    const t = state.treatments.find((x) => x.id === treatmentId);
    if (!t || t.recallDays === null) continue;
    const dueDate = addDaysISO(v.date, t.recallDays);
    if (!best || dueDate < best.dueDate) {
      best = { treatment: t, lastVisitDate: v.date, dueDate, estimatedValue: t.price };
    }
  }
  if (best) return best;

  const last = visits.reduce((a, b) => (b.date > a.date ? b : a));
  return {
    treatment: null,
    lastVisitDate: last.date,
    dueDate: addDaysISO(last.date, state.settings.globalDormantDays),
    estimatedValue: last.price,
  };
}

export function computeRecalls(state: AppState, today: string): Recall[] {
  const window = state.settings.recallWindowDays;
  const windowEnd = addDaysISO(today, window);
  const out: Recall[] = [];

  for (const p of state.patients) {
    if (p.doNotContact) continue;
    const due = computeDueDate(p.id, state);
    if (!due) continue;
    if (due.dueDate > windowEnd) continue;

    const contacts = state.contacts.filter((c) => c.patientId === p.id);
    if (contacts.some((c) => c.snoozeUntil && c.snoozeUntil > today)) continue;
    const cycleStart = addDaysISO(due.dueDate, -window);
    if (contacts.some((c) => c.date >= cycleStart)) continue;

    const daysOverdue = daysBetween(due.dueDate, today);
    out.push({
      ...due,
      patient: p,
      daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'due',
    });
  }

  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.estimatedValue - a.estimatedValue;
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass. If a date arithmetic assertion is off by one, recompute by hand with `addDaysISO` in a node REPL before changing the implementation — the implementation is the spec, the fixture dates are what to fix.

- [ ] **Step 5: Commit**

```bash
git add src/domain/recalls.ts tests/fixtures.ts tests/recalls.test.ts
git commit -m "feat: add recall engine"
```

---

### Task 5: Stats

**Files:**
- Create: `src/domain/stats.ts`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Consumes: `computeDueDate`, `computeRecalls`, `monthKey`, `addDaysISO`, `daysBetween`.
- Produces:
```ts
export type Stats = {
  totalPatients: number;
  activePatients: number;     // at least one visit within globalDormantDays before today
  dormantPatients: number;    // overdue recalls count
  doNotContact: number;
  recallsByMonth: { month: string; count: number }[]; // last 6 months incl. current, ascending
  recoveryRate: number | null; // 0..1, null if no non-snooze contacts
  valueByTreatment: { name: string; value: number }[]; // sum estimatedValue of current recalls, desc
};
export function computeStats(state: AppState, today: string): Stats
```

- [ ] **Step 1: Failing tests**

`tests/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { state, patient, visit, contact, BOTOX, FILLER } from './fixtures';

const TODAY = '2026-09-11';

describe('computeStats', () => {
  it('counts totals', () => {
    const s = state({
      patients: [patient('active'), patient('dormant'), patient('dnc', { doNotContact: true }), patient('novisit')],
      visits: [visit('active', BOTOX.id, '2026-08-01'), visit('dormant', BOTOX.id, '2026-01-01'), visit('dnc', BOTOX.id, '2026-01-01')],
    });
    const st = computeStats(s, TODAY);
    expect(st.totalPatients).toBe(4);
    expect(st.activePatients).toBe(1);
    expect(st.dormantPatients).toBe(1);
    expect(st.doNotContact).toBe(1);
  });

  it('buckets due dates by month for last 6 months', () => {
    const s = state({
      patients: [patient('a'), patient('b')],
      visits: [visit('a', BOTOX.id, '2026-04-01'), visit('b', BOTOX.id, '2026-05-01')], // due 07-30, 08-29
    });
    const st = computeStats(s, TODAY);
    expect(st.recallsByMonth.map((m) => m.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(st.recallsByMonth.find((m) => m.month === '2026-07')!.count).toBe(1);
    expect(st.recallsByMonth.find((m) => m.month === '2026-08')!.count).toBe(1);
  });

  it('recovery rate = contacts followed by a visit within 60 days', () => {
    const s = state({
      patients: [patient('yes'), patient('no'), patient('snz')],
      visits: [visit('yes', BOTOX.id, '2026-01-01'), visit('yes', BOTOX.id, '2026-06-10'), visit('no', BOTOX.id, '2026-01-01')],
      contacts: [contact('yes', '2026-06-01'), contact('no', '2026-06-01'), contact('snz', '2026-06-01', '2026-07-01')],
    });
    expect(computeStats(s, TODAY).recoveryRate).toBe(0.5);
  });

  it('recovery rate null without contacts', () => {
    expect(computeStats(state(), TODAY).recoveryRate).toBeNull();
  });

  it('value by treatment from current recalls', () => {
    const s = state({
      patients: [patient('a'), patient('b'), patient('c')],
      visits: [visit('a', BOTOX.id, '2026-01-01'), visit('b', BOTOX.id, '2026-01-01'), visit('c', FILLER.id, '2025-10-01')],
    });
    expect(computeStats(s, TODAY).valueByTreatment).toEqual([
      { name: 'Botox', value: 700 },
      { name: 'Filler labbra', value: 450 },
    ]);
  });
});
```

Run: `npm test` → FAIL, module not found.

- [ ] **Step 2: Implement**

`src/domain/stats.ts`:
```ts
import type { AppState } from './types';
import { computeDueDate, computeRecalls } from './recalls';
import { addDaysISO, daysBetween, monthKey } from './dates';

export type Stats = {
  totalPatients: number;
  activePatients: number;
  dormantPatients: number;
  doNotContact: number;
  recallsByMonth: { month: string; count: number }[];
  recoveryRate: number | null;
  valueByTreatment: { name: string; value: number }[];
};

function lastSixMonths(today: string): string[] {
  const out: string[] = [];
  let cursor = today.slice(0, 7) + '-01';
  for (let i = 0; i < 6; i++) {
    out.unshift(monthKey(cursor));
    cursor = addDaysISO(cursor, -1).slice(0, 7) + '-01';
  }
  return out;
}

export function computeStats(state: AppState, today: string): Stats {
  const activeSince = addDaysISO(today, -state.settings.globalDormantDays);
  const recalls = computeRecalls(state, today);

  const activePatients = state.patients.filter((p) =>
    state.visits.some((v) => v.patientId === p.id && v.date >= activeSince && v.date <= today),
  ).length;

  const months = lastSixMonths(today);
  const counts = new Map(months.map((m) => [m, 0]));
  for (const p of state.patients) {
    const due = computeDueDate(p.id, state);
    if (!due) continue;
    const k = monthKey(due.dueDate);
    if (counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }

  const realContacts = state.contacts.filter((c) => !c.snoozeUntil);
  let recovered = 0;
  for (const c of realContacts) {
    const limit = addDaysISO(c.date, 60);
    if (state.visits.some((v) => v.patientId === c.patientId && v.date > c.date && v.date <= limit)) recovered++;
  }

  const valueMap = new Map<string, number>();
  for (const r of recalls) {
    const name = r.treatment ? r.treatment.name : 'Altro';
    valueMap.set(name, (valueMap.get(name) ?? 0) + r.estimatedValue);
  }

  return {
    totalPatients: state.patients.length,
    activePatients,
    dormantPatients: recalls.filter((r) => r.status === 'overdue').length,
    doNotContact: state.patients.filter((p) => p.doNotContact).length,
    recallsByMonth: months.map((m) => ({ month: m, count: counts.get(m)! })),
    recoveryRate: realContacts.length === 0 ? null : recovered / realContacts.length,
    valueByTreatment: [...valueMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  };
}

void daysBetween;
```

Remove the trailing `void daysBetween;` line and the `daysBetween` import — they are not needed.

- [ ] **Step 3: Run tests, commit**

Run: `npm test` → all pass.

```bash
git add src/domain/stats.ts tests/stats.test.ts
git commit -m "feat: add stats computation"
```

---

### Task 6: Deterministic seed

**Files:**
- Create: `src/data/seed.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: types, `addDaysISO`, `computeRecalls`.
- Produces: `createSeed(today: string): AppState`. Deterministic for the same `today`.

- [ ] **Step 1: Failing test**

`tests/seed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createSeed } from '../src/data/seed';
import { computeRecalls } from '../src/domain/recalls';

const TODAY = '2026-09-11';

describe('createSeed', () => {
  it('is deterministic', () => {
    expect(createSeed(TODAY)).toEqual(createSeed(TODAY));
  });
  it('has 8 treatments and ~40 patients with visits', () => {
    const s = createSeed(TODAY);
    expect(s.treatments).toHaveLength(8);
    expect(s.patients.length).toBeGreaterThanOrEqual(38);
    expect(s.patients.length).toBeLessThanOrEqual(42);
    for (const p of s.patients) {
      expect(s.visits.filter((v) => v.patientId === p.id).length).toBeGreaterThanOrEqual(1);
    }
  });
  it('produces a sensible recall list', () => {
    const s = createSeed(TODAY);
    const r = computeRecalls(s, TODAY);
    const overdue = r.filter((x) => x.status === 'overdue').length;
    const due = r.filter((x) => x.status === 'due').length;
    expect(overdue).toBeGreaterThanOrEqual(8);
    expect(due).toBeGreaterThanOrEqual(2);
    expect(s.patients.filter((p) => p.doNotContact)).toHaveLength(2);
    expect(s.contacts.some((c) => c.snoozeUntil)).toBe(true);
  });
  it('all visits are on or before today', () => {
    const s = createSeed(TODAY);
    expect(s.visits.every((v) => v.date <= TODAY)).toBe(true);
  });
});
```

Run: `npm test` → FAIL, module not found.

- [ ] **Step 2: Implement**

`src/data/seed.ts`:
```ts
import type { AppState, ContactAttempt, Patient, Treatment, Visit } from '../domain/types';
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../domain/types';
import { addDaysISO } from '../domain/dates';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TREATMENTS: Treatment[] = [
  { id: 't-botox', name: 'Botox', recallDays: 120, price: 350 },
  { id: 't-filler-labbra', name: 'Filler labbra', recallDays: 270, price: 450 },
  { id: 't-filler-zigomi', name: 'Filler zigomi', recallDays: 365, price: 600 },
  { id: 't-biorivit', name: 'Biorivitalizzazione', recallDays: 180, price: 250 },
  { id: 't-peeling', name: 'Peeling', recallDays: 90, price: 150 },
  { id: 't-rino', name: 'Rinoplastica', recallDays: null, price: 6500 },
  { id: 't-masto', name: 'Mastoplastica', recallDays: null, price: 7500 },
  { id: 't-blefaro', name: 'Blefaroplastica', recallDays: null, price: 4000 },
];

const FIRST = ['Giulia', 'Francesca', 'Chiara', 'Sara', 'Valentina', 'Elena', 'Martina', 'Alessia', 'Federica', 'Laura',
  'Silvia', 'Paola', 'Roberta', 'Claudia', 'Marco', 'Luca', 'Andrea', 'Davide', 'Matteo', 'Simone'];
const LAST = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
  'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'];

// Profiles control which treatments a patient tends to repeat.
const PROFILES: string[][] = [
  ['t-botox'],
  ['t-botox', 't-filler-labbra'],
  ['t-filler-zigomi', 't-biorivit'],
  ['t-peeling', 't-biorivit'],
  ['t-rino'],
  ['t-masto', 't-botox'],
  ['t-blefaro'],
];

export function createSeed(today: string): AppState {
  const rnd = mulberry32(20260910);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

  const patients: Patient[] = [];
  const visits: Visit[] = [];
  const contacts: ContactAttempt[] = [];
  const N = 40;

  for (let i = 0; i < N; i++) {
    const id = `p-${String(i + 1).padStart(3, '0')}`;
    const firstName = FIRST[i % FIRST.length];
    const lastName = LAST[(i * 7 + 3) % LAST.length];
    const profile = PROFILES[i % PROFILES.length];
    const firstVisitDaysAgo = int(60, 720);
    const tags: string[] = [];
    if (i % 9 === 0) tags.push('VIP');
    if (firstVisitDaysAgo < 120) tags.push('Nuovo');

    patients.push({
      id,
      firstName,
      lastName,
      phone: `+3933${int(0, 9)}${String(int(1000000, 9999999))}`,
      email: `${firstName}.${lastName.replace(/\s/g, '')}${i}@example.com`.toLowerCase(),
      birthDate: `${int(1960, 1998)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      tags,
      notes: '',
      doNotContact: i === 5 || i === 23,
      createdAt: addDaysISO(today, -firstVisitDaysAgo),
    });

    // Visits: walk forward from first visit, repeating the profile's treatments at roughly their recall interval.
    let cursor = -firstVisitDaysAgo;
    const nVisits = int(1, 6);
    for (let k = 0; k < nVisits; k++) {
      const treatmentId = profile[k % profile.length];
      const t = TREATMENTS.find((x) => x.id === treatmentId)!;
      const date = addDaysISO(today, cursor);
      if (date > today) break;
      visits.push({
        id: `v-${id}-${k}`,
        patientId: id,
        treatmentId,
        date,
        price: t.price,
        notes: '',
      });
      const gap = t.recallDays ? int(Math.round(t.recallDays * 0.8), Math.round(t.recallDays * 1.3)) : int(120, 300);
      cursor += gap;
      if (cursor > -3) break;
    }
  }

  // Recent contacts: 3 contacted lately, 1 snoozed.
  const recentIds = ['p-002', 'p-011', 'p-018'];
  recentIds.forEach((pid, i) => {
    contacts.push({ id: `c-${pid}`, patientId: pid, date: addDaysISO(today, -(2 + i * 3)), channel: pick(['call', 'whatsapp', 'email']) });
  });
  contacts.push({ id: 'c-p-025', patientId: 'p-025', date: addDaysISO(today, -5), channel: 'whatsapp', snoozeUntil: addDaysISO(today, 25) });

  return {
    version: SCHEMA_VERSION,
    treatments: TREATMENTS.map((t) => ({ ...t })),
    patients,
    visits,
    contacts,
    settings: { ...DEFAULT_SETTINGS, clinicName: 'Studio Dr. Bellini' },
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass. If the "sensible recall list" thresholds fail, tune `firstVisitDaysAgo` range or the PRNG seed constant until ≥8 overdue and ≥2 due; do not loosen the test below 8/2.

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts tests/seed.test.ts
git commit -m "feat: add deterministic demo seed"
```

---

### Task 7: Storage

**Files:**
- Create: `src/data/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `createSeed`, `SCHEMA_VERSION`.
- Produces:
  - `STORAGE_KEY = 'plastic-crm'`
  - `loadState(today: string): { state: AppState; resetReason: 'missing' | 'corrupt' | 'version' | null }`
  - `saveState(state: AppState): void`
  - `exportJSON(state: AppState): string`
  - `parseImport(text: string): AppState` — throws `Error('JSON non valido')` on bad input.

- [ ] **Step 1: Failing tests**

`tests/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, exportJSON, parseImport, STORAGE_KEY } from '../src/data/storage';
import { createSeed } from '../src/data/seed';

const TODAY = '2026-09-11';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('seeds when missing', () => {
    const { state, resetReason } = loadState(TODAY);
    expect(resetReason).toBe('missing');
    expect(state.patients.length).toBeGreaterThan(0);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('round-trips saved state', () => {
    const s = createSeed(TODAY);
    s.settings.clinicName = 'X';
    saveState(s);
    const { state, resetReason } = loadState(TODAY);
    expect(resetReason).toBeNull();
    expect(state.settings.clinicName).toBe('X');
  });

  it('resets on corrupt json', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState(TODAY).resetReason).toBe('corrupt');
  });

  it('resets on version mismatch', () => {
    const s = createSeed(TODAY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, version: 999 }));
    expect(loadState(TODAY).resetReason).toBe('version');
  });

  it('export/import', () => {
    const s = createSeed(TODAY);
    expect(parseImport(exportJSON(s))).toEqual(s);
    expect(() => parseImport('nope')).toThrow('JSON non valido');
    expect(() => parseImport(JSON.stringify({ version: 999 }))).toThrow('JSON non valido');
  });
});
```

Run: `npm test` → FAIL, module not found.

- [ ] **Step 2: Implement**

`src/data/storage.ts`:
```ts
import type { AppState } from '../domain/types';
import { SCHEMA_VERSION } from '../domain/types';
import { createSeed } from './seed';

export const STORAGE_KEY = 'plastic-crm';

export type ResetReason = 'missing' | 'corrupt' | 'version' | null;

function isAppState(x: unknown): x is AppState {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === SCHEMA_VERSION &&
    Array.isArray(o.treatments) &&
    Array.isArray(o.patients) &&
    Array.isArray(o.visits) &&
    Array.isArray(o.contacts) &&
    !!o.settings && typeof o.settings === 'object'
  );
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(today: string): { state: AppState; resetReason: ResetReason } {
  const raw = localStorage.getItem(STORAGE_KEY);
  let reason: ResetReason = null;
  if (raw === null) {
    reason = 'missing';
  } else {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isAppState(parsed)) return { state: parsed, resetReason: null };
      reason = 'version';
    } catch {
      reason = 'corrupt';
    }
  }
  const state = createSeed(today);
  saveState(state);
  return { state, resetReason: reason };
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseImport(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON non valido');
  }
  if (!isAppState(parsed)) throw new Error('JSON non valido');
  return parsed;
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test` → all pass.

```bash
git add src/data/storage.ts tests/storage.test.ts
git commit -m "feat: add localStorage persistence with seed fallback"
```

---

### Task 8: Store (reducer + context)

**Files:**
- Create: `src/store/actions.ts`, `src/store/AppContext.tsx`
- Test: `tests/reducer.test.ts`

**Interfaces:**
- Consumes: types, `loadState`, `saveState`, `createSeed`, `toISODate`.
- Produces:
  - `reducer(state: AppState, action: Action): AppState` and the `Action` union (below).
  - `AppProvider` component; `useApp(): { state: AppState; dispatch: React.Dispatch<Action>; resetReason: ResetReason }`; `useToday(): string`.
  - `newId(): string` → `crypto.randomUUID()`.

- [ ] **Step 1: Failing reducer tests**

`tests/reducer.test.ts`:
```ts
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
```

Run: `npm test` → FAIL, module not found.

- [ ] **Step 2: Implement reducer**

`src/store/actions.ts`:
```ts
import type { AppState, ContactAttempt, Patient, Settings, Treatment, Visit } from '../domain/types';

export type Action =
  | { type: 'ADD_PATIENT'; patient: Patient }
  | { type: 'UPDATE_PATIENT'; id: string; changes: Partial<Patient> }
  | { type: 'DELETE_PATIENT'; id: string }
  | { type: 'ADD_VISIT'; visit: Visit }
  | { type: 'DELETE_VISIT'; id: string }
  | { type: 'ADD_CONTACT'; contact: ContactAttempt }
  | { type: 'ADD_TREATMENT'; treatment: Treatment }
  | { type: 'UPDATE_TREATMENT'; id: string; changes: Partial<Treatment> }
  | { type: 'DELETE_TREATMENT'; id: string }
  | { type: 'UPDATE_SETTINGS'; changes: Partial<Settings> }
  | { type: 'REPLACE_STATE'; state: AppState };

export function newId(): string {
  return crypto.randomUUID();
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PATIENT':
      return { ...state, patients: [...state.patients, action.patient] };
    case 'UPDATE_PATIENT':
      return { ...state, patients: state.patients.map((p) => (p.id === action.id ? { ...p, ...action.changes } : p)) };
    case 'DELETE_PATIENT':
      return {
        ...state,
        patients: state.patients.filter((p) => p.id !== action.id),
        visits: state.visits.filter((v) => v.patientId !== action.id),
        contacts: state.contacts.filter((c) => c.patientId !== action.id),
      };
    case 'ADD_VISIT':
      return { ...state, visits: [...state.visits, action.visit] };
    case 'DELETE_VISIT':
      return { ...state, visits: state.visits.filter((v) => v.id !== action.id) };
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.contact] };
    case 'ADD_TREATMENT':
      return { ...state, treatments: [...state.treatments, action.treatment] };
    case 'UPDATE_TREATMENT':
      return { ...state, treatments: state.treatments.map((t) => (t.id === action.id ? { ...t, ...action.changes } : t)) };
    case 'DELETE_TREATMENT':
      if (state.visits.some((v) => v.treatmentId === action.id)) return state;
      return { ...state, treatments: state.treatments.filter((t) => t.id !== action.id) };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case 'REPLACE_STATE':
      return action.state;
  }
}
```

- [ ] **Step 3: Implement context**

`src/store/AppContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState } from '../domain/types';
import { toISODate } from '../domain/dates';
import { loadState, saveState, type ResetReason } from '../data/storage';
import { reducer, type Action } from './actions';

type Ctx = { state: AppState; dispatch: React.Dispatch<Action>; resetReason: ResetReason };

const AppContext = createContext<Ctx | null>(null);

export function realToday(): string {
  return toISODate(new Date());
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadState(realToday()), []);
  const [state, dispatch] = useReducer(reducer, initial.state);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, resetReason: initial.resetReason }), [state, initial.resetReason]);
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

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `npm test` → all pass. Run: `npx tsc -b` → no errors.

```bash
git add src/store tests/reducer.test.ts
git commit -m "feat: add app store with reducer and persistence"
```

---

### Task 9: App shell, routing, layout

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/Layout.tsx`, `src/components/DemoBanner.tsx`, placeholder pages `src/pages/{Dashboard,Patients,PatientDetail,Stats,Settings}.tsx`

**Interfaces:**
- Consumes: `AppProvider`, `useApp`, `useToday`.
- Produces: navigable app with 5 routes; pages initially render only their title (replaced in later tasks).

- [ ] **Step 1: Placeholder pages**

Each of the five files, e.g. `src/pages/Dashboard.tsx`:
```tsx
export default function Dashboard() {
  return <h1 className="text-2xl font-semibold">Richiami</h1>;
}
```
Titles: Dashboard → "Richiami", Patients → "Pazienti", PatientDetail → "Paziente", Stats → "Statistiche", Settings → "Impostazioni".

- [ ] **Step 2: DemoBanner and Layout**

`src/components/DemoBanner.tsx`:
```tsx
import { useApp, useToday } from '../store/AppContext';
import { formatIT } from '../domain/dates';

export default function DemoBanner() {
  const { state, resetReason } = useApp();
  const today = useToday();
  return (
    <div className="flex flex-wrap items-center gap-3 bg-amber-100 px-4 py-1 text-xs text-amber-900">
      <span className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-white">DEMO — dati fittizi</span>
      {state.settings.simulatedToday && <span>Data simulata: {formatIT(today)}</span>}
      {resetReason === 'corrupt' && <span>Dati locali non validi: ripristinati i dati demo.</span>}
      {resetReason === 'version' && <span>Dati locali di una versione precedente: ripristinati i dati demo.</span>}
    </div>
  );
}
```

`src/components/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom';
import DemoBanner from './DemoBanner';
import { useApp } from '../store/AppContext';

const links = [
  { to: '/', label: 'Richiami' },
  { to: '/patients', label: 'Pazienti' },
  { to: '/stats', label: 'Statistiche' },
  { to: '/settings', label: 'Impostazioni' },
];

export default function Layout() {
  const { state } = useApp();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DemoBanner />
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: App with router**

`src/App.tsx`:
```tsx
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AppProvider>
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
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open the URL. Expected: banner, header with "Studio Dr. Bellini", nav switches between the 4 pages. `localStorage['plastic-crm']` populated (DevTools → Application).

Run: `npm run build` → no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app shell with routing and layout"
```

---

### Task 10: Dashboard (KPI + recall table)

**Files:**
- Create: `src/components/KpiCard.tsx`, `src/components/RecallTable.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `computeRecalls`, `useApp`, `useToday`, `formatIT`.
- Produces: `RecallTable({ recalls, onContact }: { recalls: Recall[]; onContact: (r: Recall) => void })`. Dashboard holds a `selected: Recall | null` state that Task 11 wires to `ContactDrawer`.

- [ ] **Step 1: KpiCard**

`src/components/KpiCard.tsx`:
```tsx
export default function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
```

- [ ] **Step 2: RecallTable**

`src/components/RecallTable.tsx`:
```tsx
import { Link } from 'react-router-dom';
import type { Recall } from '../domain/types';
import { formatIT } from '../domain/dates';

export const eur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function RecallTable({ recalls, onContact }: { recalls: Recall[]; onContact: (r: Recall) => void }) {
  if (recalls.length === 0) return <p className="text-slate-500">Nessun paziente da ricontattare.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2">Paziente</th>
            <th className="px-3 py-2">Trattamento</th>
            <th className="px-3 py-2">Ultima visita</th>
            <th className="px-3 py-2">Scadenza</th>
            <th className="px-3 py-2">Ritardo</th>
            <th className="px-3 py-2 text-right">Valore</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {recalls.map((r) => (
            <tr key={r.patient.id} className="border-t">
              <td className="px-3 py-2">
                <Link to={`/patients/${r.patient.id}`} className="font-medium hover:underline">
                  {r.patient.lastName} {r.patient.firstName}
                </Link>
                {r.patient.tags.map((t) => (
                  <span key={t} className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{t}</span>
                ))}
              </td>
              <td className="px-3 py-2">{r.treatment?.name ?? 'Controllo generale'}</td>
              <td className="px-3 py-2">{formatIT(r.lastVisitDate)}</td>
              <td className="px-3 py-2">{formatIT(r.dueDate)}</td>
              <td className="px-3 py-2">
                {r.status === 'overdue' ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">{r.daysOverdue} gg</span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">tra {-r.daysOverdue} gg</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">{eur(r.estimatedValue)}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onContact(r)} className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700">
                  Contatta
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard page**

`src/pages/Dashboard.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { useApp, useToday } from '../store/AppContext';
import { computeRecalls } from '../domain/recalls';
import type { Recall, RecallStatus } from '../domain/types';
import KpiCard from '../components/KpiCard';
import RecallTable, { eur } from '../components/RecallTable';

export default function Dashboard() {
  const { state } = useApp();
  const today = useToday();
  const [status, setStatus] = useState<RecallStatus | 'all'>('all');
  const [treatmentId, setTreatmentId] = useState('all');
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Recall | null>(null);

  const recalls = useMemo(() => computeRecalls(state, today), [state, today]);
  const allTags = useMemo(() => [...new Set(state.patients.flatMap((p) => p.tags))].sort(), [state.patients]);

  const filtered = recalls.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (treatmentId !== 'all' && (r.treatment?.id ?? 'none') !== treatmentId) return false;
    if (tag !== 'all' && !r.patient.tags.includes(tag)) return false;
    const name = `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase();
    return name.includes(q.toLowerCase());
  });

  const overdue = recalls.filter((r) => r.status === 'overdue');
  const due = recalls.filter((r) => r.status === 'due');
  const value = recalls.reduce((s, r) => s + r.estimatedValue, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Richiami</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Dormienti" value={overdue.length} hint="oltre la scadenza" />
        <KpiCard label="In scadenza" value={due.length} hint={`entro ${state.settings.recallWindowDays} giorni`} />
        <KpiCard label="Valore recuperabile" value={eur(value)} hint="stima sui prezzi di listino" />
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome" className="rounded border px-2 py-1 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value as RecallStatus | 'all')} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti gli stati</option>
          <option value="overdue">Dormienti</option>
          <option value="due">In scadenza</option>
        </select>
        <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i trattamenti</option>
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="none">Controllo generale</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <RecallTable recalls={filtered} onContact={setSelected} />
      {selected && <pre className="text-xs">{selected.patient.id}</pre>}
    </div>
  );
}
```

The final `{selected && <pre>…}` line is a temporary stand-in replaced in Task 11.

- [ ] **Step 4: Verify manually**

`npm run dev`: KPI show numbers, table lists ~10+ rows sorted by delay, filters work, "Contatta" shows the patient id below the table. `npm run build` passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with KPI cards and recall table"
```

---

### Task 11: Contact drawer

**Files:**
- Create: `src/components/ContactDrawer.tsx`
- Modify: `src/pages/Dashboard.tsx` (replace the `<pre>` stand-in)

**Interfaces:**
- Consumes: `fillTemplate`, `daysBetween`, `newId`, `useApp`, `useToday`, `addDaysISO`.
- Produces: `ContactDrawer({ recall, onClose }: { recall: Recall; onClose: () => void })`.

- [ ] **Step 1: Implement drawer**

`src/components/ContactDrawer.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { ContactChannel, Recall } from '../domain/types';
import { fillTemplate } from '../domain/template';
import { addDaysISO, daysBetween } from '../domain/dates';
import { newId } from '../store/actions';
import { useApp, useToday } from '../store/AppContext';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const withPrefix = digits.startsWith('+') ? digits : '+39' + digits;
  return withPrefix.replace('+', '');
}

export default function ContactDrawer({ recall, onClose }: { recall: Recall; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [channel, setChannel] = useState<ContactChannel>('whatsapp');
  const p = recall.patient;

  const vars = {
    nome: p.firstName,
    trattamento: recall.treatment?.name ?? 'trattamento',
    mesi: Math.max(1, Math.round(daysBetween(recall.lastVisitDate, today) / 30)),
    clinica: state.settings.clinicName,
  };
  const tpl = state.settings.templates;
  const [subject, setSubject] = useState(() => fillTemplate(tpl.email.subject, vars));
  const [body, setBody] = useState(() => fillTemplate(tpl.whatsapp, vars));

  useEffect(() => {
    setBody(fillTemplate(channel === 'email' ? tpl.email.body : tpl.whatsapp, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const waHref = `https://wa.me/${normalizePhone(p.phone)}?text=${encodeURIComponent(body)}`;
  const mailHref = `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function markContacted(snooze: boolean) {
    dispatch({
      type: 'ADD_CONTACT',
      contact: {
        id: newId(),
        patientId: p.id,
        date: today,
        channel,
        snoozeUntil: snooze ? addDaysISO(today, state.settings.snoozeDays) : undefined,
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{p.firstName} {p.lastName}</h2>
            <p className="text-sm text-slate-600">{p.phone} · {p.email || 'nessuna email'}</p>
            <p className="text-sm text-slate-600">Ultimo: {recall.treatment?.name ?? 'visita'} · {vars.mesi} mesi fa</p>
            {p.notes && <p className="mt-1 text-sm italic text-slate-500">{p.notes}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="mt-4 flex gap-2">
          {(['whatsapp', 'email', 'call'] as ContactChannel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded px-3 py-1 text-sm ${channel === c ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}
            >
              {c === 'whatsapp' ? 'WhatsApp' : c === 'email' ? 'Email' : 'Chiamata'}
            </button>
          ))}
        </div>

        {channel !== 'call' && (
          <div className="mt-4 space-y-2">
            {channel === 'email' && (
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded border px-2 py-1 text-sm" />
            <div className="flex flex-wrap gap-2">
              {channel === 'whatsapp' && (
                <a href={waHref} target="_blank" rel="noreferrer" aria-disabled={!p.phone}
                  className={`rounded px-3 py-1 text-sm text-white ${p.phone ? 'bg-green-600 hover:bg-green-700' : 'pointer-events-none bg-slate-300'}`}>
                  Apri WhatsApp
                </a>
              )}
              {channel === 'email' && (
                <a href={mailHref} aria-disabled={!p.email}
                  className={`rounded px-3 py-1 text-sm text-white ${p.email ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300'}`}>
                  Apri email
                </a>
              )}
              <button onClick={() => navigator.clipboard.writeText(body)} className="rounded border px-3 py-1 text-sm">Copia testo</button>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2 border-t pt-4">
          <button onClick={() => markContacted(false)} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700">
            Segna contattato
          </button>
          <button onClick={() => markContacted(true)} className="rounded border px-3 py-1 text-sm">
            Rimanda {state.settings.snoozeDays} gg
          </button>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Wire into Dashboard**

In `src/pages/Dashboard.tsx` add `import ContactDrawer from '../components/ContactDrawer';` and replace
```tsx
      {selected && <pre className="text-xs">{selected.patient.id}</pre>}
```
with
```tsx
      {selected && <ContactDrawer recall={selected} onClose={() => setSelected(null)} />}
```

- [ ] **Step 3: Verify manually**

`npm run dev`: click "Contatta" → drawer with prefilled text containing the patient's first name and months; switching to Email swaps the template and shows subject; "Segna contattato" removes the row from the table and updates KPI; "Rimanda" also removes it. Reload page: row still gone (persisted). `npm run build` passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add contact drawer with templates and mark-contacted actions"
```

---

### Task 12: Patients list

**Files:**
- Create: `src/components/PatientForm.tsx`
- Modify: `src/pages/Patients.tsx`

**Interfaces:**
- Consumes: `computeDueDate`, `newId`, `useApp`, `useToday`.
- Produces: `PatientForm({ initial, onSubmit, onCancel }: { initial?: Patient; onSubmit: (p: Patient) => void; onCancel: () => void })` — reused by Task 13 for editing.

- [ ] **Step 1: PatientForm**

`src/components/PatientForm.tsx`:
```tsx
import { useState } from 'react';
import type { Patient } from '../domain/types';
import { newId } from '../store/actions';
import { useToday } from '../store/AppContext';

export default function PatientForm({ initial, onSubmit, onCancel }: { initial?: Patient; onSubmit: (p: Patient) => void; onCancel: () => void }) {
  const today = useToday();
  const [form, setForm] = useState<Patient>(
    initial ?? { id: newId(), firstName: '', lastName: '', phone: '', email: '', birthDate: '', tags: [], notes: '', doNotContact: false, createdAt: today },
  );
  const set = (k: keyof Patient) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (form.firstName && form.lastName) onSubmit(form); }}
      className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"
    >
      <input required value={form.firstName} onChange={set('firstName')} placeholder="Nome" className="rounded border px-2 py-1" />
      <input required value={form.lastName} onChange={set('lastName')} placeholder="Cognome" className="rounded border px-2 py-1" />
      <input value={form.phone} onChange={set('phone')} placeholder="Telefono (+39...)" className="rounded border px-2 py-1" />
      <input type="email" value={form.email} onChange={set('email')} placeholder="Email" className="rounded border px-2 py-1" />
      <input type="date" value={form.birthDate} onChange={set('birthDate')} className="rounded border px-2 py-1" />
      <textarea value={form.notes} onChange={set('notes')} placeholder="Note" className="rounded border px-2 py-1 sm:col-span-2" />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">Salva</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1">Annulla</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Patients page**

`src/pages/Patients.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { computeDueDate } from '../domain/recalls';
import { formatIT } from '../domain/dates';
import PatientForm from '../components/PatientForm';

export default function Patients() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [treatmentId, setTreatmentId] = useState('all');
  const [adding, setAdding] = useState(false);

  const allTags = useMemo(() => [...new Set(state.patients.flatMap((p) => p.tags))].sort(), [state.patients]);

  const rows = state.patients
    .filter((p) => {
      const hay = `${p.firstName} ${p.lastName} ${p.phone} ${p.email}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
      if (tag !== 'all' && !p.tags.includes(tag)) return false;
      if (treatmentId !== 'all' && !state.visits.some((v) => v.patientId === p.id && v.treatmentId === treatmentId)) return false;
      return true;
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((p) => ({ p, due: computeDueDate(p.id, state) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pazienti</h1>
        <button onClick={() => setAdding(true)} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">Nuovo paziente</button>
      </div>
      {adding && (
        <PatientForm
          onSubmit={(p) => { dispatch({ type: 'ADD_PATIENT', patient: p }); setAdding(false); navigate(`/patients/${p.id}`); }}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome, telefono, email" className="rounded border px-2 py-1 text-sm" />
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i trattamenti</option>
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Paziente</th>
              <th className="px-3 py-2">Telefono</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Ultima visita</th>
              <th className="px-3 py-2">Prossimo richiamo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, due }) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/patients/${p.id}`} className="font-medium hover:underline">{p.lastName} {p.firstName}</Link>
                  {p.doNotContact && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">no contatto</span>}
                  {p.tags.map((t) => <span key={t} className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{t}</span>)}
                </td>
                <td className="px-3 py-2">{p.phone}</td>
                <td className="px-3 py-2">{p.email}</td>
                <td className="px-3 py-2">{due ? formatIT(due.lastVisitDate) : '—'}</td>
                <td className="px-3 py-2">{due ? `${formatIT(due.dueDate)} (${due.treatment?.name ?? 'controllo'})` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually, commit**

`npm run dev`: list of 40, search filters, "Nuovo paziente" adds and navigates to detail (still placeholder). `npm run build` passes.

```bash
git add -A
git commit -m "feat: add patients list with search, filters and creation"
```

---

### Task 13: Patient detail

**Files:**
- Create: `src/components/TagInput.tsx`, `src/components/VisitTimeline.tsx`, `src/components/ConfirmDialog.tsx`
- Modify: `src/pages/PatientDetail.tsx`

**Interfaces:**
- Consumes: `PatientForm`, `computeDueDate`, `newId`, `useApp`, `useToday`, `formatIT`.
- Produces: `ConfirmDialog({ message, onConfirm, onCancel })` — reused in Task 15 for reset.

- [ ] **Step 1: ConfirmDialog**

`src/components/ConfirmDialog.tsx`:
```tsx
export default function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-1 text-sm">Annulla</button>
          <button onClick={onConfirm} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Conferma</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TagInput**

`src/components/TagInput.tsx`:
```tsx
import { useState } from 'react';

export default function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="rounded bg-slate-200 px-2 py-0.5 text-xs">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="ml-1 text-slate-500">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Aggiungi tag"
        className="rounded border px-2 py-0.5 text-xs"
      />
    </div>
  );
}
```

- [ ] **Step 3: VisitTimeline**

`src/components/VisitTimeline.tsx`:
```tsx
import { useState } from 'react';
import type { Visit } from '../domain/types';
import { formatIT } from '../domain/dates';
import { newId } from '../store/actions';
import { useApp, useToday } from '../store/AppContext';
import { eur } from './RecallTable';

export default function VisitTimeline({ patientId }: { patientId: string }) {
  const { state, dispatch } = useApp();
  const today = useToday();
  const visits = state.visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const [treatmentId, setTreatmentId] = useState(state.treatments[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState(state.treatments[0]?.price ?? 0);
  const [notes, setNotes] = useState('');

  const tName = (id: string) => state.treatments.find((t) => t.id === id)?.name ?? '?';

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!treatmentId || !date) return;
    const v: Visit = { id: newId(), patientId, treatmentId, date, price, notes };
    dispatch({ type: 'ADD_VISIT', visit: v });
    setNotes('');
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3 text-sm">
        <select value={treatmentId} onChange={(e) => { setTreatmentId(e.target.value); setPrice(state.treatments.find((t) => t.id === e.target.value)?.price ?? 0); }} className="rounded border px-2 py-1">
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1" />
        <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-24 rounded border px-2 py-1" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note" className="rounded border px-2 py-1" />
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">Aggiungi visita</button>
      </form>
      <ul className="divide-y rounded-lg border bg-white">
        {visits.length === 0 && <li className="p-3 text-slate-500">Nessuna visita.</li>}
        {visits.map((v) => (
          <li key={v.id} className="flex items-center justify-between p-3 text-sm">
            <span><span className="font-medium">{formatIT(v.date)}</span> · {tName(v.treatmentId)} · {eur(v.price)} {v.notes && <span className="text-slate-500">· {v.notes}</span>}</span>
            <button onClick={() => dispatch({ type: 'DELETE_VISIT', id: v.id })} className="text-xs text-red-600">elimina</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: PatientDetail page**

`src/pages/PatientDetail.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useToday } from '../store/AppContext';
import { computeDueDate } from '../domain/recalls';
import { formatIT, daysBetween } from '../domain/dates';
import PatientForm from '../components/PatientForm';
import TagInput from '../components/TagInput';
import VisitTimeline from '../components/VisitTimeline';
import ConfirmDialog from '../components/ConfirmDialog';

export default function PatientDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const today = useToday();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const p = state.patients.find((x) => x.id === id);
  if (!p) return <p>Paziente non trovato.</p>;

  const due = computeDueDate(p.id, state);
  const contacts = state.contacts.filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const channelLabel = { call: 'Chiamata', whatsapp: 'WhatsApp', email: 'Email' };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.firstName} {p.lastName}</h1>
          <p className="text-sm text-slate-600">{p.phone} · {p.email || 'nessuna email'} · nato il {p.birthDate ? formatIT(p.birthDate) : '—'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="rounded border px-3 py-1 text-sm">Modifica</button>
          <button onClick={() => setConfirming(true)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">Elimina</button>
        </div>
      </div>

      {editing && (
        <PatientForm
          initial={p}
          onSubmit={(np) => { dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: np }); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
          <TagInput tags={p.tags} onChange={(tags) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { tags } })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.doNotContact} onChange={(e) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { doNotContact: e.target.checked } })} />
            Non contattare
          </label>
          <textarea
            value={p.notes}
            onChange={(e) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { notes: e.target.value } })}
            placeholder="Note"
            className="w-full rounded border px-2 py-1"
          />
        </div>
        <div className="rounded-lg border bg-white p-4 text-sm">
          <div className="text-xs uppercase text-slate-500">Prossimo richiamo</div>
          {due ? (
            <>
              <div className="text-lg font-semibold">{formatIT(due.dueDate)}</div>
              <div className="text-slate-600">
                {due.treatment?.name ?? 'Controllo generale'} ·{' '}
                {daysBetween(due.dueDate, today) > 0 ? `in ritardo di ${daysBetween(due.dueDate, today)} gg` : `tra ${-daysBetween(due.dueDate, today)} gg`}
              </div>
            </>
          ) : (
            <div className="text-slate-500">Nessuna visita registrata.</div>
          )}
          <div className="mt-3 text-xs uppercase text-slate-500">Contatti</div>
          {contacts.length === 0 && <div className="text-slate-500">Nessun contatto.</div>}
          <ul>
            {contacts.map((c) => (
              <li key={c.id}>{formatIT(c.date)} · {channelLabel[c.channel]}{c.snoozeUntil ? ` · rimandato al ${formatIT(c.snoozeUntil)}` : ''}</li>
            ))}
          </ul>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Visite</h2>
        <VisitTimeline patientId={p.id} />
      </section>

      {confirming && (
        <ConfirmDialog
          message={`Eliminare ${p.firstName} ${p.lastName} e tutte le sue visite?`}
          onConfirm={() => { dispatch({ type: 'DELETE_PATIENT', id: p.id }); navigate('/patients'); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify manually, commit**

`npm run dev`: open a patient, add a visit dated today → "Prossimo richiamo" moves forward and the patient disappears from Dashboard. Toggle "Non contattare" → disappears from Dashboard. Delete → confirm → back to list. `npm run build` passes.

```bash
git add -A
git commit -m "feat: add patient detail with visits, tags and contact history"
```

---

### Task 14: Stats page

**Files:**
- Modify: `src/pages/Stats.tsx`

**Interfaces:**
- Consumes: `computeStats`, `KpiCard`, `eur`, Recharts.

- [ ] **Step 1: Implement**

`src/pages/Stats.tsx`:
```tsx
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, useToday } from '../store/AppContext';
import { computeStats } from '../domain/stats';
import KpiCard from '../components/KpiCard';
import { eur } from '../components/RecallTable';

export default function Stats() {
  const { state } = useApp();
  const today = useToday();
  const s = useMemo(() => computeStats(state, today), [state, today]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Statistiche</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Pazienti" value={s.totalPatients} />
        <KpiCard label="Attivi" value={s.activePatients} hint={`visita negli ultimi ${state.settings.globalDormantDays} gg`} />
        <KpiCard label="Dormienti" value={s.dormantPatients} />
        <KpiCard label="Non contattabili" value={s.doNotContact} />
        <KpiCard label="Tasso recupero" value={s.recoveryRate === null ? '—' : `${Math.round(s.recoveryRate * 100)}%`} hint="visita entro 60 gg dal contatto" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Richiami in scadenza per mese</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.recallsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Richiami" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Valore recuperabile per trattamento</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.valueByTreatment} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(v) => eur(v)} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => eur(Number(v))} />
              <Bar dataKey="value" name="Valore" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually, commit**

`npm run dev`: KPI populated, two charts render with seed data. `npm run build` passes.

```bash
git add -A
git commit -m "feat: add stats page with charts"
```

---

### Task 15: Settings page

**Files:**
- Modify: `src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `useApp`, `useToday`, `createSeed`, `exportJSON`, `parseImport`, `newId`, `ConfirmDialog`, `realToday`.

- [ ] **Step 1: Implement**

`src/pages/Settings.tsx`:
```tsx
import { useState } from 'react';
import { useApp, realToday } from '../store/AppContext';
import { createSeed } from '../data/seed';
import { exportJSON, parseImport } from '../data/storage';
import { newId } from '../store/actions';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState('');
  const [newT, setNewT] = useState({ name: '', recallDays: '', price: '' });

  const num = (v: string) => (v === '' ? null : Number(v));
  const usedTreatment = (id: string) => state.visits.some((v) => v.treatmentId === id);

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        dispatch({ type: 'REPLACE_STATE', state: parseImport(text) });
        setImportError('');
      } catch (err) {
        setImportError((err as Error).message);
      }
    });
    e.target.value = '';
  }

  function download() {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plastic-crm-${realToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const field = 'w-full rounded border px-2 py-1 text-sm';

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Impostazioni</h1>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Studio</h2>
        <label className="block text-sm">Nome clinica
          <input value={s.clinicName} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { clinicName: e.target.value } })} className={field} />
        </label>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <label>Soglia dormienza (gg)
            <input type="number" value={s.globalDormantDays} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { globalDormantDays: Number(e.target.value) } })} className={field} />
          </label>
          <label>Finestra richiamo (gg)
            <input type="number" value={s.recallWindowDays} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { recallWindowDays: Number(e.target.value) } })} className={field} />
          </label>
          <label>Rimanda di (gg)
            <input type="number" value={s.snoozeDays} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { snoozeDays: Number(e.target.value) } })} className={field} />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Trattamenti</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th>Nome</th><th>Richiamo (gg)</th><th>Prezzo €</th><th></th></tr>
          </thead>
          <tbody>
            {state.treatments.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-1 pr-2"><input value={t.name} onChange={(e) => dispatch({ type: 'UPDATE_TREATMENT', id: t.id, changes: { name: e.target.value } })} className={field} /></td>
                <td className="py-1 pr-2"><input type="number" value={t.recallDays ?? ''} placeholder="nessuno" onChange={(e) => dispatch({ type: 'UPDATE_TREATMENT', id: t.id, changes: { recallDays: num(e.target.value) } })} className={field} /></td>
                <td className="py-1 pr-2"><input type="number" value={t.price} onChange={(e) => dispatch({ type: 'UPDATE_TREATMENT', id: t.id, changes: { price: Number(e.target.value) } })} className={field} /></td>
                <td className="py-1">
                  <button
                    disabled={usedTreatment(t.id)}
                    title={usedTreatment(t.id) ? 'Ha visite associate' : ''}
                    onClick={() => dispatch({ type: 'DELETE_TREATMENT', id: t.id })}
                    className="text-xs text-red-600 disabled:text-slate-300"
                  >elimina</button>
                </td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="py-1 pr-2"><input value={newT.name} onChange={(e) => setNewT({ ...newT, name: e.target.value })} placeholder="Nuovo trattamento" className={field} /></td>
              <td className="py-1 pr-2"><input type="number" value={newT.recallDays} onChange={(e) => setNewT({ ...newT, recallDays: e.target.value })} placeholder="nessuno" className={field} /></td>
              <td className="py-1 pr-2"><input type="number" value={newT.price} onChange={(e) => setNewT({ ...newT, price: e.target.value })} className={field} /></td>
              <td className="py-1">
                <button
                  onClick={() => {
                    if (!newT.name) return;
                    dispatch({ type: 'ADD_TREATMENT', treatment: { id: newId(), name: newT.name, recallDays: num(newT.recallDays), price: Number(newT.price) || 0 } });
                    setNewT({ name: '', recallDays: '', price: '' });
                  }}
                  className="text-xs text-indigo-600"
                >aggiungi</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Template messaggi</h2>
        <p className="text-xs text-slate-500">Segnaposto: {'{nome} {trattamento} {mesi} {clinica}'}</p>
        <label className="block text-sm">WhatsApp
          <textarea rows={4} value={s.templates.whatsapp} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, whatsapp: e.target.value } } })} className={field} />
        </label>
        <label className="block text-sm">Oggetto email
          <input value={s.templates.email.subject} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, email: { ...s.templates.email, subject: e.target.value } } } })} className={field} />
        </label>
        <label className="block text-sm">Corpo email
          <textarea rows={6} value={s.templates.email.body} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, email: { ...s.templates.email, body: e.target.value } } } })} className={field} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Demo</h2>
        <label className="block text-sm">Simula data odierna
          <div className="flex gap-2">
            <input type="date" value={s.simulatedToday ?? ''} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: e.target.value || undefined } })} className={field} />
            <button onClick={() => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: undefined } })} className="rounded border px-3 py-1 text-sm">Azzera</button>
          </div>
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={download} className="rounded border px-3 py-1">Esporta JSON</button>
          <label className="cursor-pointer rounded border px-3 py-1">
            Importa JSON
            <input type="file" accept="application/json" onChange={onImport} className="hidden" />
          </label>
          <button onClick={() => setConfirmReset(true)} className="rounded border border-red-300 px-3 py-1 text-red-700">Reset dati demo</button>
        </div>
        {importError && <p className="text-sm text-red-600">{importError}</p>}
      </section>

      {confirmReset && (
        <ConfirmDialog
          message="Sostituire tutti i dati con i dati demo?"
          onConfirm={() => { dispatch({ type: 'REPLACE_STATE', state: createSeed(realToday()) }); setConfirmReset(false); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually, commit**

`npm run dev`: set simulated date 6 months ahead → banner shows it, Dashboard count jumps; Azzera restores. Change Botox recall days → Dashboard updates. Export downloads a file; importing it back works; importing a `.txt` with garbage shows "JSON non valido". Reset restores 40 patients. `npm run build` passes, `npm test` passes.

```bash
git add -A
git commit -m "feat: add settings page with treatments, templates, simulated date and data tools"
```

---

### Task 16: Deploy to GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

`README.md`:
```markdown
# Plastic CRM (demo)

Demo di un CRM per studi di chirurgia plastica ed estetica, focalizzato sul richiamo dei pazienti dormienti.

- Dati fittizi, salvati solo nel browser (localStorage).
- Nessun backend: i messaggi si aprono su WhatsApp/email tramite link.

## Sviluppo

    npm install
    npm run dev
    npm test

## Deploy

    npm run deploy
```

- [ ] **Step 2: Create repo and deploy**

```bash
cd ~/plastic-crm
git add README.md && git commit -m "docs: add README"
gh repo create plastic-crm --public --source=. --push
npm run deploy
gh api -X POST repos/{owner}/plastic-crm/pages -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/' 2>/dev/null || true
```

Wait ~1 minute, then open `https://<owner>.github.io/plastic-crm/`. Expected: app loads, Dashboard shows seed recalls, refresh on `#/patients` does not 404.

If `gh api` for pages fails, enable Pages manually: repo → Settings → Pages → Source: `gh-pages` branch, `/ (root)`.

- [ ] **Step 3: Commit nothing further** — deploy writes only to `gh-pages`.

---

## Self-review notes

- Spec §5.1–5.6 each map to Tasks 10–15. §4 → Task 4. §3 → Task 2. §6 → Task 6. §7 storage/today → Tasks 7–8. §8 error cases: corrupt/version → Task 7 + banner in Task 9; phone prefix → `normalizePhone` in Task 11; missing email/phone → disabled links in Task 11; bad import → Task 15. §9 tests → Tasks 2–8. §10 → Task 16.
- `eur` is exported from `RecallTable.tsx` and reused by Stats/VisitTimeline; `realToday` from `AppContext.tsx` reused by Settings.
- Not implemented on purpose (spec §11): auth, auto-send, calendar, photos.
