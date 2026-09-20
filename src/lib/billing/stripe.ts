import Stripe from "stripe";
import { PRICES } from "./plans";

/** Lazy client so builds and tests never need the key. Throws only when a billing action actually runs. */
let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}

export type Product = "pro_monthly" | "pro_monthly_student" | "semester" | "semester_student";

export const PRODUCTS: Record<Product, { plan: "pro" | "semester"; student: boolean; mode: "subscription" | "payment"; amount: number; env: string; label: string }> = {
  pro_monthly:         { plan: "pro", student: false, mode: "subscription", amount: PRICES.proMonthly,        env: "STRIPE_PRICE_PRO_MONTHLY",         label: "Rails Pro, monthly" },
  pro_monthly_student: { plan: "pro", student: true,  mode: "subscription", amount: PRICES.proMonthlyStudent, env: "STRIPE_PRICE_PRO_MONTHLY_STUDENT", label: "Rails Pro, monthly (student)" },
  semester:            { plan: "semester", student: false, mode: "payment", amount: PRICES.semester,          env: "STRIPE_PRICE_SEMESTER",            label: "Semester Pass" },
  semester_student:    { plan: "semester", student: true,  mode: "payment", amount: PRICES.semesterStudent,   env: "STRIPE_PRICE_SEMESTER_STUDENT",    label: "Semester Pass (student)" },
};

export function productFor(plan: "pro" | "semester", student: boolean): Product {
  return plan === "pro" ? (student ? "pro_monthly_student" : "pro_monthly") : student ? "semester_student" : "semester";
}

export function priceIdFor(product: Product): string {
  const id = process.env[PRODUCTS[product].env];
  if (!id) throw new Error(`${PRODUCTS[product].env} is not set`);
  return id;
}

export function billingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && Object.values(PRODUCTS).every((p) => !!process.env[p.env]);
}

/** Semester Pass is a one-time payment that grants 4 months. */
export function semesterEnd(from: Date): Date {
  const d = new Date(from); d.setMonth(d.getMonth() + PRICES.semesterMonths); return d;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}
