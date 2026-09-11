import { useState, type FormEvent } from 'react';
import type { Visit } from '../domain/types';
import { formatIT } from '../domain/dates';
import { newId } from '../store/actions';
import { useApp, useToday } from '../store/AppContext';

export default function VisitTimeline({ patientId }: { patientId: string }) {
  const { state, dispatch } = useApp();
  const today = useToday();
  const visits = state.visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const [treatmentId, setTreatmentId] = useState(state.treatments[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  const tName = (id: string) => state.treatments.find((t) => t.id === id)?.name ?? '?';

  function add(e: FormEvent) {
    e.preventDefault();
    if (!treatmentId || !date) return;
    const v: Visit = { id: newId(), patientId, treatmentId, date, notes };
    dispatch({ type: 'ADD_VISIT', visit: v });
    setNotes('');
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-lg border bg-white p-3 text-sm">
        <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="rounded border px-2 py-1">
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note" className="rounded border px-2 py-1" />
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">Aggiungi visita</button>
      </form>
      <ul className="divide-y rounded-lg border bg-white">
        {visits.length === 0 && <li className="p-3 text-slate-500">Nessuna visita.</li>}
        {visits.map((v) => (
          <li key={v.id} className="flex items-center justify-between p-3 text-sm">
            <span><span className="font-medium">{formatIT(v.date)}</span> · {tName(v.treatmentId)} {v.notes && <span className="text-slate-500">· {v.notes}</span>}</span>
            <button onClick={() => dispatch({ type: 'DELETE_VISIT', id: v.id })} className="text-xs text-red-600">elimina</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
