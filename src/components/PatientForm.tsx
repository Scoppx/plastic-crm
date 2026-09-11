import { useState, type ChangeEvent } from 'react';
import type { Patient } from '../domain/types';
import { newId } from '../store/actions';
import { useToday } from '../store/AppContext';

export default function PatientForm({ initial, onSubmit, onCancel }: { initial?: Patient; onSubmit: (p: Patient) => void; onCancel: () => void }) {
  const today = useToday();
  const [form, setForm] = useState<Patient>(
    initial ?? { id: newId(), firstName: '', lastName: '', phone: '', email: '', birthDate: '', tags: [], notes: '', doNotContact: false, createdAt: today },
  );
  const set = (k: keyof Patient) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (form.firstName && form.lastName) onSubmit(form); }}
      className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"
    >
      <input required value={form.firstName} onChange={set('firstName')} placeholder="Nome" className="rounded border px-2 py-1" />
      <input required value={form.lastName} onChange={set('lastName')} placeholder="Cognome" className="rounded border px-2 py-1" />
      <input value={form.phone} onChange={set('phone')} placeholder="Telefono (+39...)" className="rounded border px-2 py-1" />
      <input type="email" value={form.email} onChange={set('email')} placeholder="Email" className="rounded border px-2 py-1" />
      <input type="date" value={form.birthDate} onChange={set('birthDate')} className="rounded border px-2 py-1" />
      <textarea value={form.notes} onChange={set('notes')} placeholder="Note" className="rounded border px-2 py-1 sm:col-span-2" />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-white">Salva</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1">Annulla</button>
      </div>
    </form>
  );
}
