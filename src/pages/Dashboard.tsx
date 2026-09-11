import { useMemo, useState } from 'react';
import { useApp, useToday } from '../store/AppContext';
import { computeRecalls } from '../domain/recalls';
import type { Recall, RecallStatus } from '../domain/types';
import KpiCard from '../components/KpiCard';
import RecallTable, { eur } from '../components/RecallTable';

export default function Dashboard() {
  const { state } = useApp();
  const today = useToday();
  const [status, setStatus] = useState<RecallStatus | 'all'>('all');
  const [treatmentId, setTreatmentId] = useState('all');
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Recall | null>(null);

  const recalls = useMemo(() => computeRecalls(state, today), [state, today]);
  const allTags = useMemo(() => [...new Set(state.patients.flatMap((p) => p.tags))].sort(), [state.patients]);

  const filtered = recalls.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (treatmentId !== 'all' && (r.treatment?.id ?? 'none') !== treatmentId) return false;
    if (tag !== 'all' && !r.patient.tags.includes(tag)) return false;
    const name = `${r.patient.firstName} ${r.patient.lastName}`.toLowerCase();
    return name.includes(q.toLowerCase());
  });

  const overdue = recalls.filter((r) => r.status === 'overdue');
  const due = recalls.filter((r) => r.status === 'due');
  const value = recalls.reduce((s, r) => s + r.estimatedValue, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Richiami</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Dormienti" value={overdue.length} hint="oltre la scadenza" />
        <KpiCard label="In scadenza" value={due.length} hint={`entro ${state.settings.recallWindowDays} giorni`} />
        <KpiCard label="Valore recuperabile" value={eur(value)} hint="stima sui prezzi di listino" />
      </div>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome" className="rounded border px-2 py-1 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value as RecallStatus | 'all')} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti gli stati</option>
          <option value="overdue">Dormienti</option>
          <option value="due">In scadenza</option>
        </select>
        <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i trattamenti</option>
          {state.treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="none">Controllo generale</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border px-2 py-1 text-sm">
          <option value="all">Tutti i tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <RecallTable recalls={filtered} onContact={setSelected} />
      {selected && <pre className="text-xs">{selected.patient.id}</pre>}
    </div>
  );
}
