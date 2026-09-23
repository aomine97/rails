import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTagText, tagRequest } from "./tagger";
import { applyTags } from "./apply-tags";
import { recordUsage, pipelineSpentToday, pipelineBudgetUsd } from "../ai/usage";

/** Rough cost of one batched tag after trimming, used to size a batch to the remaining daily budget. */
const EST_BATCH_TAG_USD = 0.0025;

/**
 * Nightly bulk tagging through the Message Batches API: half the per-token price, results within hours.
 * submit: untagged jobs with a description -> one batch (custom_id = job id); jobs get tag_batch_id so the 10-min cron skips them.
 * collect: for each open batch, if ended, stream results and apply. Safe to call repeatedly; already-tagged jobs are skipped.
 */
export async function submitTagBatch(db: SupabaseClient, max: number, client = new Anthropic()) {
  // Size the batch to what is left of today's pipeline budget, so a big backlog drains over days instead of in one bill.
  const left = pipelineBudgetUsd() - await pipelineSpentToday(db as never);
  const affordable = Math.floor(Math.max(0, left) / EST_BATCH_TAG_USD);
  const limit = Math.min(Math.max(0, max), 10_000, affordable);
  if (limit < 1) return { submitted: 0, batchId: null, reason: "daily budget reached" };
  const { data: jobs } = await db.from("jobs").select("id,title,location,description_text,companies(name)")
    .is("tagged_at", null).is("closed_at", null).is("tag_batch_id", null).eq("triage", "yes").not("description_text", "is", null).neq("description_text", "")
    .order("first_seen_at", { ascending: false }).limit(limit);
  if (!jobs || jobs.length === 0) return { submitted: 0, batchId: null };
  const requests = jobs.map((j) => ({
    custom_id: j.id,
    params: tagRequest({ title: j.title, company: (j as unknown as { companies: { name: string } | null }).companies?.name ?? "", location: j.location, descriptionText: j.description_text! }),
  }));
  const batch = await client.messages.batches.create({ requests });
  await db.from("tag_batches").insert({ id: batch.id, status: batch.processing_status, submitted: jobs.length });
  // Mark in chunks so a 3,000-id IN() does not hit URL limits.
  for (let i = 0; i < jobs.length; i += 200) await db.from("jobs").update({ tag_batch_id: batch.id }).in("id", jobs.slice(i, i + 200).map((j) => j.id));
  return { submitted: jobs.length, batchId: batch.id };
}

export async function collectTagBatches(db: SupabaseClient, budgetMs: number, client = new Anthropic()) {
  const started = Date.now();
  const { data: open } = await db.from("tag_batches").select("id,status,tagged,failed").neq("status", "done").order("created_at", { ascending: true }).limit(5);
  const out: { id: string; status: string; tagged: number; failed: number; done: boolean }[] = [];
  for (const b of open ?? []) {
    const remote = await client.messages.batches.retrieve(b.id);
    if (remote.processing_status !== "ended") { await db.from("tag_batches").update({ status: remote.processing_status }).eq("id", b.id); out.push({ id: b.id, status: remote.processing_status, tagged: b.tagged, failed: b.failed, done: false }); continue; }
    // Which jobs in this batch still need tags? (re-runs skip the ones already applied)
    const { data: pending } = await db.from("jobs").select("id").eq("tag_batch_id", b.id).is("tagged_at", null);
    const need = new Set((pending ?? []).map((p) => p.id));
    let tagged = 0, failed = 0, budgetHit = false;
    if (need.size > 0) {
      const results = await client.messages.batches.results(b.id);
      const queue: Promise<void>[] = [];
      for await (const r of results) {
        if (!need.has(r.custom_id)) continue;
        if (Date.now() - started > budgetMs) { budgetHit = true; break; }
        const work = (async () => {
          try {
            if (r.result.type !== "succeeded") throw new Error(r.result.type);
            recordUsage("tag_batch", r.result.message.model, r.result.message.usage, true);
            const text = r.result.message.content.find((c) => c.type === "text")?.text ?? "";
            await applyTags(db, r.custom_id, parseTagText(text));
            tagged++;
          } catch {
            failed++;
            // Release it so the 10-minute cron retries online rather than leaving it stuck in a dead batch.
            await db.from("jobs").update({ tag_batch_id: null }).eq("id", r.custom_id);
          }
        })();
        queue.push(work);
        if (queue.length >= 8) { await Promise.all(queue); queue.length = 0; }
      }
      await Promise.all(queue);
    }
    const done = !budgetHit;
    await db.from("tag_batches").update({ status: done ? "done" : "ended", tagged: b.tagged + tagged, failed: b.failed + failed, completed_at: done ? new Date().toISOString() : null }).eq("id", b.id);
    out.push({ id: b.id, status: done ? "done" : "ended", tagged: b.tagged + tagged, failed: b.failed + failed, done });
    if (budgetHit) break;
  }
  return out;
}
