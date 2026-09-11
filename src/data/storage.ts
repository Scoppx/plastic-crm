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
