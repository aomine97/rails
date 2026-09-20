const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
const US_WORDS = /united states|\busa?\b|u\.s\.|\bus -|^us\b/i;
const INTL = /\b(hong kong|singapore|india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|delhi|noida|gurgaon|gurugram|london|united kingdom|\buk\b|england|scotland|ireland|dublin|canada|toronto|vancouver|montreal|ottawa|calgary|germany|berlin|munich|poland|warsaw|krakow|netherlands|amsterdam|france|paris|spain|madrid|barcelona|italy|milan|sweden|stockholm|switzerland|zurich|belgium|brussels|portugal|lisbon|czech|prague|hungary|budapest|romania|bucharest|israel|tel aviv|uae|dubai|saudi|qatar|australia|sydney|melbourne|new zealand|japan|tokyo|china|shanghai|beijing|shenzhen|taiwan|taipei|korea|seoul|philippines|manila|malaysia|kuala lumpur|vietnam|thailand|bangkok|indonesia|jakarta|mexico|brazil|sao paulo|argentina|buenos aires|colombia|bogota|chile|peru|costa rica|south africa|nigeria|kenya|egypt|turkey|istanbul|pakistan|bangladesh|denmark|copenhagen|norway|oslo|finland|helsinki|austria|vienna|greece|athens|serbia|croatia|slovakia|lithuania|latvia|estonia|ukraine|bulgaria)\b/i;
const DMV = /\b(VA|DC|MD)\b|virginia|washington,? d\.?c|maryland|arlington|mclean|reston|herndon|tysons|fairfax|alexandria|bethesda|rockville|chantilly|ashburn|sterling|leesburg|manassas|springfield|vienna|annandale|columbia, md|silver spring/i;

export type Region = "remote" | "dmv" | "us" | "intl" | "unknown";

const STATE_NAMES: Record<string, string> = { alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",wisconsin:"WI",wyoming:"WY","district of columbia":"DC" };

/** Build a "near me" test from the user's own locations ("McLean, VA", "Austin, Texas", "Remote"). Any state they named counts as near. */
export function nearMatcher(locations: string[]): ((location: string | null | undefined) => boolean) | null {
  const states = new Set<string>(); const cities = new Set<string>();
  for (const raw of locations) {
    const l = raw.trim(); if (!l || /remote/i.test(l)) continue;
    const st = l.match(/\b([A-Z]{2})\b/)?.[1]; if (st && US_STATES.test(st)) states.add(st);
    for (const [name, code] of Object.entries(STATE_NAMES)) if (l.toLowerCase().includes(name)) states.add(code);
    const city = l.split(",")[0].trim().toLowerCase(); if (city && city.length > 2 && !STATE_NAMES[city]) cities.add(city);
  }
  // DMV is one job market: any of the three implies all three
  if (states.has("VA") || states.has("DC") || states.has("MD")) { states.add("VA"); states.add("DC"); states.add("MD"); }
  if (!states.size && !cities.size) return null;
  return (location) => {
    const loc = (location ?? "").toLowerCase(); if (!loc) return false;
    for (const c of cities) if (loc.includes(c)) return true;
    for (const s of states) if (new RegExp(`\\b${s}\\b`).test(location ?? "") || Object.entries(STATE_NAMES).some(([n, code]) => code === s && loc.includes(n))) return true;
    return false;
  };
}

/** Cheap region guess from the location string. Tagged `country` wins when present. */
export function regionOf(location: string | null | undefined, country?: string | null, remote?: boolean | null): Region {
  const loc = (location ?? "").trim();
  if (country === "REMOTE" || remote === true || /\bremote\b/i.test(loc)) {
    // "Remote - India" is not for a US student
    if (INTL.test(loc) && !US_WORDS.test(loc) && !US_STATES.test(loc)) return "intl";
    return "remote";
  }
  if (country && country !== "unknown") return country === "US" ? (DMV.test(loc) ? "dmv" : "us") : "intl";
  if (!loc) return "unknown";
  if (INTL.test(loc) && !US_STATES.test(loc) && !US_WORDS.test(loc)) return "intl";
  if (DMV.test(loc)) return "dmv";
  if (US_STATES.test(loc) || US_WORDS.test(loc)) return "us";
  return "unknown";
}
