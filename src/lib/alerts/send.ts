/** Resend over plain fetch (no SDK). Returns the provider id or throws. */
export function alertsConfigured(): boolean { return !!process.env.RESEND_API_KEY && !!process.env.ALERTS_FROM; }

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }, fetchImpl: typeof fetch = fetch): Promise<string> {
  const key = process.env.RESEND_API_KEY, from = process.env.ALERTS_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY / ALERTS_FROM not set");
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { id?: string };
  return data.id ?? "";
}
