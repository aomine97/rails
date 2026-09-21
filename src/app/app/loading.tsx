import { Skeleton } from "@/components/ui";

/** Matches the feed's geometry so nothing jumps when the real cards land. */
export default function Loading() {
  return (
    <div className="flex min-h-screen bg-ground">
      <div className="hidden w-[232px] bg-ink md:block" />
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 md:px-8">
        <Skeleton className="h-8 w-32" /><Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6 flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-32 rounded-xl" />)}</div>
        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[1fr_250px]">
              <div className="flex gap-4"><Skeleton className="h-14 w-14 rounded-xl" /><div className="flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-6 w-3/4" /><Skeleton className="mt-2 h-4 w-1/2" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-2 h-4 w-2/3" /></div></div>
              <Skeleton className="h-52 rounded-2xl" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">Scoring every live posting against your profile…</p>
      </div>
    </div>
  );
}
