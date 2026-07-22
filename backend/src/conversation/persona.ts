import { PERSONA_COMBINATIONS, type PersonaCombination } from "../config.js";

/**
 * Deterministic, not random — Math.random()/Date.now() have no place in this
 * kind of app-code selection either, but the real reason is that the same
 * session id must always resolve to the same persona (design.md's Decisions:
 * "chosen server-side at session start... not re-rolled mid-conversation").
 * A simple djb2-style hash over the session id gives pseudo-uniform spread.
 */
function hashToIndex(sessionId: string, modulus: number): number {
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 33) ^ sessionId.charCodeAt(i);
  }
  return Math.abs(hash) % modulus;
}

/**
 * Auto-vary (default) picks pseudo-uniformly from PERSONA_COMBINATIONS using
 * the session id as the seed. User-selected mode is just this function being
 * given `requested` instead — same code path either way (design.md).
 */
export function selectPersona(
  sessionId: string,
  requested?: PersonaCombination,
): PersonaCombination {
  if (requested) return requested;
  const index = hashToIndex(sessionId, PERSONA_COMBINATIONS.length);
  return PERSONA_COMBINATIONS[index];
}

/**
 * One parameterized instruction rather than per-persona few-shot prose — the
 * "equally warm/professional" requirement (proposal.md) is naturally
 * satisfied by using the identical template for every combination, since
 * nothing in the wording varies by which age-range/gender-presentation slot
 * in gets filled in. Explicitly excludes ethnicity/accent (spec Section 24).
 */
export function buildPersonaFramingBlock(persona: PersonaCombination): string {
  return `You are presenting, in this conversation only, as a person in their ${persona.ageRange} with a ${persona.genderPresentation} presentation. Let this subtly inform your word choice and tone, without ever stating your age or gender unless the user directly asks. Do not lean into stereotype. Regardless of these properties, you are equally warm, professional, and encouraging — the persona is a framing detail, not a personality change.`;
}
