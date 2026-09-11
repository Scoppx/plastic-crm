import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, useToday } from '../store/AppContext';
import { computeStats } from '../domain/stats';
import KpiCard from '../components/KpiCard';
import { eur } from '../components/RecallTable';

export default function Stats() {
  const { state } = useApp();
  const today = useToday();
  const s = useMemo(() => computeStats(state, today), [state, today]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Statistiche</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Pazienti" value={s.totalPatients} />
        <KpiCard label="Attivi" value={s.activePatients} hint={`visita negli ultimi ${state.settings.globalDormantDays} gg`} />
        <KpiCard label="Dormienti" value={s.dormantPatients} />
        <KpiCard label="Non contattabili" value={s.doNotContact} />
        <KpiCard label="Tasso recupero" value={s.recoveryRate === null ? '—' : `${Math.round(s.recoveryRate * 100)}%`} hint="visita entro 60 gg dal contatto" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Richiami in scadenza per mese</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.recallsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Richiami" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 font-semibold">Valore recuperabile per trattamento</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.valueByTreatment} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={(v) => eur(v)} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => eur(Number(v))} />
              <Bar dataKey="value" name="Valore" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
