import { useState } from 'react';

export default function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <span key={t} className="rounded bg-slate-200 px-2 py-0.5 text-xs">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="ml-1 text-slate-500">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Aggiungi tag"
        className="rounded border px-2 py-0.5 text-xs"
      />
    </div>
  );
}
