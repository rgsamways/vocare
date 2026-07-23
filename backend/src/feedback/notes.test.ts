import { describe, expect, it } from "vitest";
import { buildFeedbackReport, type SessionMiningResultInput } from "./notes.js";

const BASE: SessionMiningResultInput = {
  ownershipLanguagePresent: false,
  tradeoffReasoningPresent: false,
  clarity: "clear",
  outcomeMentioned: false,
  quantifiedImpactExamples: [],
  audienceKeywordMatches: null,
};

function findNote(notes: ReturnType<typeof buildFeedbackReport>, kind: string) {
  return notes.find((n) => n.kind === kind);
}

describe("buildFeedbackReport", () => {
  it("always includes the generic closing note", () => {
    const notes = buildFeedbackReport(BASE);
    expect(findNote(notes, "closing")).toBeDefined();
  });

  it("includes an ownership note whether or not ownership language was present", () => {
    expect(findNote(buildFeedbackReport({ ...BASE, ownershipLanguagePresent: true }), "ownership")).toBeDefined();
    expect(findNote(buildFeedbackReport({ ...BASE, ownershipLanguagePresent: false }), "ownership")).toBeDefined();
  });

  it("includes a tradeoff note only when tradeoff reasoning was present", () => {
    expect(findNote(buildFeedbackReport({ ...BASE, tradeoffReasoningPresent: true }), "tradeoff")).toBeDefined();
    expect(findNote(buildFeedbackReport({ ...BASE, tradeoffReasoningPresent: false }), "tradeoff")).toBeUndefined();
  });

  it("includes an outcome note only when an outcome was mentioned", () => {
    expect(findNote(buildFeedbackReport({ ...BASE, outcomeMentioned: true }), "outcome")).toBeDefined();
    expect(findNote(buildFeedbackReport({ ...BASE, outcomeMentioned: false }), "outcome")).toBeUndefined();
  });

  it("includes a clarity note for every clarity value", () => {
    for (const clarity of ["clear", "mixed", "unclear"] as const) {
      expect(findNote(buildFeedbackReport({ ...BASE, clarity }), "clarity")).toBeDefined();
    }
  });

  it("quotes the first quantified-impact example verbatim", () => {
    const notes = buildFeedbackReport({
      ...BASE,
      quantifiedImpactExamples: ["cut deploy time by 40%"],
    });
    expect(findNote(notes, "quantified_impact")?.quote).toBe("cut deploy time by 40%");
  });

  it("omits the quantified-impact note when the array is empty", () => {
    const notes = buildFeedbackReport({ ...BASE, quantifiedImpactExamples: [] });
    expect(findNote(notes, "quantified_impact")).toBeUndefined();
  });

  it("quotes the first audience-keyword match verbatim", () => {
    const notes = buildFeedbackReport({
      ...BASE,
      audienceKeywordMatches: ["distributed systems", "scalability"],
    });
    expect(findNote(notes, "audience_keyword")?.quote).toBe("distributed systems");
  });

  it("produces no audience-keyword note, and no note stating an absence, when matches is null", () => {
    const notes = buildFeedbackReport({ ...BASE, audienceKeywordMatches: null });
    expect(findNote(notes, "audience_keyword")).toBeUndefined();
    expect(notes.every((n) => !/not find|no match|didn't use/i.test(n.note))).toBe(true);
  });

  it("produces no audience-keyword note when matches is an empty array", () => {
    const notes = buildFeedbackReport({ ...BASE, audienceKeywordMatches: [] });
    expect(findNote(notes, "audience_keyword")).toBeUndefined();
  });

  it("still returns at least one note (the generic closer) when nothing else applies", () => {
    const notes = buildFeedbackReport(BASE);
    expect(notes.length).toBeGreaterThan(0);
    expect(findNote(notes, "closing")).toBeDefined();
  });

  it("cannot be passed topicRelevanceScore — SessionMiningResultInput excludes it", () => {
    // @ts-expect-error topicRelevanceScore is not part of SessionMiningResultInput
    const withScore: SessionMiningResultInput = { ...BASE, topicRelevanceScore: 42 };
    expect(buildFeedbackReport(withScore)).toBeDefined();
  });
});
