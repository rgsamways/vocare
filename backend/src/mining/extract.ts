import { anthropic } from "../conversation/anthropic-client.js";
import { MINING_MODEL } from "../config.js";
import type { TranscriptTurnInput } from "../conversation/reply.js";
import { matchRoleLanguage } from "./role-language.js";

export interface ExtractionResult {
  ownershipLanguagePresent: boolean;
  tradeoffReasoningPresent: boolean;
  techDomainMentions: string[];
  clarity: "clear" | "mixed" | "unclear";
  sentiment: "positive" | "neutral" | "negative";
  growthSignals: string[];
  outcomeMentioned: boolean;
  quantifiedImpactExamples: string[];
  /** Present only when the session's anchor had a target_role that
   * confidently matched a role-language category — see role-language.ts. */
  audienceKeywordMatches?: string[];
  topicRelevanceScore: number;
}

export interface ExtractSessionSignalsParams {
  transcript: TranscriptTurnInput[];
  /** From the session's linked anchor, if any. */
  targetRole?: string | null;
  /**
   * Read only here, only when `targetRole` confidently matches a
   * role-language category — the live conversation (M2) never reads this
   * field. See proposal.md/spec's "only mining use of job_description_text".
   */
  jobDescriptionText?: string | null;
}

const BASE_EXTRACTION_INSTRUCTIONS = `You are analyzing a completed practice-conversation transcript to extract structured signal for internal product use. The person being analyzed was never scored or evaluated during the conversation itself — this analysis happens only after the fact and is never shown to them.

Extract the following from the full transcript below:
- ownership_language_present: true if the person describes their own actions/decisions ("I decided", "I proposed") rather than only describing what a team or others did.
- tradeoff_reasoning_present: true if the person articulates weighing competing options or constraints when explaining a decision.
- tech_domain_mentions: an array of specific technologies, tools, or domain areas the person mentioned by name (e.g. "Postgres", "supply chain", "Figma"). Empty array if none.
- clarity: one of "clear", "mixed", or "unclear" — how clearly the person communicated their points overall.
- sentiment: one of "positive", "neutral", or "negative" — the person's overall tone about the topics discussed.
- growth_signals: an array of short phrases indicating the person reflecting on learning, growth, or change over time. Empty array if none.
- outcome_mentioned: true if the person mentions a concrete result or outcome of a decision or action.
- quantified_impact_examples: an array of VERBATIM quoted phrases from the transcript where the person ties a decision or action to a specific number or metric (e.g. "cut deploy time by 40%"). Quote the person's exact words — never paraphrase or invent a number that isn't in the transcript. Empty array if none.
- topic_relevance_score: an integer from 0-100 reflecting how closely the conversation's actual subject matter matches ordinary career/professional-practice topics (decisions, work, growth, tradeoffs). 100 means squarely on-topic; low scores mean the conversation drifted to unrelated subject matter.`;

function buildAudienceMatchingInstructions(roleTerms: string[], jobDescriptionText?: string | null): string {
  const referenceLines = [
    `Reference language associated with this role: ${roleTerms.join(", ")}.`,
  ];
  if (jobDescriptionText) {
    referenceLines.push(`Additional context from the person's target job description: ${jobDescriptionText}`);
  }
  return `\n\nAlso extract audience_keyword_matches: an array of VERBATIM quoted phrases from the transcript that echo the reference language below for the person's target role. Quote the person's exact words — never paraphrase. Empty array if no matching language appears.\n${referenceLines.join("\n")}`;
}

function buildExtractionSystemPrompt(roleTerms: string[] | undefined, jobDescriptionText?: string | null): string {
  if (!roleTerms) return `${BASE_EXTRACTION_INSTRUCTIONS}\n\nRespond with structured output only.`;
  return `${BASE_EXTRACTION_INSTRUCTIONS}${buildAudienceMatchingInstructions(roleTerms, jobDescriptionText)}\n\nRespond with structured output only.`;
}

const BASE_SCHEMA_PROPERTIES = {
  ownership_language_present: { type: "boolean" },
  tradeoff_reasoning_present: { type: "boolean" },
  tech_domain_mentions: { type: "array", items: { type: "string" } },
  clarity: { type: "string", enum: ["clear", "mixed", "unclear"] },
  sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  growth_signals: { type: "array", items: { type: "string" } },
  outcome_mentioned: { type: "boolean" },
  quantified_impact_examples: { type: "array", items: { type: "string" } },
  // No minimum/maximum here — Anthropic's structured-output json_schema
  // rejects those on an integer property (caught during manual verification,
  // tasks.md 7.2). The 0-100 range is enforced by the prompt instructions
  // only, not schema validation.
  topic_relevance_score: { type: "integer" },
} as const;

const BASE_REQUIRED = [
  "ownership_language_present",
  "tradeoff_reasoning_present",
  "tech_domain_mentions",
  "clarity",
  "sentiment",
  "growth_signals",
  "outcome_mentioned",
  "quantified_impact_examples",
  "topic_relevance_score",
];

function buildExtractionSchema(includeAudienceMatches: boolean) {
  if (!includeAudienceMatches) {
    return {
      type: "object",
      properties: BASE_SCHEMA_PROPERTIES,
      required: BASE_REQUIRED,
      additionalProperties: false,
    } as const;
  }

  return {
    type: "object",
    properties: {
      ...BASE_SCHEMA_PROPERTIES,
      audience_keyword_matches: { type: "array", items: { type: "string" } },
    },
    required: [...BASE_REQUIRED, "audience_keyword_matches"],
    additionalProperties: false,
  } as const;
}

function formatTranscript(turns: TranscriptTurnInput[]): string {
  return turns.map((turn) => `${turn.speaker}: ${turn.content}`).join("\n");
}

/**
 * Single structured-output Haiku 4.5 call over the full transcript — see
 * design.md's Decisions. Returns `null` (never throws) on a malformed or
 * unparseable model response; `mineSession` treats that as a skip.
 */
export async function extractSessionSignals(
  params: ExtractSessionSignalsParams,
): Promise<ExtractionResult | null> {
  const roleTerms = matchRoleLanguage(params.targetRole);
  const schema = buildExtractionSchema(roleTerms !== undefined);
  const systemPrompt = buildExtractionSystemPrompt(roleTerms, params.jobDescriptionText);

  const response = await anthropic.messages.create({
    model: MINING_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: formatTranscript(params.transcript) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("[mining] extraction call returned no text block");
    return null;
  }

  try {
    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    return {
      ownershipLanguagePresent: parsed.ownership_language_present as boolean,
      tradeoffReasoningPresent: parsed.tradeoff_reasoning_present as boolean,
      techDomainMentions: parsed.tech_domain_mentions as string[],
      clarity: parsed.clarity as ExtractionResult["clarity"],
      sentiment: parsed.sentiment as ExtractionResult["sentiment"],
      growthSignals: parsed.growth_signals as string[],
      outcomeMentioned: parsed.outcome_mentioned as boolean,
      quantifiedImpactExamples: parsed.quantified_impact_examples as string[],
      audienceKeywordMatches:
        roleTerms !== undefined ? (parsed.audience_keyword_matches as string[]) : undefined,
      topicRelevanceScore: parsed.topic_relevance_score as number,
    };
  } catch {
    console.error("[mining] extraction call returned unparseable JSON");
    return null;
  }
}
