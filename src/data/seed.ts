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
  const rnd = mulberry32(11260910);
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
