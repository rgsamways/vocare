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
    prompt: "Tell me about a recent decision you had to make.",
  },
  {
    id: "proud-moment",
    label: "Something you're proud of",
    prompt: "Tell me about something you're proud of.",
  },
  {
    id: "hard-tradeoff",
    label: "A hard tradeoff",
    prompt: "Tell me about a hard tradeoff you've had to navigate.",
  },
  {
    id: "what-drains-you",
    label: "What drains you",
    prompt: "Tell me about something that's been draining your energy lately.",
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
      prompt: `Tell me about a recent decision you had to make related to ${focus}.`,
    },
    {
      id: "proud-moment",
      label: "Something you're proud of",
      prompt: `Tell me about something you're proud of in ${focus}.`,
    },
    {
      id: "hard-tradeoff",
      label: "A hard tradeoff",
      prompt: "Tell me about a hard tradeoff you've had to navigate.",
    },
    {
      id: "what-drains-you",
      label: "What drains you",
      prompt: "Tell me about something that's been draining your energy lately.",
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
 * Starter set keyed by the exact country strings web/src/lib/detect-country.ts
 * already stores on the user record (full display names, not ISO codes).
 * Placeholder content — pending professional review before real launch.
 */
export const CRISIS_RESOURCES: Record<string, CrisisResource> = {
  Canada: {
    name: "Talk Suicide Canada",
    contact: "Call or text 9-8-8",
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
