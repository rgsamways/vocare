import { describe, expect, it } from "vitest";
import { collapseRepeatedWords } from "./collapse-repeated-words";

describe("collapseRepeatedWords", () => {
  it("collapses a run of the same word repeated back-to-back", () => {
    expect(collapseRepeatedWords("the the the project")).toBe("the project");
  });

  it("is case-insensitive when comparing repeats", () => {
    expect(collapseRepeatedWords("The the THE project")).toBe("The project");
  });

  it("ignores trailing punctuation when comparing repeats", () => {
    expect(collapseRepeatedWords("wait, wait, wait what")).toBe("wait, what");
  });

  it("does not touch non-repeated words, including reasonable natural phrasing", () => {
    expect(collapseRepeatedWords("that was a very good decision")).toBe("that was a very good decision");
  });

  it("preserves original spacing between distinct words", () => {
    expect(collapseRepeatedWords("hello there  friend")).toBe("hello there  friend");
  });
});
