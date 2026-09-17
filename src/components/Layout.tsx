import { NavLink, Outlet } from 'react-router-dom';
import DemoBanner from './DemoBanner';
import { useApp } from '../store/AppContext';
import { useAuth } from '../auth/AuthContext';
import { isDemo } from '../data';

const links = [
  { to: '/', label: 'Richiami' },
  { to: '/patients', label: 'Pazienti' },
  { to: '/stats', label: 'Statistiche' },
  { to: '/settings', label: 'Impostazioni' },
];

export default function Layout() {
  const { state } = useApp();
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isDemo && <DemoBanner />}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold">{state.settings.clinicName}</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          {!isDemo && (
            <button onClick={() => auth.signOut()} className="ml-auto text-sm text-slate-500 hover:text-slate-900">Esci</button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
