import type { CoachingNote } from "../db/schema.js";

/**
 * Deterministic input to `buildFeedbackReport` — deliberately excludes
 * `topicRelevanceScore` from the type itself, not just from what the
 * function happens to read. See m5-coaching-feedback/design.md's Decisions:
 * a leak into a coaching note would require changing this type first, not
 * just a rendering mistake.
 *
 * `sentiment` and `techDomainMentions` are also omitted — v1's note catalog
 * doesn't cover them yet (design.md's Decisions), so there's nothing for a
 * caller to accidentally wire in ahead of that decision.
 */
export interface SessionMiningResultInput {
  ownershipLanguagePresent: boolean;
  tradeoffReasoningPresent: boolean;
  clarity: "clear" | "mixed" | "unclear";
  outcomeMentioned: boolean;
  quantifiedImpactExamples: string[];
  audienceKeywordMatches?: string[] | null;
}

/**
 * Placeholder copy pending real tone review — same convention as
 * `CRISIS_RESOURCES`/`ROLE_LANGUAGE_REFERENCE` in the mining module. Not
 * finalized; revisit once there's real session output to react to.
 */
const CLARITY_NOTES: Record<SessionMiningResultInput["clarity"], string> = {
  clear: "You described what happened clearly — easy to follow from start to finish.",
  mixed: "Some parts of what you described came through clearly, others were harder to follow — worth noticing which parts felt easiest to explain.",
  unclear: "This one was harder to follow — might be worth thinking about how you'd explain it to someone with no context.",
};

const GENERIC_CLOSING_NOTE: CoachingNote = {
  kind: "closing",
  note: "Thanks for practicing — the more you do this, the more there is to notice.",
};

function buildOwnershipNote(present: boolean): CoachingNote {
  return present
    ? {
        kind: "ownership",
        note: "You described your own role in what happened clearly — what you decided or did, not just what the team did.",
      }
    : {
        kind: "ownership",
        note: "Try adding a bit more about your own specific role next time — what you decided or did, not just what happened around you.",
      };
}

function buildTradeoffNote(present: boolean): CoachingNote | null {
  if (!present) return null;
  return {
    kind: "tradeoff",
    note: "You walked through weighing competing options clearly — try adding *why* you chose that approach next time, if you didn't already.",
  };
}

function buildOutcomeNote(mentioned: boolean): CoachingNote | null {
  if (!mentioned) return null;
  return {
    kind: "outcome",
    note: "You mentioned a concrete result — that grounds the story in something real.",
  };
}

function buildQuantifiedImpactNote(examples: string[]): CoachingNote | null {
  const [quote] = examples;
  if (!quote) return null;
  return {
    kind: "quantified_impact",
    note: "You tied a decision to a specific, measurable result — that's the kind of detail that sticks.",
    quote,
  };
}

function buildAudienceKeywordNote(matches: string[] | null | undefined): CoachingNote | null {
  const [quote] = matches ?? [];
  if (!quote) return null;
  return {
    kind: "audience_keyword",
    note: "You used language that lines up with how this role is often described — a good sign it's landing the way you intend.",
    quote,
  };
}

/**
 * Pure, deterministic transform — no LLM call. See design.md's Decisions on
 * why this is a template lookup rather than a generated-prose pass.
 *
 * The generic closing note is always included — a fixed floor a report
 * never falls below — with category notes added on top of it wherever the
 * mining result has something to surface (design.md's Risks/Trade-offs).
 */
export function buildFeedbackReport(result: SessionMiningResultInput): CoachingNote[] {
  const notes = [
    buildOwnershipNote(result.ownershipLanguagePresent),
    buildTradeoffNote(result.tradeoffReasoningPresent),
    buildOutcomeNote(result.outcomeMentioned),
    { kind: "clarity", note: CLARITY_NOTES[result.clarity] },
    buildQuantifiedImpactNote(result.quantifiedImpactExamples),
    buildAudienceKeywordNote(result.audienceKeywordMatches),
    GENERIC_CLOSING_NOTE,
  ].filter((note): note is CoachingNote => note !== null);

  return notes;
}
