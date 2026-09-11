import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useToday } from '../store/AppContext';
import { computeDueDate } from '../domain/recalls';
import { formatIT, daysBetween } from '../domain/dates';
import PatientForm from '../components/PatientForm';
import TagInput from '../components/TagInput';
import VisitTimeline from '../components/VisitTimeline';
import ConfirmDialog from '../components/ConfirmDialog';

export default function PatientDetail() {
  const { id } = useParams();
  const { state, dispatch } = useApp();
  const today = useToday();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const p = state.patients.find((x) => x.id === id);
  if (!p) return <p>Paziente non trovato.</p>;

  const due = computeDueDate(p.id, state);
  const contacts = state.contacts.filter((c) => c.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const channelLabel = { call: 'Chiamata', whatsapp: 'WhatsApp', email: 'Email' };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.firstName} {p.lastName}</h1>
          <p className="text-sm text-slate-600">{p.phone} · {p.email || 'nessuna email'} · nato il {p.birthDate ? formatIT(p.birthDate) : '—'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="rounded border px-3 py-1 text-sm">Modifica</button>
          <button onClick={() => setConfirming(true)} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">Elimina</button>
        </div>
      </div>

      {editing && (
        <PatientForm
          initial={p}
          onSubmit={(np) => {
            const { firstName, lastName, phone, email, birthDate, notes } = np;
            dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { firstName, lastName, phone, email, birthDate, notes } });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
          <TagInput tags={p.tags} onChange={(tags) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { tags } })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.doNotContact} onChange={(e) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { doNotContact: e.target.checked } })} />
            Non contattare
          </label>
          {!editing && (
            <textarea
              value={p.notes}
              onChange={(e) => dispatch({ type: 'UPDATE_PATIENT', id: p.id, changes: { notes: e.target.value } })}
              placeholder="Note"
              className="w-full rounded border px-2 py-1"
            />
          )}
        </div>
        <div className="rounded-lg border bg-white p-4 text-sm">
          <div className="text-xs uppercase text-slate-500">Prossimo richiamo</div>
          {due ? (
            <>
              <div className="text-lg font-semibold">{formatIT(due.dueDate)}</div>
              <div className="text-slate-600">
                {due.treatment?.name ?? 'Controllo generale'} ·{' '}
                {daysBetween(due.dueDate, today) > 0 ? `in ritardo di ${daysBetween(due.dueDate, today)} gg` : `tra ${-daysBetween(due.dueDate, today)} gg`}
              </div>
            </>
          ) : (
            <div className="text-slate-500">Nessuna visita registrata.</div>
          )}
          <div className="mt-3 text-xs uppercase text-slate-500">Contatti</div>
          {contacts.length === 0 && <div className="text-slate-500">Nessun contatto.</div>}
          <ul>
            {contacts.map((c) => (
              <li key={c.id}>{formatIT(c.date)} · {channelLabel[c.channel]}{c.snoozeUntil ? ` · rimandato al ${formatIT(c.snoozeUntil)}` : ''}</li>
            ))}
          </ul>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Visite</h2>
        <VisitTimeline patientId={p.id} />
      </section>

      {confirming && (
        <ConfirmDialog
          message={`Eliminare ${p.firstName} ${p.lastName} e tutte le sue visite?`}
          onConfirm={() => { dispatch({ type: 'DELETE_PATIENT', id: p.id }); navigate('/patients'); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
