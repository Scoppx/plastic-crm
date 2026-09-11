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
