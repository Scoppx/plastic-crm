import { useEffect, useState } from 'react';
import type { ContactChannel, Recall } from '../domain/types';
import { fillTemplate } from '../domain/template';
import { addDaysISO, daysBetween } from '../domain/dates';
import { newId } from '../store/actions';
import { useApp, useToday } from '../store/AppContext';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const withPrefix = digits.startsWith('+') ? digits : '+39' + digits;
  return withPrefix.replace('+', '');
}

export default function ContactDrawer({ recall, onClose }: { recall: Recall; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const today = useToday();
  const [channel, setChannel] = useState<ContactChannel>('whatsapp');
  const p = recall.patient;

  const vars = {
    nome: p.firstName,
    trattamento: recall.treatment?.name ?? 'trattamento',
    mesi: Math.max(1, Math.round(daysBetween(recall.lastVisitDate, today) / 30)),
    clinica: state.settings.clinicName,
  };
  const tpl = state.settings.templates;
  const [subject, setSubject] = useState(() => fillTemplate(tpl.email.subject, vars));
  const [body, setBody] = useState(() => fillTemplate(tpl.whatsapp, vars));

  useEffect(() => {
    setBody(fillTemplate(channel === 'email' ? tpl.email.body : tpl.whatsapp, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const waHref = `https://wa.me/${normalizePhone(p.phone)}?text=${encodeURIComponent(body)}`;
  const mailHref = `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  function markContacted(snooze: boolean) {
    dispatch({
      type: 'ADD_CONTACT',
      contact: {
        id: newId(),
        patientId: p.id,
        date: today,
        channel,
        snoozeUntil: snooze ? addDaysISO(today, state.settings.snoozeDays) : undefined,
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{p.firstName} {p.lastName}</h2>
            <p className="text-sm text-slate-600">{p.phone} · {p.email || 'nessuna email'}</p>
            <p className="text-sm text-slate-600">Ultimo: {recall.treatment?.name ?? 'visita'} · {vars.mesi} mesi fa</p>
            {p.notes && <p className="mt-1 text-sm italic text-slate-500">{p.notes}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
        </div>

        <div className="mt-4 flex gap-2">
          {(['whatsapp', 'email', 'call'] as ContactChannel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`rounded px-3 py-1 text-sm ${channel === c ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}
            >
              {c === 'whatsapp' ? 'WhatsApp' : c === 'email' ? 'Email' : 'Chiamata'}
            </button>
          ))}
        </div>

        {channel !== 'call' && (
          <div className="mt-4 space-y-2">
            {channel === 'email' && (
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full rounded border px-2 py-1 text-sm" />
            <div className="flex flex-wrap gap-2">
              {channel === 'whatsapp' && (
                <a href={p.phone ? waHref : undefined} target="_blank" rel="noreferrer" aria-disabled={!p.phone} tabIndex={p.phone ? undefined : -1}
                  className={`rounded px-3 py-1 text-sm text-white ${p.phone ? 'bg-green-600 hover:bg-green-700' : 'pointer-events-none bg-slate-300'}`}>
                  Apri WhatsApp
                </a>
              )}
              {channel === 'email' && (
                <a href={p.email ? mailHref : undefined} aria-disabled={!p.email} tabIndex={p.email ? undefined : -1}
                  className={`rounded px-3 py-1 text-sm text-white ${p.email ? 'bg-blue-600 hover:bg-blue-700' : 'pointer-events-none bg-slate-300'}`}>
                  Apri email
                </a>
              )}
              <button onClick={() => navigator.clipboard.writeText(body)} className="rounded border px-3 py-1 text-sm">Copia testo</button>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2 border-t pt-4">
          <button onClick={() => markContacted(false)} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700">
            Segna contattato
          </button>
          <button onClick={() => markContacted(true)} className="rounded border px-3 py-1 text-sm">
            Rimanda {state.settings.snoozeDays} gg
          </button>
        </div>
      </aside>
    </div>
  );
}
