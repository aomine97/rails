export const SITE = "https://rails-psi.vercel.app";

export type MeExperience = { title: string; org: string; kind: string; start: string | null; end: string | null; current: boolean; bullets: string[] };
export type MeEducation = { school: string; degree: string | null; degreeName: string | null; field: string | null; startYear: number | null; gradYear: number | null; gpa: number | null };
export type Me = { name: string | null; email: string; plan: string; credits: number | "unlimited"; fields: Record<string, string | boolean | string[] | null>; skills: string[]; experience?: MeExperience[]; education?: MeEducation[] };
export type JobInfo = { id: string; title: string; company: string; companyDomain?: string | null; companyLogo?: string | null; location: string | null; postedAt?: string | null; source?: string | null; remote?: boolean | null; pay?: string | null; fit: number | null; band: string | null; requirements: { text: string; required: boolean; status: string; evidence: string | null }[]; hardBlocks: string[]; softNotes?: string[]; tagged?: boolean; keywords?: { matched: string[]; missing: { key: string; required: boolean }[] }; titleMatch?: "strong" | "partial" | "none" | "unknown"; yourTitle?: string | null; level?: string | null; field?: string | null; sub?: { experience: number; skills: number; field: number } | null; resume: string | null; resumeScore: number | null; coverLetter: string | null; stage: string | null; detailUrl: string };

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
  if (!res.ok) { let msg = `${res.status}`; try { const j = await res.json(); if (j?.error === "locked") msg = `locked:${j.refillIn}`; else if (j?.error) msg = `${res.status}:${j.error}`; } catch { /* plain */ } throw new Error(msg); }
  return (await res.json()) as T;
}

export const api = {
  me: () => call<Me>("/api/ext/me"),
  job: (url: string) => call<{ job: JobInfo | null }>(`/api/ext/job?url=${encodeURIComponent(url)}`),
  learned: (domain: string) => call<{ selectors: Record<string, string[]> }>(`/api/ext/fill?domain=${encodeURIComponent(domain)}`),
  applied: (body: { url: string; jobId?: string | null; title: string; company: string }) => call<{ ok: boolean }>("/api/ext/applied", { method: "POST", body: JSON.stringify(body) }),
  score: (body: { url: string; text?: string; title?: string; company?: string }) => call<{ job: JobInfo; created: boolean }>("/api/ext/score", { method: "POST", body: JSON.stringify(body) }),
  tailor: (jobId: string) => call<{ text: string; coverageBefore: number; coverageAfter: number; printUrl: string }>("/api/ext/tailor", { method: "POST", body: JSON.stringify({ jobId }) }),
  letter: (jobId: string) => call<{ letter: string; sources: string[] }>("/api/ext/letter", { method: "POST", body: JSON.stringify({ jobId }) }),
  answers: (body: { url?: string; company?: string; title?: string; questions: { id: string; label: string; kind: string; options?: string[]; required?: boolean }[] }) => call<{ answers: { id: string; value: string | string[] | null; why: string }[] }>("/api/ext/answers", { method: "POST", body: JSON.stringify(body) }),
  addSkill: (skill: string, evidence?: string) => call<{ ok: boolean }>("/api/ext/skill", { method: "POST", body: JSON.stringify({ skill, evidence }) }),
  /** Binary: the file to attach. Returns null when there is nothing to attach (no resume uploaded / no letter). */
  file: async (kind: "resume" | "letter", jobId?: string | null): Promise<{ name: string; type: string; kind: string; bytes: ArrayBuffer } | null> => {
    const token = await getToken(); if (!token) return null;
    const res = await fetch(`${SITE}/api/ext/resume?kind=${kind}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ""}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return { name: res.headers.get("x-rails-filename") ?? `${kind}.pdf`, type: res.headers.get("content-type") ?? "application/pdf", kind: res.headers.get("x-rails-kind") ?? kind, bytes: await res.arrayBuffer() };
  },
  fillReport: (body: { url: string; jobId?: string; leftForYou?: string[]; fields: { key: string; selector: string | null; strategy: string; success: boolean }[] }) => call<{ ok: boolean }>("/api/ext/fill", { method: "POST", body: JSON.stringify(body) }),
};
