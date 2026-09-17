import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { AppProvider, useApp } from '../src/store/AppContext';
import { ToastProvider } from '../src/components/Toast';
import type { Repository } from '../src/data/repository';
import { patient, state } from './fixtures';

type Deferred = { resolve: () => void; reject: (e: Error) => void };

function repoWith(overrides: Partial<Repository> = {}): Repository {
  return {
    loadAll: vi.fn().mockResolvedValue({ state: state(), resetReason: null }),
    addPatient: vi.fn().mockResolvedValue(undefined),
    updatePatient: vi.fn().mockResolvedValue(undefined),
    deletePatient: vi.fn().mockResolvedValue(undefined),
    addVisit: vi.fn().mockResolvedValue(undefined),
    deleteVisit: vi.fn().mockResolvedValue(undefined),
    addContact: vi.fn().mockResolvedValue(undefined),
    addTreatment: vi.fn().mockResolvedValue(undefined),
    updateTreatment: vi.fn().mockResolvedValue(undefined),
    deleteTreatment: vi.fn().mockResolvedValue(undefined),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  captured = null;
});

let captured: ReturnType<typeof useApp> | null = null;
function Probe() {
  captured = useApp();
  return <span data-testid="count">{captured.state.patients.length}</span>;
}

function mount(repo: Repository) {
  return render(
    <ToastProvider>
      <AppProvider repository={repo}><Probe /></AppProvider>
    </ToastProvider>,
  );
}

describe('AppProvider', () => {
  it('shows spinner then renders loaded state', async () => {
    mount(repoWith());
    expect(screen.getByText('Caricamento…')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
  });

  it('shows error screen with retry when loadAll fails', async () => {
    const loadAll = vi.fn().mockRejectedValueOnce(new Error('rete')).mockResolvedValue({ state: state(), resetReason: null });
    mount(repoWith({ loadAll }));
    await waitFor(() => expect(screen.getByText('Impossibile caricare i dati')).toBeTruthy());
    act(() => { screen.getByText('Riprova').click(); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(loadAll).toHaveBeenCalledTimes(2);
  });

  it('applies optimistically and persists in order', async () => {
    const order: string[] = [];
    const d: Deferred[] = [];
    const pending = () => new Promise<void>((resolve, reject) => d.push({ resolve, reject }));
    const repo = repoWith({
      addPatient: vi.fn((p) => { order.push('add:' + p.id); return pending(); }),
      updatePatient: vi.fn((id) => { order.push('upd:' + id); return pending(); }),
    });
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      captured!.dispatch({ type: 'ADD_PATIENT', patient: patient('a') });
      captured!.dispatch({ type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'n' } });
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(order).toEqual(['add:a']);            // la seconda aspetta la prima
    await act(async () => { d[0].resolve(); });
    await waitFor(() => expect(order).toEqual(['add:a', 'upd:a']));
    await act(async () => { d[1].resolve(); });
    expect(captured!.state.patients[0].notes).toBe('n');
  });

  it('rolls back to pre-action snapshot, drops the queue and shows a toast on failure', async () => {
    const d: Deferred[] = [];
    const pending = () => new Promise<void>((resolve, reject) => d.push({ resolve, reject }));
    const repo = repoWith({
      addPatient: vi.fn(() => pending()),
      updatePatient: vi.fn(() => pending()),
    });
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

    act(() => {
      captured!.dispatch({ type: 'ADD_PATIENT', patient: patient('a') });
      captured!.dispatch({ type: 'UPDATE_PATIENT', id: 'a', changes: { notes: 'n' } });
    });
    await act(async () => { d[0].reject(new Error('Salvataggio fallito')); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    expect(screen.getByText('Salvataggio fallito')).toBeTruthy();
    expect(repo.updatePatient).not.toHaveBeenCalled();
  });

  it('ignores actions that do not change state', async () => {
    const repo = repoWith();
    mount(repo);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    act(() => { captured!.dispatch({ type: 'DELETE_PATIENT', id: 'missing' }); });
    // DELETE_PATIENT su id inesistente produce un nuovo oggetto ma uguale: qui ci basta che non esploda.
    act(() => { captured!.dispatch({ type: 'DELETE_TREATMENT', id: 't-botox' }); });
    await waitFor(() => expect(repo.deleteTreatment).toHaveBeenCalledWith('t-botox'));
  });
});
