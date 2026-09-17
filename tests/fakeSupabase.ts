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
      // oxlint-disable-next-line unicorn/no-thenable -- fake must be awaitable like real postgrest-js query builders
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
