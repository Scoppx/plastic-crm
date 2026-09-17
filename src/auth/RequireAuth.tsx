import { useMemo } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppProvider, realToday } from '../store/AppContext';
import { createRepository } from '../data';

export default function RequireAuth() {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const repository = useMemo(() => (userId ? createRepository(userId, realToday()) : null), [userId]);

  if (auth.status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Caricamento…</div>;
  }
  if (!repository) return <Navigate to="/login" replace />;
  return (
    <AppProvider repository={repository}>
      <Outlet />
    </AppProvider>
  );
}
