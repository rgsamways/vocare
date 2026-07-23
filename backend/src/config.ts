/**
 * Placeholder values pending legal review / real beta usage data — see
 * design.md's Open Questions and proposal.md. Not finalized by this change.
 */

/** Recommended target (16+), not Claude's absolute 13+ floor. Revisit after legal review. */
export const MINIMUM_AGE = 16;

export const FREE_SESSION_LIMIT = 3;

/** Rolling-window fair-use velocity cap. Sized loosely for 2-3 real sessions/day; not tuned against beta data. */
export const FAIR_USE_CAP = {
  per24h: 6,
  per30d: 60,
};

export const STRIPE_PRICE_USD_CENTS = 2900;

// --- M2 conversation engine ---
// Model choice, persona list, chip copy, and crisis resources below are all
// placeholders pending real usage data / professional review — see
// m2-conversation-engine/design.md's Open Questions.

/** Per CLAUDE.md's Project Facts — first LLM integration in the codebase. */
export const CONVERSATION_MODEL = "claude-haiku-4-5";
/** Same model as the conversational reply — see design.md's Decisions on why
 * this is a separate, dedicated call rather than folded into that reply. */
export const CRISIS_CHECK_MODEL = "claude-haiku-4-5";

// --- M4 post-session mining ---
// Model choice and both thresholds below are placeholders pending real beta
// usage data — see m4-post-session-mining/design.md's Open Questions.

/** Same model as CONVERSATION_MODEL/CRISIS_CHECK_MODEL. */
export const MINING_MODEL = "claude-haiku-4-5";

/**
 * A session's `topic_relevance_score` (0-100) below this counts as
 * "off-topic" for the fair-use abuse signal — see design.md's Decisions on
 * `getAbuseSignal`. Sized loosely; not tuned against beta data.
 */
export const OFF_TOPIC_THRESHOLD = 30;

/**
 * Number of below-threshold sessions within the existing rolling 24h/30d
 * windows (FAIR_USE_CAP's windows) before `checkEntitlement` denies the next
 * session start via the existing, undisclosed VELOCITY_CAP_MESSAGE.
 */
export const OFF_TOPIC_SESSION_LIMIT = 3;

export interface PersonaCombination {
  ageRange: string;
  genderPresentation: string;
}

/**
 * Starter set for auto-vary / user-selection — deliberately excludes
 * ethnicity/accent (spec Section 24). Exact taxonomy is a craft/product call,
 * not an engineering one; revisit if usage surfaces a persona that reads oddly.
 */
export const PERSONA_COMBINATIONS: PersonaCombination[] = [
  { ageRange: "20s-30s", genderPresentation: "feminine" },
  { ageRange: "20s-30s", genderPresentation: "masculine" },
  { ageRange: "20s-30s", genderPresentation: "neutral" },
  { ageRange: "40s-50s", genderPresentation: "feminine" },
  { ageRange: "40s-50s", genderPresentation: "masculine" },
  { ageRange: "60s+", genderPresentation: "neutral" },
];

/** Qualitative only — never a live countdown, no specific number asserted. */
export const TIME_EXPECTATION_COPY = "Take your time — there's no need to rush.";

export interface TopicSeedChip {
  id: string;
  label: string;
  prompt: string;
}

/** Broad, non-interview-specific starter prompts per the spec's own examples. */
export const GENERIC_TOPIC_SEED_CHIPS: TopicSeedChip[] = [
  {
    id: "recent-decision",
    label: "A recent decision",
    prompt: "I want to talk about a recent decision I had to make.",
  },
  {
    id: "proud-moment",
    label: "Something you're proud of",
    prompt: "I want to talk about something I'm proud of.",
  },
  {
    id: "hard-tradeoff",
    label: "A hard tradeoff",
    prompt: "I want to talk about a hard tradeoff I've had to navigate.",
  },
  {
    id: "what-drains-you",
    label: "What drains you",
    prompt: "I want to talk about something that's been draining my energy lately.",
  },
];

/**
 * Anchor-aware variant — lightly reworded around target_role/target_industry
 * when present. Reuses the same live steering M2 already applies to the
 * conversational reply, not a new mechanism (proposal.md).
 */
