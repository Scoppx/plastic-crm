import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState } from '../domain/types';
import { toISODate } from '../domain/dates';
import { loadState, saveState, type ResetReason } from '../data/storage';
import { reducer, type Action } from './actions';

type Ctx = { state: AppState; dispatch: Dispatch<Action>; resetReason: ResetReason };

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
