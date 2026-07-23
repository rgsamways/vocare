/**
 * Placeholder starter set pending real usage data — same convention as
 * `CRISIS_RESOURCES`/`PERSONA_COMBINATIONS` in config.ts, not a comprehensive
 * role taxonomy. Used only to check a session's transcript for
 * `audience_keyword_matches[]` when the session's anchor has `target_role`
 * set — see m4-post-session-mining/design.md's Decisions.
 */
export interface RoleLanguageCategory {
  category: string;
  /** Substrings/aliases of `target_role` that map to this category. */
  matchKeys: string[];
  terms: string[];
}

export const ROLE_LANGUAGE_REFERENCE: RoleLanguageCategory[] = [
  {
    category: "backend engineer",
    matchKeys: [
      "backend engineer",
      "backend developer",
      "software engineer",
      "software developer",
      "full stack engineer",
      "full-stack engineer",
    ],
    terms: [
      "scalability",
      "latency",
      "throughput",
      "API design",
      "database schema",
      "distributed systems",
      "reliability",
      "technical debt",
      "code review",
      "system design",
    ],
  },
  {
    category: "product manager",
    matchKeys: ["product manager", "product owner"],
    terms: [
      "roadmap",
      "stakeholder alignment",
      "user research",
      "prioritization",
      "go-to-market",
      "product-market fit",
      "customer feedback",
      "trade-offs",
      "cross-functional",
    ],
  },
  {
    category: "designer",
    matchKeys: ["designer", "ux designer", "ui designer", "product designer"],
    terms: [
      "user experience",
      "wireframes",
      "usability",
      "design system",
      "accessibility",
      "user research",
      "prototyping",
      "visual hierarchy",
      "interaction design",
    ],
  },
  // Generic fallback *category* — still requires a confident matchKeys hit,
  // not used as a default when nothing else matches. See design.md: a
  // wrong-category match is worse than no match, so the matching function
  // below returns undefined rather than reaching for this on a miss.
  {
    category: "general professional",
    matchKeys: ["manager", "lead", "specialist", "coordinator", "analyst"],
    terms: [
      "stakeholders",
      "deadlines",
      "ownership",
      "cross-functional collaboration",
      "prioritization",
      "communication",
      "impact",
    ],
  },
];

/**
 * Exact/substring match against `target_role`, checked in the array's
 * declared order (more specific categories first). Returns `undefined` on no
 * confident match — deliberately no nearest-guess fallback.
 */
export function matchRoleLanguage(targetRole: string | null | undefined): string[] | undefined {
  if (!targetRole) return undefined;
  const normalized = targetRole.trim().toLowerCase();
  if (!normalized) return undefined;

  for (const category of ROLE_LANGUAGE_REFERENCE) {
    const isMatch = category.matchKeys.some(
      (key) => normalized === key || normalized.includes(key),
    );
    if (isMatch) return category.terms;
  }

  return undefined;
}
