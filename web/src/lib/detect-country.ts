// Only countries with a real, verified entry in backend/src/config.ts's
// CRISIS_RESOURCES belong here — this list is what tells a user "we have a
// specific crisis resource for you," and offering a country we can't
// actually back with one is the exact liability gap this list exists to
// avoid. "Other" always falls through to the generic directory fallback.
// Researched 2026-07-22 — see that file's own comment for sourcing/limits.
const COUNTRIES = [
  "Australia",
  "Austria",
  "Brazil",
  "Canada",
  "Czechia",
  "Finland",
  "France",
  "Germany",
  "Hungary",
  "Iceland",
  "India",
  "Ireland",
  "Japan",
  "Latvia",
  "Lithuania",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Poland",
  "Portugal",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
  "United States",
  "Other",
];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function detectDefaultCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const name = region ? regionNames.of(region) : undefined;
    if (name && COUNTRIES.includes(name)) return name;
  } catch {
    // fall through to default
  }
  return "Canada";
}

export function listCountries(): string[] {
  return COUNTRIES;
}
