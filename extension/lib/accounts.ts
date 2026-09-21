/** ATS accounts (Workday, iCIMS, Oracle, Taleo all want one per company). Rails behaves like a password manager: the password is
 *  generated in the browser, stored only in this browser's extension storage, and filled into the site's own form. It never
 *  reaches Rails' servers. The user clicks Create Account / Sign In unless they turn on "create accounts for me". */
export type Account = { email: string; password: string; createdAt: number; host: string };

const KEY = "rails_accounts";
export async function accounts(): Promise<Record<string, Account>> { try { const r = await chrome.storage.local.get(KEY); return (r[KEY] ?? {}) as Record<string, Account>; } catch { return {}; } }
export async function accountFor(host = location.hostname): Promise<Account | null> { const all = await accounts(); return all[tenantKey(host)] ?? null; }
export async function saveAccount(a: Account) { const all = await accounts(); all[tenantKey(a.host)] = a; await chrome.storage.local.set({ [KEY]: all }); }
export async function forgetAccount(host = location.hostname) { const all = await accounts(); delete all[tenantKey(host)]; await chrome.storage.local.set({ [KEY]: all }); }

/** One account per tenant: nvidia.wd5.myworkdayjobs.com -> nvidia; careers-amd.icims.com -> careers-amd. */
export const tenantKey = (host: string) => host.replace(/^www\./, "").split(".")[0]!.toLowerCase();

/** 16 chars, every class an ATS ever asks for, from crypto randomness. */
export function generatePassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join(""); const buf = new Uint32Array(16); crypto.getRandomValues(buf);
  const chars = [...buf].map((n, i) => (i < 4 ? sets[i]![n % sets[i]!.length]! : all[n % all.length]!));
  for (let i = chars.length - 1; i > 0; i--) { const j = buf[i]! % (i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/** Where the site keeps its account form. Workday ids are fixed; others fall back to type=password. */
export function accountForm(): { mode: "signin" | "create" | null; email: HTMLInputElement | null; password: HTMLInputElement | null; verify: HTMLInputElement | null; submit: HTMLElement | null; terms: HTMLInputElement | null } {
  const q = <T extends Element>(s: string) => document.querySelector<T>(s);
  const create = q<HTMLElement>('[data-automation-id="createAccountSubmitButton"]'); const signin = q<HTMLElement>('[data-automation-id="signInSubmitButton"]');
  const pw = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')];
  if (!pw.length) return { mode: null, email: null, password: null, verify: null, submit: null, terms: null };
  const mode = create ? "create" : signin ? "signin" : pw.length > 1 ? "create" : "signin";
  const email = q<HTMLInputElement>('[data-automation-id="email"] input, input[data-automation-id="email"], input[type="email"], input[autocomplete="username"], input[name*="email" i], input[id*="email" i]');
  const password = q<HTMLInputElement>('[data-automation-id="password"] input, input[data-automation-id="password"]') ?? pw[0]!;
  const verify = q<HTMLInputElement>('[data-automation-id="verifyPassword"] input, input[data-automation-id="verifyPassword"]') ?? (pw.length > 1 ? pw[1]! : null);
  const terms = q<HTMLInputElement>('[data-automation-id="createAccountCheckbox"] input, input[data-automation-id="createAccountCheckbox"]');
  const submit = create ?? signin ?? q<HTMLElement>('button[type="submit"]');
  return { mode, email, password, verify, submit, terms };
}
