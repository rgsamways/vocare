const COUNTRIES = [
  "Canada",
  "United States",
  "United Kingdom",
  "Australia",
  "New Zealand",
  "Ireland",
  "India",
  "Germany",
  "France",
  "Netherlands",
  "Sweden",
  "Singapore",
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
