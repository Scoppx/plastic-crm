import { useApp, useToday } from '../store/AppContext';
import { formatIT } from '../domain/dates';

export default function DemoBanner() {
  const { state, resetReason } = useApp();
  const today = useToday();
  return (
    <div className="flex flex-wrap items-center gap-3 bg-amber-100 px-4 py-1 text-xs text-amber-900">
      <span className="rounded bg-amber-500 px-2 py-0.5 font-semibold text-white">DEMO — dati fittizi</span>
      {state.settings.simulatedToday && <span>Data simulata: {formatIT(today)}</span>}
      {resetReason === 'corrupt' && <span>Dati locali non validi: ripristinati i dati demo.</span>}
      {resetReason === 'version' && <span>Dati locali di una versione precedente: ripristinati i dati demo.</span>}
    </div>
  );
}