export function getTopicSeedChips(anchor?: {
  targetRole?: string | null;
  targetIndustry?: string | null;
}): TopicSeedChip[] {
  const focus = anchor?.targetRole ?? anchor?.targetIndustry;
  if (!focus) return GENERIC_TOPIC_SEED_CHIPS;

  return [
    {
      id: "recent-decision",
      label: "A recent decision",
      prompt: `I want to talk about a recent decision I had to make related to ${focus}.`,
    },
    {
      id: "proud-moment",
      label: "Something you're proud of",
      prompt: `I want to talk about something I'm proud of in ${focus}.`,
    },
    {
      id: "hard-tradeoff",
      label: "A hard tradeoff",
      prompt: "I want to talk about a hard tradeoff I've had to navigate.",
    },
    {
      id: "what-drains-you",
      label: "What drains you",
      prompt: "I want to talk about something that's been draining my energy lately.",
    },
  ];
}

export interface CrisisResource {
  name: string;
  contact: string;
  description: string;
  /**
   * The actual link destination — stored explicitly rather than inferred
   * from `contact`'s display text at render time. A prior version tried to
   * guess tel: vs. https: from whether `contact` contained a "." and got it
   * wrong for every real phone-line resource; see FIXLIST.md-style lesson,
   * flagged during M2's grading pass.
   */
  href: string;
}

/**
 * Keyed by the exact country strings web/src/lib/detect-country.ts's
 * COUNTRIES array already stores on the user record (full display names,
 * not ISO codes) — that array is meant to list *only* countries with a real
 * entry here (see its own comment). Kept in sync by hand; there is no
 * compile-time check tying the two lists together (see
 * crisis-safety.test.ts's cross-check test for the regression coverage this
 * gets instead).
 *
 * Researched 2026-07-22 against primary/official sources (government health
 * ministries, the org's own site) via live web search, not recalled from
 * training data — see FIXLIST.md and vocare-project-specification.md
 * Section 24 for the research process and its limits. Countries
 * investigated but found to have no single, clean, national 24/7 line
 * (e.g. Italy, Turkey, Saudi Arabia) are deliberately excluded rather than
 * given an approximate or partial-coverage number — this still needs real
 * professional review before launch, this pass is a large improvement over
 * the prior 3-country map, not a substitute for that review.
 */
