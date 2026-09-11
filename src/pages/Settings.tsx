import { useState, type ChangeEvent } from 'react';
import { useApp, realToday } from '../store/AppContext';
import { createSeed } from '../data/seed';
import { exportJSON, parseImport } from '../data/storage';
import { newId } from '../store/actions';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState('');
  const [newT, setNewT] = useState({ name: '', recallDays: '' });

  const num = (v: string) => (v === '' ? null : Number(v));
  const usedTreatment = (id: string) => state.visits.some((v) => v.treatmentId === id);

  const setDays = (key: 'globalDormantDays' | 'recallWindowDays' | 'snoozeDays') => (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (e.target.value === '' || !Number.isFinite(v) || v < 0) return;
    dispatch({ type: 'UPDATE_SETTINGS', changes: { [key]: v } });
  };

  function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        dispatch({ type: 'REPLACE_STATE', state: parseImport(text) });
        setImportError('');
      } catch (err) {
        setImportError((err as Error).message);
      }
    });
    e.target.value = '';
  }

  function download() {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plastic-crm-${realToday()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const field = 'w-full rounded border px-2 py-1 text-sm';

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Impostazioni</h1>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Studio</h2>
        <label className="block text-sm">Nome clinica
          <input value={s.clinicName} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { clinicName: e.target.value } })} className={field} />
        </label>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <label>Soglia dormienza (gg)
            <input type="number" value={s.globalDormantDays} onChange={setDays('globalDormantDays')} className={field} />
          </label>
          <label>Finestra richiamo (gg)
            <input type="number" value={s.recallWindowDays} onChange={setDays('recallWindowDays')} className={field} />
          </label>
          <label>Rimanda di (gg)
            <input type="number" value={s.snoozeDays} onChange={setDays('snoozeDays')} className={field} />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Trattamenti</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th>Nome</th><th>Richiamo (gg)</th><th></th></tr>
          </thead>
          <tbody>
            {state.treatments.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-1 pr-2"><input value={t.name} onChange={(e) => dispatch({ type: 'UPDATE_TREATMENT', id: t.id, changes: { name: e.target.value } })} className={field} /></td>
                <td className="py-1 pr-2"><input type="number" value={t.recallDays ?? ''} placeholder="nessuno" onChange={(e) => dispatch({ type: 'UPDATE_TREATMENT', id: t.id, changes: { recallDays: num(e.target.value) } })} className={field} /></td>
                <td className="py-1">
                  <button
                    disabled={usedTreatment(t.id)}
                    title={usedTreatment(t.id) ? 'Ha visite associate' : ''}
                    onClick={() => dispatch({ type: 'DELETE_TREATMENT', id: t.id })}
                    className="text-xs text-red-600 disabled:text-slate-300"
                  >elimina</button>
                </td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="py-1 pr-2"><input value={newT.name} onChange={(e) => setNewT({ ...newT, name: e.target.value })} placeholder="Nuovo trattamento" className={field} /></td>
              <td className="py-1 pr-2"><input type="number" value={newT.recallDays} onChange={(e) => setNewT({ ...newT, recallDays: e.target.value })} placeholder="nessuno" className={field} /></td>
              <td className="py-1">
                <button
                  onClick={() => {
                    if (!newT.name) return;
                    dispatch({ type: 'ADD_TREATMENT', treatment: { id: newId(), name: newT.name, recallDays: num(newT.recallDays) } });
                    setNewT({ name: '', recallDays: '' });
                  }}
                  className="text-xs text-indigo-600"
                >aggiungi</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Template messaggi</h2>
        <p className="text-xs text-slate-500">Segnaposto: {'{nome} {trattamento} {mesi} {clinica}'}</p>
        <label className="block text-sm">WhatsApp
          <textarea rows={4} value={s.templates.whatsapp} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, whatsapp: e.target.value } } })} className={field} />
        </label>
        <label className="block text-sm">Oggetto email
          <input value={s.templates.email.subject} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, email: { ...s.templates.email, subject: e.target.value } } } })} className={field} />
        </label>
        <label className="block text-sm">Corpo email
          <textarea rows={6} value={s.templates.email.body} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { templates: { ...s.templates, email: { ...s.templates.email, body: e.target.value } } } })} className={field} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Demo</h2>
        <label className="block text-sm">Simula data odierna
          <div className="flex gap-2">
            <input type="date" value={s.simulatedToday ?? ''} onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: e.target.value || undefined } })} className={field} />
            <button onClick={() => dispatch({ type: 'UPDATE_SETTINGS', changes: { simulatedToday: undefined } })} className="rounded border px-3 py-1 text-sm">Azzera</button>
          </div>
        </label>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={download} className="rounded border px-3 py-1">Esporta JSON</button>
          <label className="cursor-pointer rounded border px-3 py-1">
            Importa JSON
            <input type="file" accept="application/json" onChange={onImport} className="hidden" />
          </label>
          <button onClick={() => setConfirmReset(true)} className="rounded border border-red-300 px-3 py-1 text-red-700">Reset dati demo</button>
        </div>
        {importError && <p className="text-sm text-red-600">{importError}</p>}
      </section>

      {confirmReset && (
        <ConfirmDialog
          message="Sostituire tutti i dati con i dati demo?"
          onConfirm={() => { dispatch({ type: 'REPLACE_STATE', state: createSeed(realToday()) }); setConfirmReset(false); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
