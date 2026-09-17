import type { Action } from '../store/actions';
import type { Repository } from './repository';

/** Traduce un'azione del reducer nella chiamata Repository corrispondente. */
export function persist(repo: Repository, action: Action): Promise<void> {
  switch (action.type) {
    case 'ADD_PATIENT': return repo.addPatient(action.patient);
    case 'UPDATE_PATIENT': return repo.updatePatient(action.id, action.changes);
    case 'DELETE_PATIENT': return repo.deletePatient(action.id);
    case 'ADD_VISIT': return repo.addVisit(action.visit);
    case 'DELETE_VISIT': return repo.deleteVisit(action.id);
    case 'ADD_CONTACT': return repo.addContact(action.contact);
    case 'ADD_TREATMENT': return repo.addTreatment(action.treatment);
    case 'UPDATE_TREATMENT': return repo.updateTreatment(action.id, action.changes);
    case 'DELETE_TREATMENT': return repo.deleteTreatment(action.id);
    case 'UPDATE_SETTINGS': return repo.updateSettings(action.changes);
    case 'REPLACE_STATE':
      if (!repo.replaceState) return Promise.reject(new Error('Operazione non disponibile'));
      return repo.replaceState(action.state);
  }
}
