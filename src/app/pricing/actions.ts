"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAcademicEmail } from "@/lib/billing/edu";
import { billingConfigured, priceIdFor, productFor, siteUrl, stripe, PRODUCTS } from "@/lib/billing/stripe";
import { subscriptionOf } from "@/lib/billing/entitlements";

/** Pricing page button -> Stripe Checkout. Student price only when the profile is verified; the server decides, never the form. */
export async function startCheckout(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const planRaw = String(form.get("plan") ?? "pro");
  const reason = String(form.get("reason") ?? "").slice(0, 40);
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/pricing?plan=${planRaw}`)}`);
  if (!billingConfigured()) redirect("/pricing?err=not_configured");
  const plan = planRaw === "semester" ? "semester" : "pro";
  const admin = supabaseAdmin();
  const [{ data: prof }, sub] = await Promise.all([
    admin.from("profiles").select("edu_verified,email,full_name").eq("id", user.id).single(),
    subscriptionOf(admin, user.id),
  ]);
  if (sub && (sub.plan === "pro" || sub.plan === "semester") && sub.status === "active") redirect("/app/billing");
  const student = !!prof?.edu_verified;
  const product = productFor(plan, student);
  const s = stripe();
  let customer = sub?.stripe_customer_id ?? null;
  if (!customer) {
    const c = await s.customers.create({ email: prof?.email ?? user.email ?? undefined, name: prof?.full_name ?? undefined, metadata: { user_id: user.id } });
    customer = c.id;
    await admin.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }
  const session = await s.checkout.sessions.create({
    mode: PRODUCTS[product].mode,
    customer,
    line_items: [{ price: priceIdFor(product), quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${siteUrl()}/app/billing?welcome=1`,
    cancel_url: `${siteUrl()}/pricing?canceled=1`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, product, plan, student: String(student), reason },
    ...(PRODUCTS[product].mode === "subscription"
      ? { subscription_data: { metadata: { user_id: user.id, product, plan, student: String(student) } } }
      // One-time pass: create an invoice so the buyer gets a proper receipt/invoice email like subscribers do.
      : { payment_intent_data: { metadata: { user_id: user.id, product, plan, student: String(student) } }, invoice_creation: { enabled: true, invoice_data: { description: `${PRODUCTS[product].label}: 4 months of Rails Pro`, metadata: { user_id: user.id, product } } } }),
  });
  await admin.from("billing_events").insert({ user_id: user.id, kind: "checkout_started", plan, student, stripe_id: session.id, payload: { reason } });
  if (reason) await admin.from("paywall_events").insert({ user_id: user.id, reason, action: "clicked" });
  if (!session.url) redirect("/pricing?err=stripe");
  redirect(session.url);
}

/** Stripe customer portal: update card, cancel, see invoices. */
export async function openPortal() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");
  const admin = supabaseAdmin();
  const sub = await subscriptionOf(admin, user.id);
  if (!sub?.stripe_customer_id || !billingConfigured()) redirect("/pricing");
  const session = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: `${siteUrl()}/app/billing` });
  await admin.from("billing_events").insert({ user_id: user.id, kind: "portal_opened", stripe_id: sub.stripe_customer_id });
  redirect(session.url);
}

/** "I got hired": Pro cancels at period end; Semester Pass pauses and keeps the remaining days for later. */
export async function gotHired() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");
  const admin = supabaseAdmin();
  const sub = await subscriptionOf(admin, user.id);
  if (!sub) redirect("/app/billing");
  if (sub.plan === "pro" && sub.stripe_subscription_id && billingConfigured()) {
    await stripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    await admin.from("subscriptions").update({ cancel_at: sub.current_period_end, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  } else if (sub.plan === "semester") {
    // Freeze: the remaining time is preserved in paused_until (resume moves current_period_end forward by the paused span).
    await admin.from("subscriptions").update({ paused_until: "2999-01-01", status: "paused", updated_at: new Date().toISOString() }).eq("user_id", user.id);
  }
  await admin.from("billing_events").insert({ user_id: user.id, kind: "pause", plan: sub.plan });
  redirect("/app/billing?hired=1");
}

export async function resumePass() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/billing");
  const admin = supabaseAdmin();
  const { data: sub } = await admin.from("subscriptions").select("plan,status,current_period_end,updated_at").eq("user_id", user.id).maybeSingle();
  if (sub?.plan === "semester" && sub.status === "paused" && sub.current_period_end) {
    const pausedMs = Date.now() - new Date(sub.updated_at).getTime();
    const end = new Date(new Date(sub.current_period_end).getTime() + Math.max(0, pausedMs)).toISOString();
    await admin.from("subscriptions").update({ paused_until: null, status: "active", current_period_end: end, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  }
  redirect("/app/billing");
}

/** Student price without a .edu login: save a school email. v1 trusts the domain; a mailed code lands with the Resend work in Phase 2. */
export async function saveEduEmail(form: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pricing");
  const email = String(form.get("edu_email") ?? "").trim().toLowerCase().slice(0, 200);
  if (!isAcademicEmail(email)) redirect("/pricing?err=not_edu");
  const admin = supabaseAdmin();
  await admin.from("profiles").update({ edu_email: email, edu_verified: true, edu_verified_at: new Date().toISOString() }).eq("id", user.id);
  await admin.from("subscriptions").upsert({ user_id: user.id, student_price: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  redirect("/pricing?student=1");
}
