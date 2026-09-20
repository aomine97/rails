/** Student-price eligibility. v1: the login email or a saved school email ends in .edu (or a known non-US academic suffix). */
const ACADEMIC = [/\.edu$/i, /\.edu\.[a-z]{2}$/i, /\.ac\.[a-z]{2}$/i];

export function isAcademicEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const at = email.lastIndexOf("@"); if (at < 0) return false;
  const host = email.slice(at + 1).trim().toLowerCase();
  return ACADEMIC.some((re) => re.test(host));
}
