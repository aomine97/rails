/** Country + currency helpers. Pure. ISO-2 codes everywhere; "REMOTE" means remote with no country. */

const CITY_TO_COUNTRY: [RegExp, string][] = [
  [/\b(canada|toronto|vancouver|montreal|montréal|ottawa|calgary|waterloo|kitchener|edmonton|quebec|québec|mississauga|\b[A-Z][a-z]+, (ON|BC|QC|AB)\b)\b/i, "CA"],
  [/\b(united kingdom|\buk\b|england|scotland|wales|london|manchester|cambridge|oxford|edinburgh|bristol|leeds|birmingham|glasgow|belfast)\b/i, "GB"],
  [/\b(ireland|dublin|cork|galway)\b/i, "IE"],
  [/\b(india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|delhi|noida|gurgaon|gurugram|kolkata|ahmedabad)\b/i, "IN"],
  [/\b(germany|berlin|munich|münchen|hamburg|frankfurt|stuttgart|cologne|köln|düsseldorf)\b/i, "DE"],
  [/\b(france|paris|lyon|toulouse|nice|grenoble)\b/i, "FR"],
  [/\b(netherlands|amsterdam|eindhoven|rotterdam|utrecht|the hague)\b/i, "NL"],
  [/\b(spain|madrid|barcelona|valencia|málaga|malaga)\b/i, "ES"],
  [/\b(italy|milan|milano|rome|roma|turin|torino)\b/i, "IT"],
  [/\b(poland|warsaw|krakow|kraków|wroclaw|wrocław|gdansk|gdańsk)\b/i, "PL"],
  [/\b(sweden|stockholm|gothenburg|göteborg|malmö)\b/i, "SE"],
  [/\b(switzerland|zurich|zürich|geneva|basel|lausanne)\b/i, "CH"],
  [/\b(australia|sydney|melbourne|brisbane|perth|canberra)\b/i, "AU"],
  [/\b(new zealand|auckland|wellington)\b/i, "NZ"],
  [/\b(singapore)\b/i, "SG"], [/\b(hong kong)\b/i, "HK"], [/\b(japan|tokyo|osaka)\b/i, "JP"],
  [/\b(china|shanghai|beijing|shenzhen|hangzhou)\b/i, "CN"], [/\b(taiwan|taipei|hsinchu)\b/i, "TW"], [/\b(korea|seoul)\b/i, "KR"],
  [/\b(israel|tel aviv|haifa|jerusalem)\b/i, "IL"], [/\b(uae|dubai|abu dhabi)\b/i, "AE"],
  [/\b(mexico|méxico|guadalajara|monterrey|mexico city|ciudad de m[eé]xico)\b/i, "MX"], [/\b(brazil|brasil|s[aã]o paulo|rio de janeiro)\b/i, "BR"],
  [/\b(argentina|buenos aires)\b/i, "AR"], [/\b(colombia|bogot[aá]|medell[ií]n)\b/i, "CO"], [/\b(costa rica|san jos[eé])\b/i, "CR"],
  [/\b(philippines|manila|cebu)\b/i, "PH"], [/\b(vietnam|hanoi|ho chi minh)\b/i, "VN"], [/\b(malaysia|kuala lumpur)\b/i, "MY"],
  [/\b(portugal|lisbon|lisboa|porto)\b/i, "PT"], [/\b(belgium|brussels|antwerp)\b/i, "BE"], [/\b(austria|vienna|wien)\b/i, "AT"],
  [/\b(denmark|copenhagen)\b/i, "DK"], [/\b(norway|oslo)\b/i, "NO"], [/\b(finland|helsinki)\b/i, "FI"], [/\b(czech|prague|praha|brno)\b/i, "CZ"],
  [/\b(romania|bucharest|cluj)\b/i, "RO"], [/\b(hungary|budapest)\b/i, "HU"], [/\b(ukraine|kyiv|kiev|lviv)\b/i, "UA"], [/\b(turkey|t[uü]rkiye|istanbul|ankara)\b/i, "TR"],
  [/\b(south africa|cape town|johannesburg)\b/i, "ZA"], [/\b(nigeria|lagos)\b/i, "NG"], [/\b(kenya|nairobi)\b/i, "KE"], [/\b(egypt|cairo)\b/i, "EG"],
  [/\b(pakistan|karachi|lahore|islamabad)\b/i, "PK"], [/\b(bangladesh|dhaka)\b/i, "BD"], [/\b(saudi|riyadh)\b/i, "SA"], [/\b(qatar|doha)\b/i, "QA"],
];
const US_HINT = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b|united states|\busa?\b|u\.s\./;

