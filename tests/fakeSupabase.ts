import type { SupabaseClient } from '@supabase/supabase-js';

export type Call = {
  table: string; op: string; payload?: unknown; filters: Array<[string, string, unknown]>;
  order?: string[]; range?: [number, number];
};
type Result = { data: unknown; error: { code?: string; message: string } | null };

/** Registra ogni chiamata e risponde con i risultati preimpostati per tabella (fissi o calcolati dalla chiamata). */
export function fakeSupabase(results: Record<string, Result | ((call: Call) => Result)> = {}) {
  const calls: Call[] = [];

  function query(table: string) {
    const call: Call = { table, op: '', filters: [] };
    calls.push(call);
    const q = {
      select: () => { call.op = 'select'; return q; },
      insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return q; },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return q; },
      upsert: (payload: unknown) => { call.op = 'upsert'; call.payload = payload; return q; },
      delete: () => { call.op = 'delete'; return q; },
      eq: (col: string, val: unknown) => { call.filters.push([col, 'eq', val]); return q; },
      order: (col: string) => { (call.order ??= []).push(col); return q; },
      range: (from: number, to: number) => { call.range = [from, to]; return q; },
      single: () => q,
      maybeSingle: () => q,
      // oxlint-disable-next-line unicorn/no-thenable -- fake must be awaitable like real postgrest-js query builders
      then: (resolve: (r: Result) => void) => {
        const r = results[table];
        resolve(typeof r === 'function' ? r(call) : r ?? { data: [], error: null });
      },
    };
    return q;
  }

  const client = { from: query } as unknown as SupabaseClient;
  return { client, calls };
}