export const CRISIS_RESOURCES: Record<string, CrisisResource> = {
  Canada: {
    name: "988: Suicide Crisis Helpline",
    contact: "Call or text 988",
    description: "Free, 24/7 support for anyone in Canada in crisis or thinking about suicide.",
    href: "tel:988",
  },
  "United States": {
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    description: "Free, 24/7 confidential support for anyone in the US in crisis or emotional distress.",
    href: "tel:988",
  },
  "United Kingdom": {
    name: "Samaritans",
    contact: "Call 116 123",
    description: "Free, 24/7 confidential support for anyone in the UK struggling to cope.",
    href: "tel:116123",
  },
  Australia: {
    name: "Lifeline Australia",
    contact: "Call 13 11 14 or text 0477 13 11 14",
    description: "Free, 24/7 support for anyone in Australia in crisis or thinking about suicide.",
    href: "tel:131114",
  },
  "New Zealand": {
    name: "1737: Need to Talk?",
    contact: "Call or text 1737",
    description: "Free, 24/7 support for anyone in New Zealand in crisis or thinking about suicide.",
    href: "tel:1737",
  },
  Ireland: {
    name: "Pieta",
    contact: "Call 1800 247 247 or text HELP to 51444",
    description: "Free, 24/7 support for anyone in Ireland in crisis or thinking about suicide.",
    href: "tel:1800247247",
  },
  India: {
    name: "Tele-MANAS",
    contact: "Call 14416",
    description: "Free, 24/7 support for anyone in India in crisis, in 20+ languages.",
    href: "tel:14416",
  },
  Germany: {
    name: "TelefonSeelsorge",
    contact: "Call 0800 111 0111",
    description: "Free, 24/7 confidential support for anyone in Germany in crisis.",
    href: "tel:08001110111",
  },
  France: {
    name: "3114",
    contact: "Call 3114",
    description: "Free, 24/7 national suicide prevention line for anyone in France.",
    href: "tel:3114",
  },
  Netherlands: {
    name: "113 Zelfmoordpreventie",
    contact: "Call or chat 113",
    description: "Free, 24/7 support for anyone in the Netherlands in crisis or thinking about suicide.",
    href: "tel:113",
  },
  Sweden: {
    name: "Mind Självmordslinjen",
    contact: "Call or chat 90101",
    description: "Free, 24/7 support for anyone in Sweden in crisis or thinking about suicide.",
    href: "tel:90101",
  },
  Singapore: {
    name: "Samaritans of Singapore (SOS)",
    contact: "Call 1-767",
    description: "Free, 24/7 support for anyone in Singapore in crisis or thinking about suicide.",
    href: "tel:1767",
  },
  Spain: {
    name: "Línea 024",
    contact: "Call 024",
    description: "Free, 24/7 national crisis line for anyone in Spain, including sign-language video support.",
    href: "tel:024",
  },
  Portugal: {
    name: "Linha Nacional de Prevenção do Suicídio",
    contact: "Call 1411",
    description: "Free, 24/7 national suicide prevention line for anyone in Portugal.",
    href: "tel:1411",
  },
  Austria: {
    name: "TelefonSeelsorge",
    contact: "Call 142",
    description: "Free, 24/7 confidential support for anyone in Austria in crisis.",
    href: "tel:142",
  },
  Switzerland: {
    name: "Die Dargebotene Hand",
    contact: "Call 143",
    description: "Free, 24/7 confidential support for anyone in Switzerland in crisis.",
    href: "tel:143",
  },
  Norway: {
    name: "Mental Helse Hjelpetelefonen",
    contact: "Call 116 123",
    description: "Free, 24/7 confidential support for anyone in Norway in crisis.",
    href: "tel:116123",
  },
  Finland: {
    name: "MIELI Kriisipuhelin",
    contact: "Call +358 9 2525 0111",
    description: "Free, 24/7 crisis line for anyone in Finland.",
    href: "tel:+358925250111",
  },
  Iceland: {
    name: "Hjálparsími Rauða krossins",
    contact: "Call 1717",
    description: "Free, 24/7 support for anyone in Iceland in crisis.",
    href: "tel:1717",
  },
  Poland: {
    name: "116 123",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Poland in crisis.",
    href: "tel:116123",
  },
  Czechia: {
    name: "Linka první psychické pomoci",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Czechia in crisis.",
    href: "tel:116123",
  },
  Slovakia: {
    name: "Linka dôvery Nezábudka",
    contact: "Call 0800 800 566",
    description: "Free, 24/7 support for anyone in Slovakia in crisis.",
    href: "tel:0800800566",
  },
  Hungary: {
    name: "116-123",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Hungary in crisis.",
    href: "tel:116123",
  },
  Slovenia: {
    name: "Zaupni telefon Samarijan",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Slovenia in crisis.",
    href: "tel:116123",
  },
  Latvia: {
    name: "Skalbes",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Latvia in crisis.",
    href: "tel:116123",
  },
  Lithuania: {
    name: "Vilties linija",
    contact: "Call 116 123",
    description: "Free, 24/7 support for anyone in Lithuania in crisis.",
    href: "tel:116123",
  },
  Mexico: {
    name: "Línea de la Vida",
    contact: "Call 800 911 2000",
    description: "Free, 24/7 national crisis line for anyone in Mexico.",
    href: "tel:8009112000",
  },
  Brazil: {
    name: "CVV — Centro de Valorização da Vida",
    contact: "Call or chat 188",
    description: "Free, 24/7 support for anyone in Brazil in crisis or thinking about suicide.",
    href: "tel:188",
  },
  Japan: {
    name: "Yorisoi Hotline",
    contact: "Call 0120-279-338",
    description: "Free, 24/7 support for anyone in Japan in crisis.",
    href: "tel:0120279338",
  },
  "South Korea": {
    name: "Suicide Prevention Counseling Hotline",
    contact: "Call 109",
    description: "Free, 24/7 support for anyone in South Korea in crisis.",
    href: "tel:109",
  },
  "South Africa": {
    name: "SADAG Suicide Crisis Helpline",
    contact: "Call 0800 567 567",
    description: "Free, 24/7 support for anyone in South Africa in crisis.",
    href: "tel:0800567567",
  },
};

export const GENERIC_CRISIS_RESOURCE: CrisisResource = {
  name: "Find A Helpline",
  contact: "findahelpline.com",
  description: "A directory of crisis helplines by country, for support right now.",
  href: "https://findahelpline.com",
};

export function getCrisisResource(country: string | null | undefined): CrisisResource {
  if (!country) return GENERIC_CRISIS_RESOURCE;
  return CRISIS_RESOURCES[country] ?? GENERIC_CRISIS_RESOURCE;
}
