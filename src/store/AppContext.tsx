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

/** L'ultimo elemento della coda è in volo solo se è anche il primo e la pompa sta girando. */
function inFlight(queue: Pending[], pumping: boolean): boolean {
  return queue.length === 1 && pumping;
}

/** Due modifiche consecutive allo stesso record (tastiera) si accorpano in un'unica azione. */
function merge(last: Action, next: Action): Action | null {
  if (last.type === 'UPDATE_SETTINGS' && next.type === 'UPDATE_SETTINGS') {
    return { type: last.type, changes: { ...last.changes, ...next.changes } };
  }
  if (last.type === 'UPDATE_PATIENT' && next.type === 'UPDATE_PATIENT' && last.id === next.id) {
    return { type: last.type, id: last.id, changes: { ...last.changes, ...next.changes } };
  }
  if (last.type === 'UPDATE_TREATMENT' && next.type === 'UPDATE_TREATMENT' && last.id === next.id) {
    return { type: last.type, id: last.id, changes: { ...last.changes, ...next.changes } };
  }
  return null;
}

export function AppProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [state, setStateRaw] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const queue = useRef<Pending[]>([]);
  const pumping = useRef(false);
  const disposed = useRef(false);
  const toast = useToast();

  useEffect(() => {
    disposed.current = false;
    return () => { disposed.current = true; };
  }, []);

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
      if (disposed.current) break;
      const item = queue.current[0];
      try {
        await persist(repository, item.action);
        queue.current.shift();
      } catch (err) {
        queue.current = [];
        setState(item.snapshot);
        if (!disposed.current) toast.show((err as Error).message || 'Salvataggio fallito, riprova');
      }
    }
    pumping.current = false;
  }, [repository, setState, toast]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.length === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const dispatch = useCallback((action: Action) => {
    const current = stateRef.current;
    if (!current) return;
    const next = reducer(current, action);
    if (next === current) return;
    setState(next);
    const last = queue.current.at(-1);
    const merged = last && !inFlight(queue.current, pumping.current) ? merge(last.action, action) : null;
    if (last && merged) {
      last.action = merged; // lo snapshot resta quello precedente alla prima modifica accorpata
    } else {
      queue.current.push({ action, snapshot: current });
    }
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
