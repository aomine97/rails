const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
const US_WORDS = /united states|\busa?\b|u\.s\.|\bus -|^us\b/i;
const INTL = /\b(hong kong|singapore|india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|delhi|noida|gurgaon|gurugram|london|united kingdom|\buk\b|england|scotland|ireland|dublin|canada|toronto|vancouver|montreal|ottawa|calgary|germany|berlin|munich|poland|warsaw|krakow|netherlands|amsterdam|france|paris|spain|madrid|barcelona|italy|milan|sweden|stockholm|switzerland|zurich|belgium|brussels|portugal|lisbon|czech|prague|hungary|budapest|romania|bucharest|israel|tel aviv|uae|dubai|saudi|qatar|australia|sydney|melbourne|new zealand|japan|tokyo|china|shanghai|beijing|shenzhen|taiwan|taipei|korea|seoul|philippines|manila|malaysia|kuala lumpur|vietnam|thailand|bangkok|indonesia|jakarta|mexico|brazil|sao paulo|argentina|buenos aires|colombia|bogota|chile|peru|costa rica|south africa|nigeria|kenya|egypt|turkey|istanbul|pakistan|bangladesh|denmark|copenhagen|norway|oslo|finland|helsinki|austria|vienna|greece|athens|serbia|croatia|slovakia|lithuania|latvia|estonia|ukraine|bulgaria)\b/i;
const DMV = /\b(VA|DC|MD)\b|virginia|washington,? d\.?c|maryland|arlington|mclean|reston|herndon|tysons|fairfax|alexandria|bethesda|rockville|chantilly|ashburn|sterling|leesburg|manassas|springfield|vienna|annandale|columbia, md|silver spring/i;

export type Region = "remote" | "dmv" | "us" | "intl" | "unknown";

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
