export default function Loading() {
  return (
    <div className="flex min-h-screen bg-ground">
      <div className="w-[72px] bg-ink" />
      <div className="flex-1 p-6">
        <div className="h-6 w-64 animate-pulse rounded bg-line" />
        <div className="mt-6 flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-surface" />)}</div>
        <p className="mt-6 text-sm text-muted">Scoring every live posting against your profile…</p>
      </div>
    </div>
  );
}
