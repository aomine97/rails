import { htmlToText, UA } from "../ats/util";

export interface PastedPosting { url: string; title: string; company: string; text: string; applyUrl: string }

const strip = (s: string) => s.replace(/\s+/g, " ").trim();

/** Best-effort extraction from any careers page: JSON-LD JobPosting first, then og/title + main text. */
export function parsePostingHtml(url: string, html: string): PastedPosting {
  // 1. schema.org JobPosting
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const list = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const jp = list.find((x: { "@type"?: string | string[] }) => [x?.["@type"]].flat().includes("JobPosting"));
      if (jp) {
        const org = typeof jp.hiringOrganization === "string" ? jp.hiringOrganization : jp.hiringOrganization?.name;
        const desc = htmlToText(jp.description ?? "") ?? "";
        if (jp.title && desc.length > 100) return { url, title: strip(jp.title), company: strip(org ?? hostToName(url)), text: desc, applyUrl: jp.url ?? url };
      }
    } catch { /* next script */ }
  }
  // 2. og:title / <title> + body text
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "Pasted posting";
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>|<header[\s\S]*?<\/header>/gi, "");
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? body;
  const text = htmlToText(main) ?? "";
  const titleClean = strip(og).split(/\s[|·–-]\s/)[0];
  return { url, title: titleClean.slice(0, 160), company: hostToName(url), text, applyUrl: url };
}

export function hostToName(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\.|^jobs\.|^careers\.|^boards\./, "");
    const wd = h.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/); if (wd) return cap(wd[1]);
    const gh = url.match(/greenhouse\.io\/([^/?#]+)/); if (gh) return cap(gh[1]);
    const lv = url.match(/lever\.co\/([^/?#]+)/); if (lv) return cap(lv[1]);
    const ab = url.match(/ashbyhq\.com\/([^/?#]+)/); if (ab) return cap(decodeURIComponent(ab[1]));
    return cap(h.split(".")[0]);
  } catch { return "Unknown"; }
}
const ACRONYMS = new Set(["ibm", "amd", "hp", "hpe", "ea", "sap", "ge", "3m", "att", "ups", "nasa", "aws", "ti", "hrt", "imc", "sig", "bah", "gdit", "caci", "saic", "rtx", "ngc", "lmco", "bny", "ms", "jpmc", "hsbc", "ubs", "cvs", "amex", "mitre", "ibm-careers"]);
const cap = (s: string) => s.replace(/[-_]+/g, " ").split(" ").map((w) => (ACRONYMS.has(w.toLowerCase()) || (w.length <= 3 && /^[a-z]+$/i.test(w))) ? w.toUpperCase() : w.replace(/^\w/, (c) => c.toUpperCase())).join(" ");

export async function fetchPosting(url: string, fetchImpl: typeof fetch = fetch): Promise<PastedPosting> {
  const res = await fetchImpl(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`That page answered ${res.status}. Try the direct posting link, not a search or login page.`);
  const html = await res.text();
  const p = parsePostingHtml(res.url || url, html);
  if (p.text.length < 300) throw new Error("We couldn't read the posting text on that page (it's probably rendered by JavaScript). Paste the description text instead.");
  return p;
}
