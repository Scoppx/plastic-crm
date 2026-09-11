import { Link } from 'react-router-dom';
import type { Recall } from '../domain/types';
import { formatIT } from '../domain/dates';

export default function RecallTable({ recalls, onContact }: { recalls: Recall[]; onContact: (r: Recall) => void }) {
  if (recalls.length === 0) return <p className="text-slate-500">Nessun paziente da ricontattare.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2">Paziente</th>
            <th className="px-3 py-2">Trattamento</th>
            <th className="px-3 py-2">Ultima visita</th>
            <th className="px-3 py-2">Scadenza</th>
            <th className="px-3 py-2">Ritardo</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {recalls.map((r) => (
            <tr key={r.patient.id} className="border-t">
              <td className="px-3 py-2">
                <Link to={`/patients/${r.patient.id}`} className="font-medium hover:underline">
                  {r.patient.lastName} {r.patient.firstName}
                </Link>
                {r.patient.tags.map((t) => (
                  <span key={t} className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs">{t}</span>
                ))}
              </td>
              <td className="px-3 py-2">{r.treatment?.name ?? 'Controllo generale'}</td>
              <td className="px-3 py-2">{formatIT(r.lastVisitDate)}</td>
              <td className="px-3 py-2">{formatIT(r.dueDate)}</td>
              <td className="px-3 py-2">
                {r.status === 'overdue' ? (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">{r.daysOverdue} gg</span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">tra {-r.daysOverdue} gg</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onContact(r)} className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700">
                  Contatta
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
