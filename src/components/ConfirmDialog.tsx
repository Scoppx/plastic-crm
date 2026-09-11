export default function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border px-3 py-1 text-sm">Annulla</button>
          <button onClick={onConfirm} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Conferma</button>
        </div>
      </div>
    </div>
  );
}
