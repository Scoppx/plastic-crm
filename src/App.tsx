import { useMemo } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, realToday } from './store/AppContext';
import { ToastProvider } from './components/Toast';
import { createRepository } from './data';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  const repository = useMemo(() => createRepository('local', realToday()), []);
  return (
    <ToastProvider>
      <AppProvider repository={repository}>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientDetail />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </AppProvider>
    </ToastProvider>
  );
}
