import type { AppState } from '../domain/types';
import { reducer, type Action } from '../store/actions';
import { loadState, saveState } from './storage';
import type { Repository } from './repository';

/** Demo/test: lo stato vive in memoria e viene riscritto per intero in localStorage a ogni azione. */
export function createLocalRepository(today: string): Repository {
  let state: AppState | null = null;

  function apply(action: Action): Promise<void> {
    if (!state) return Promise.reject(new Error('loadAll non ancora chiamato'));
    state = reducer(state, action);
    saveState(state);
    return Promise.resolve();
  }

  return {
    loadAll() {
      const r = loadState(today);
      state = r.state;
      return Promise.resolve(r);
    },
    addPatient: (patient) => apply({ type: 'ADD_PATIENT', patient }),
    updatePatient: (id, changes) => apply({ type: 'UPDATE_PATIENT', id, changes }),
    deletePatient: (id) => apply({ type: 'DELETE_PATIENT', id }),
    addVisit: (visit) => apply({ type: 'ADD_VISIT', visit }),
    deleteVisit: (id) => apply({ type: 'DELETE_VISIT', id }),
    addContact: (contact) => apply({ type: 'ADD_CONTACT', contact }),
    addTreatment: (treatment) => apply({ type: 'ADD_TREATMENT', treatment }),
    updateTreatment: (id, changes) => apply({ type: 'UPDATE_TREATMENT', id, changes }),
    deleteTreatment: (id) => apply({ type: 'DELETE_TREATMENT', id }),
    updateSettings: (changes) => apply({ type: 'UPDATE_SETTINGS', changes }),
    replaceState: (s) => apply({ type: 'REPLACE_STATE', state: s }),
  };
}
