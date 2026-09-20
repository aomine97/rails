import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { semesterEnd, stripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe -> subscriptions table. Idempotent on event id.
 * checkout.session.completed: Semester Pass (one-time) -> plan semester, 4 months. Pro subscriptions are handled by customer.subscription.*.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(raw, sig, secret); }
  catch (e) { return NextResponse.json({ error: `bad signature: ${(e as Error).message}` }, { status: 400 }); }

  const admin = supabaseAdmin();
  const { error: dup } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.metadata?.user_id ?? s.client_reference_id;
        if (!userId) break;
        const student = s.metadata?.student === "true";
        const customer = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
        if (s.mode === "payment") {
          const end = semesterEnd(new Date());
          await admin.from("subscriptions").upsert({
            user_id: userId, plan: "semester", student_price: student, status: "active", stripe_customer_id: customer,
            current_period_end: end.toISOString(), started_at: now, paused_until: null, cancel_at: null, updated_at: now,
          }, { onConflict: "user_id" });
        } else if (customer) {
          await admin.from("subscriptions").upsert({ user_id: userId, stripe_customer_id: customer, student_price: student, updated_at: now }, { onConflict: "user_id" });
        }
        await admin.from("billing_events").insert({ user_id: userId, kind: "checkout_completed", plan: s.metadata?.plan ?? null, student, stripe_id: s.id, payload: { amount_total: s.amount_total, mode: s.mode } });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id ?? (await userByCustomer(admin, sub.customer));
        if (!userId) break;
        const item = sub.items.data[0];
        const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
        const live = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
        const { data: cur } = await admin.from("subscriptions").select("started_at").eq("user_id", userId).maybeSingle();
        await admin.from("subscriptions").upsert({
          user_id: userId, plan: live ? "pro" : "free", status: sub.status, student_price: sub.metadata?.student === "true",
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id, stripe_subscription_id: sub.id, stripe_price_id: item?.price?.id ?? null,
          current_period_end: periodEnd, cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : sub.cancel_at_period_end ? periodEnd : null,
          started_at: cur?.started_at ?? now, paused_until: null, updated_at: now,
        }, { onConflict: "user_id" });
        await admin.from("billing_events").insert({ user_id: userId, kind: "subscription_updated", plan: live ? "pro" : "free", stripe_id: sub.id, payload: { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end } });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id ?? (await userByCustomer(admin, sub.customer));
        if (!userId) break;
        await admin.from("subscriptions").update({ plan: "free", status: "canceled", stripe_subscription_id: null, current_period_end: null, cancel_at: null, updated_at: now }).eq("user_id", userId);
        await admin.from("billing_events").insert({ user_id: userId, kind: "subscription_deleted", stripe_id: sub.id });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object;
        const userId = ch.metadata?.user_id ?? (await userByCustomer(admin, ch.customer));
        if (!userId) break;
        // A refund on a Semester Pass ends it now; Pro refunds are followed by a cancel in the portal.
        const { data: cur } = await admin.from("subscriptions").select("plan").eq("user_id", userId).maybeSingle();
        if (cur?.plan === "semester") await admin.from("subscriptions").update({ plan: "free", status: "canceled", current_period_end: null, updated_at: now }).eq("user_id", userId);
        await admin.from("billing_events").insert({ user_id: userId, kind: "refunded", stripe_id: ch.id, payload: { amount_refunded: ch.amount_refunded } });
        break;
      }
      default: break;
    }
  } catch (e) {
    // Let Stripe retry: drop the idempotency row so the retry is processed.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function userByCustomer(admin: ReturnType<typeof supabaseAdmin>, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string | null> {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", id).maybeSingle();
  return data?.user_id ?? null;
}
