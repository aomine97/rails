"use client";

import { useActionState } from "react";
import { UpgradeCard } from "@/components/upgrade-card";
import { refillLabel } from "@/lib/billing/entitlements";
import { tailorResume, type TailorState } from "./actions";

export function TailorForm({ jobId, hasPrior, tagged, plan, balance, refillAt, student }: { jobId: string; hasPrior: boolean; tagged: boolean; plan: string; balance: number; refillAt: string | null; student: boolean }) {
  const [state, action, pending] = useActionState<TailorState, FormData>(tailorResume, {});
  if (state.locked) return <UpgradeCard reason="tailor_locked" vars={{ before: "", after: "", refillIn: refillLabel(state.locked.refillAt) }} student={student} />;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <button disabled={pending || !tagged} className="rounded-full bg-orange px-5 py-2.5 text-[14px] font-extrabold text-ink disabled:opacity-60">
        {pending ? "Rewriting (about 30 seconds)…" : hasPrior ? "Re-tailor" : "Tailor my resume"}
      </button>
      <span className="text-[13px] text-muted">{plan === "free" ? `1 credit · you have ${balance}${balance === 0 && refillAt ? `, refills in ${refillLabel(refillAt)}` : ""}` : "Unlimited on your plan"}</span>
      {!tagged && <span className="text-[13px] text-amber">This posting isn&apos;t tagged yet; check back shortly.</span>}
      {state.error && <span className="w-full text-[13px] font-medium text-red">{state.error}</span>}
    </form>
  );
}
