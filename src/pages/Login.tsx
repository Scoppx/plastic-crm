import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.status === 'signedIn') return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    const err = await auth.signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  async function onForgot() {
    if (!email) { setError('Inserisci la tua email, poi premi di nuovo'); return; }
    setError(''); setInfo('');
    const err = await auth.resetPassword(email);
    if (err) setError(err); else setInfo('Email inviata: controlla la posta per reimpostare la password');
  }

  const field = 'w-full rounded border px-3 py-2 text-sm';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6">
        <h1 className="text-xl font-semibold">Accedi</h1>
        <label className="block text-sm">Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required />
        </label>
        <label className="block text-sm">Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-green-700">{info}</p>}
        <button type="submit" disabled={busy} className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <button type="button" onClick={onForgot} className="w-full text-xs text-slate-500 hover:text-slate-800">Password dimenticata</button>
      </form>
    </div>
  );
}
