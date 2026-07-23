import { describe, expect, it } from "vitest";
import { mergeSpeechSegments } from "./merge-speech-segments";

describe("mergeSpeechSegments", () => {
  it("collapses a chain of cumulative-restatement entries down to the final one", () => {
    expect(
      mergeSpeechSegments([
        "I'm",
        "I'm going",
        "I'm going to",
        "I'm going to say",
        "I'm going to say the...",
      ]),
    ).toBe("I'm going to say the...");
  });

  it("concatenates genuinely distinct segments that don't extend each other", () => {
    expect(mergeSpeechSegments(["Hello there. ", "How are you"])).toBe("Hello there. How are you");
  });

  it("handles a single segment", () => {
    expect(mergeSpeechSegments(["just one thing"])).toBe("just one thing");
  });

  it("handles an empty list", () => {
    expect(mergeSpeechSegments([])).toBe("");
  });

  it("collapses a growing chain, then concatenates a genuinely new segment after it", () => {
    expect(mergeSpeechSegments(["I", "I said", "I said that", "and then this"])).toBe(
      "I said thatand then this",
    );
  });

  // Corrected 2026-07-23: an earlier version merged on startsWith alone,
  // which treated an identical (equal-length) segment as an "extension" of
  // itself and dropped it — wrongly collapsing a genuinely repeated word
  // ("test test test", reported on a laptop) down to one instance.
  it("does not merge equal-length identical segments — each is a separate, genuinely repeated utterance", () => {
    expect(mergeSpeechSegments(["test ", "test ", "test"])).toBe("test test test");
  });
});
