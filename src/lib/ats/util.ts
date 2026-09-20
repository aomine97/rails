import { AdapterError, type AtsKind, type FetchLike } from "./types";

export const UA = "RailsJobs/0.1 (+https://rails.app; jobs@rails.app)";

export async function getJson<T>(ats: AtsKind, company: string, url: string, fetchImpl: FetchLike, init?: RequestInit): Promise<T> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), ...init, headers: { accept: "application/json", "user-agent": UA, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new AdapterError(ats, company, `${init?.method ?? "GET"} ${url} -> ${res.status}`, res.status);
  return (await res.json()) as T;
}

/** Strip tags and unescape the handful of entities job boards actually emit. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ndash;|&mdash;/g, "-")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Greenhouse returns `content` HTML-escaped once. */
export function unescapeHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

export function isRemote(...parts: (string | null | undefined | boolean)[]): boolean | null {
  const s = parts.filter((p) => typeof p === "string").join(" ").toLowerCase();
  if (parts.includes(true)) return true;
  if (!s) return null;
  return /\bremote\b|work from home|anywhere/.test(s);
}

export function toIso(v: string | number | null | undefined): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Cap on postings fetched per company: opts.maxJobs, else RAILS_MAX_JOBS, else unlimited */
export const maxJobs = (opts?: { maxJobs?: number }) => opts?.maxJobs ?? (Number(process.env.RAILS_MAX_JOBS ?? 0) || Infinity);
/** Skip per-posting detail requests: opts.listOnly, else RAILS_LIST_ONLY=1 */
export const listOnly = (opts?: { listOnly?: boolean }) => opts?.listOnly ?? process.env.RAILS_LIST_ONLY === "1";
