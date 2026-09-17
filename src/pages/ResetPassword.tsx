import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Le password non coincidono'); return; }
    const err = await auth.updatePassword(password);
    if (err) setError(err); else navigate('/', { replace: true });
  }

  const field = 'w-full rounded border px-3 py-2 text-sm';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">Nuova password</h1>
        {auth.status !== 'signedIn' && <p className="text-sm text-slate-500">Apri questa pagina dal link ricevuto via email.</p>}
        <label className="block text-sm">Password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required minLength={6} />
        </label>
        <label className="block text-sm">Conferma password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} required minLength={6} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={auth.status !== 'signedIn'} className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Salva</button>
      </form>
    </div>
  );
}
