export const SITE = "https://rails-psi.vercel.app";

export type Me = { name: string | null; email: string; plan: string; credits: number | "unlimited"; fields: Record<string, string | boolean | string[] | null>; skills: string[] };
export type JobInfo = { id: string; title: string; company: string; location: string | null; fit: number | null; band: string | null; requirements: { text: string; required: boolean; status: string; evidence: string | null }[]; hardBlocks: string[]; softNotes?: string[]; tagged?: boolean; resume: string | null; resumeScore: number | null; coverLetter: string | null; stage: string | null; detailUrl: string };

export async function getToken(): Promise<string | null> {
  const r = await chrome.storage.local.get("rails_token");
  return (r.rails_token as string | undefined) ?? null;
}
export const setToken = (t: string | null) => (t ? chrome.storage.local.set({ rails_token: t }) : chrome.storage.local.remove("rails_token"));

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("not_connected");
  const res = await fetch(`${SITE}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 401) { await setToken(null); throw new Error("not_connected"); }
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  me: () => call<Me>("/api/ext/me"),
  job: (url: string) => call<{ job: JobInfo | null }>(`/api/ext/job?url=${encodeURIComponent(url)}`),
  learned: (domain: string) => call<{ selectors: Record<string, string[]> }>(`/api/ext/fill?domain=${encodeURIComponent(domain)}`),
  score: (body: { url: string; text?: string; title?: string }) => call<{ job: JobInfo; created: boolean }>("/api/ext/score", { method: "POST", body: JSON.stringify(body) }),
  fillReport: (body: { url: string; jobId?: string; leftForYou?: string[]; fields: { key: string; selector: string | null; strategy: string; success: boolean }[] }) => call<{ ok: boolean }>("/api/ext/fill", { method: "POST", body: JSON.stringify(body) }),
};
