import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { computeDueDate } from '../domain/recalls';
import { formatIT } from '../domain/dates';
import PatientForm from '../components/PatientForm';

export default function Patients() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('all');
  const [treatmentId, setTreatmentId] = useState('all');
  const [adding, setAdding] = useState(false);

  const allTags = useMemo(() => [...new Set(state.patients.flatMap((p) => p.tags))].sort(), [state.patients]);

  const rows = state.patients
    .filter((p) => {
      const hay = `${p.firstName} ${p.lastName} ${p.phone} ${p.email}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
      if (tag !== 'all' && !p.tags.includes(tag)) return false;
      if (treatmentId !== 'all' && !state.visits.some((v) => v.patientId === p.id && v.treatmentId === treatmentId)) return false;
      return true;
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map((p) => ({ p, due: computeDueDate(p.id, state) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pazienti</h1>
        <button onClick={() => setAdding(true)} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">Nuovo paziente</button>
      </div>
      {adding && (
        <PatientForm
          onSubmit={(p) => { dispatch({ type: 'ADD_PATIENT', patient: p }); setAdding(false); navigate(`/patients/${p.id}`); }}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome, telefono, email" className="rounded border px-2 py-1 text-sm" />
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i trattamenti</option>
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Paziente</th>
              <th className="px-3 py-2">Telefono</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Ultima visita</th>
              <th className="px-3 py-2">Prossimo richiamo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, due }) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/patients/${p.id}`} className="font-medium hover:underline">{p.lastName} {p.firstName}</Link>
                  {p.doNotContact && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">no contatto</span>}
                  {p.tags.map((t) => <span key={t} className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{t}</span>)}
                </td>
                <td className="px-3 py-2">{p.phone}</td>
                <td className="px-3 py-2">{p.email}</td>
                <td className="px-3 py-2">{due ? formatIT(due.lastVisitDate) : '—'}</td>
                <td className="px-3 py-2">{due ? `${formatIT(due.dueDate)} (${due.treatment?.name ?? 'controllo'})` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
