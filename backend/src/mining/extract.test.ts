import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked, not a real API call — same posture as crisis-safety.test.ts (no
// ANTHROPIC_API_KEY in CI).
const createMock = vi.fn();
vi.mock("../conversation/anthropic-client.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

const { extractSessionSignals } = await import("./extract.js");

const TRANSCRIPT = [
  { speaker: "assistant" as const, content: "Tell me about a recent decision." },
  { speaker: "user" as const, content: "I decided to migrate our API to a new schema." },
];

const FULL_EXTRACTION = {
  ownership_language_present: true,
  tradeoff_reasoning_present: true,
  tech_domain_mentions: ["API", "schema"],
  clarity: "clear",
  sentiment: "positive",
  growth_signals: ["learned to delegate"],
  outcome_mentioned: true,
  quantified_impact_examples: ["cut deploy time by 40%"],
  topic_relevance_score: 90,
};

function mockResponse(body: Record<string, unknown>) {
  createMock.mockResolvedValueOnce({ content: [{ type: "text", text: JSON.stringify(body) }] });
}

describe("extractSessionSignals", () => {
  beforeEach(() => createMock.mockReset());

  it("returns all expected fields for a representative transcript with no target role", async () => {
    mockResponse(FULL_EXTRACTION);

    const result = await extractSessionSignals({ transcript: TRANSCRIPT });

    expect(result).toEqual({
      ownershipLanguagePresent: true,
      tradeoffReasoningPresent: true,
      techDomainMentions: ["API", "schema"],
      clarity: "clear",
      sentiment: "positive",
      growthSignals: ["learned to delegate"],
      outcomeMentioned: true,
      quantifiedImpactExamples: ["cut deploy time by 40%"],
      audienceKeywordMatches: undefined,
      topicRelevanceScore: 90,
    });
  });

  it("omits audience_keyword_matches from the request schema when no target role is set", async () => {
    mockResponse(FULL_EXTRACTION);
    await extractSessionSignals({ transcript: TRANSCRIPT });

    const call = createMock.mock.calls[0][0];
    const schema = call.output_config.format.schema;
    expect(schema.properties.audience_keyword_matches).toBeUndefined();
    expect(schema.required).not.toContain("audience_keyword_matches");
  });

  it("omits audience_keyword_matches when target_role doesn't confidently match a category", async () => {
    mockResponse(FULL_EXTRACTION);
    await extractSessionSignals({ transcript: TRANSCRIPT, targetRole: "underwater basket weaver" });

    const call = createMock.mock.calls[0][0];
    const schema = call.output_config.format.schema;
    expect(schema.properties.audience_keyword_matches).toBeUndefined();
  });

  it("includes audience_keyword_matches in the schema and response when target_role confidently matches", async () => {
    mockResponse({ ...FULL_EXTRACTION, audience_keyword_matches: ["scalability"] });
    const result = await extractSessionSignals({
      transcript: TRANSCRIPT,
      targetRole: "backend engineer",
    });

    const call = createMock.mock.calls[0][0];
    const schema = call.output_config.format.schema;
    expect(schema.properties.audience_keyword_matches).toBeDefined();
    expect(schema.required).toContain("audience_keyword_matches");
    expect(result?.audienceKeywordMatches).toEqual(["scalability"]);
  });

  it("interpolates job_description_text into the prompt only when a role match exists", async () => {
    mockResponse({ ...FULL_EXTRACTION, audience_keyword_matches: [] });
    await extractSessionSignals({
      transcript: TRANSCRIPT,
      targetRole: "backend engineer",
      jobDescriptionText: "SECRET_JD_MARKER responsibilities include...",
    });

    const call = createMock.mock.calls[0][0];
    expect(call.system).toContain("SECRET_JD_MARKER");
  });

  it("never reads job_description_text into the prompt when there's no anchor/target_role match", async () => {
    mockResponse(FULL_EXTRACTION);
    await extractSessionSignals({
      transcript: TRANSCRIPT,
      jobDescriptionText: "SECRET_JD_MARKER responsibilities include...",
    });

    const call = createMock.mock.calls[0][0];
    expect(call.system).not.toContain("SECRET_JD_MARKER");
  });

  it("returns null without throwing when the response has no text block", async () => {
    createMock.mockResolvedValueOnce({ content: [] });
    await expect(extractSessionSignals({ transcript: TRANSCRIPT })).resolves.toBeNull();
  });

  it("returns null without throwing when the response text isn't valid JSON", async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }] });
    await expect(extractSessionSignals({ transcript: TRANSCRIPT })).resolves.toBeNull();
  });
});