/** ISO-2 for a job: the tagger's country when it has one, else from the location text. */
export function countryOf(location: string | null | undefined, tagged?: string | null): string {
  if (tagged && tagged !== "unknown") return tagged.toUpperCase();
  const loc = (location ?? "").trim(); if (!loc) return "unknown";
  if (US_HINT.test(loc)) return "US";
  for (const [re, code] of CITY_TO_COUNTRY) if (re.test(loc)) return code;
  if (/\bremote\b/i.test(loc)) return "REMOTE";
  return "unknown";
}

export const COUNTRY_NAME: Record<string, string> = { US: "United States", CA: "Canada", GB: "United Kingdom", IE: "Ireland", IN: "India", DE: "Germany", FR: "France", NL: "Netherlands", ES: "Spain", IT: "Italy", PL: "Poland", SE: "Sweden", CH: "Switzerland", AU: "Australia", NZ: "New Zealand", SG: "Singapore", HK: "Hong Kong", JP: "Japan", CN: "China", TW: "Taiwan", KR: "South Korea", IL: "Israel", AE: "UAE", MX: "Mexico", BR: "Brazil", AR: "Argentina", CO: "Colombia", CR: "Costa Rica", PH: "Philippines", VN: "Vietnam", MY: "Malaysia", PT: "Portugal", BE: "Belgium", AT: "Austria", DK: "Denmark", NO: "Norway", FI: "Finland", CZ: "Czechia", RO: "Romania", HU: "Hungary", UA: "Ukraine", TR: "Türkiye", ZA: "South Africa", NG: "Nigeria", KE: "Kenya", EG: "Egypt", PK: "Pakistan", BD: "Bangladesh", SA: "Saudi Arabia", QA: "Qatar" };

/** Chips on the feed, in the order students ask for them. */
export const COUNTRY_CHIPS: [string, string][] = [["CA", "Canada"], ["GB", "UK"], ["IN", "India"], ["DE", "Germany"]];

const CURRENCY_OF: Record<string, string> = { US: "USD", CA: "CAD", GB: "GBP", IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", IN: "INR", AU: "AUD", NZ: "NZD", SG: "SGD", HK: "HKD", JP: "JPY", CN: "CNY", TW: "TWD", KR: "KRW", IL: "ILS", AE: "AED", MX: "MXN", BR: "BRL", PL: "PLN", SE: "SEK", CH: "CHF", DK: "DKK", NO: "NOK", CZ: "CZK", ZA: "ZAR", PH: "PHP", TR: "TRY", SA: "SAR", QA: "QAR" };
const SYMBOL: Record<string, string> = { USD: "$", CAD: "C$", GBP: "£", EUR: "€", INR: "₹", AUD: "A$", NZD: "NZ$", SGD: "S$", HKD: "HK$", JPY: "¥", CNY: "¥", KRW: "₩", ILS: "₪", MXN: "MX$", BRL: "R$", PLN: "zł", SEK: "kr", CHF: "CHF ", DKK: "kr", NOK: "kr", CZK: "Kč", ZAR: "R", PHP: "₱", TRY: "₺", AED: "AED ", SAR: "SAR ", QAR: "QAR ", TWD: "NT$" };

export function currencyFor(country: string, explicit?: string | null): string {
  if (explicit) return explicit.toUpperCase();
  return CURRENCY_OF[country] ?? "USD";
}

/** "$25 - $32/hr", "£45k - £55k", "₹8L - ₹12L". Compact and honest about the currency. */
export function formatPay(min: number | null, max: number | null, currency: string, period: "hour" | "year" | null): string | null {
  if (min == null && max == null) return null;
  const sym = SYMBOL[currency] ?? `${currency} `;
  const one = (n: number) => {
    if (period === "hour") return `${sym}${Math.round(n)}`;
    if (currency === "INR") return n >= 100_000 ? `${sym}${(n / 100_000).toFixed(n >= 1_000_000 ? 0 : 1).replace(/\.0$/, "")}L` : `${sym}${Math.round(n)}`;
    return n >= 1000 ? `${sym}${Math.round(n / 1000)}k` : `${sym}${Math.round(n)}`;
  };
  const range = min != null && max != null && min !== max ? `${one(min)} - ${one(max)}` : one((min ?? max)!);
  return period === "hour" ? `${range}/hr` : range;
}
