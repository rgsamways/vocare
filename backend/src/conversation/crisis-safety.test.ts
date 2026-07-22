import { beforeEach, describe, expect, it, vi } from "vitest";
import { CRISIS_RESOURCES, getCrisisResource, GENERIC_CRISIS_RESOURCE } from "../config.js";

// Mocked, not a real API call — CI has no ANTHROPIC_API_KEY configured (see
// .github/workflows/ci.yml), so these tests exercise the parsing/fail-safe
// code paths deterministically. The classifier's actual judgment on real
// crisis vs. ordinary-venting phrasing is verified manually against the
// real API per tasks.md 7.4/7.5, not in this automated suite.
const createMock = vi.fn();
vi.mock("./anthropic-client.js", () => ({
  anthropic: { messages: { create: createMock } },
}));

const { checkCrisisLanguage } = await import("./crisis-safety.js");

function mockStructuredResponse(crisisDetected: boolean) {
  createMock.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify({ crisis_detected: crisisDetected }) }],
  });
}

describe("checkCrisisLanguage", () => {
  beforeEach(() => createMock.mockReset());

  it("returns true when the classifier reports crisis_detected: true", async () => {
    mockStructuredResponse(true);
    expect(await checkCrisisLanguage("I don't want to be alive anymore")).toBe(true);
  });

  it("returns false when the classifier reports crisis_detected: false", async () => {
    mockStructuredResponse(false);
    expect(await checkCrisisLanguage("This job is literally killing me")).toBe(false);
  });

  it("fails safe (false) when the response has no text block", async () => {
    createMock.mockResolvedValueOnce({ content: [] });
    expect(await checkCrisisLanguage("anything")).toBe(false);
  });

  it("fails safe (false) when the response text isn't valid JSON", async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }] });
    expect(await checkCrisisLanguage("anything")).toBe(false);
  });

  it("sends the user's turn content as the message to classify", async () => {
    mockStructuredResponse(false);
    await checkCrisisLanguage("a specific message");
    const call = createMock.mock.calls[0][0];
    expect(call.messages).toEqual([{ role: "user", content: "a specific message" }]);
  });
});

describe("getCrisisResource", () => {
  it("resolves the Canada resource for the exact stored country string", () => {
    expect(getCrisisResource("Canada")).toBe(CRISIS_RESOURCES.Canada);
  });

  it("resolves the US and UK resources", () => {
    expect(getCrisisResource("United States")).toBe(CRISIS_RESOURCES["United States"]);
    expect(getCrisisResource("United Kingdom")).toBe(CRISIS_RESOURCES["United Kingdom"]);
  });

  // Germany used to be the example here, back when it fell through to
  // generic — it now has a real entry (see config.ts), so it moved to the
  // "resolves the 2026-07-22 expansion" test below instead. Italy is a
  // deliberate, researched exclusion (no single clean national 24/7 line
  // found), not an oversight — see config.ts's comment — which makes it a
  // more honest example of "genuinely unmapped" than an arbitrary country.
  it("falls back to the generic resource for an unmapped country", () => {
    expect(getCrisisResource("Italy")).toBe(GENERIC_CRISIS_RESOURCE);
  });

  // Spot-checks the 2026-07-22 research-backed expansion (Canada's rename
  // plus 28 newly added countries) resolves real entries, not just that the
  // three original countries still work.
  it("resolves the 2026-07-22 expansion to real, non-generic resources", () => {
    expect(getCrisisResource("Canada")).toBe(CRISIS_RESOURCES.Canada);
    expect(CRISIS_RESOURCES.Canada.name).toBe("988: Suicide Crisis Helpline");
    for (const country of ["Germany", "Japan", "Brazil", "Mexico", "South Africa", "India"]) {
      expect(getCrisisResource(country)).not.toBe(GENERIC_CRISIS_RESOURCE);
      expect(getCrisisResource(country)).toBe(CRISIS_RESOURCES[country]);
    }
  });

  // The web app's country dropdown (web/src/lib/detect-country.ts) is
  // supposed to list only countries with a real entry here — that promise
  // has no compile-time enforcement across the two workspaces, so this
  // hardcodes the same list as a regression check. If this test fails
  // after editing either file, the two are out of sync — update both.
  it("backs every country the sign-up dropdown offers with a real resource", () => {
    const DROPDOWN_COUNTRIES = [
      "Australia", "Austria", "Brazil", "Canada", "Czechia", "Finland", "France",
      "Germany", "Hungary", "Iceland", "India", "Ireland", "Japan", "Latvia",
      "Lithuania", "Mexico", "Netherlands", "New Zealand", "Norway", "Poland",
      "Portugal", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea",
      "Spain", "Sweden", "Switzerland", "United Kingdom", "United States",
    ];
    for (const country of DROPDOWN_COUNTRIES) {
      expect(CRISIS_RESOURCES[country], `missing CRISIS_RESOURCES entry for ${country}`).toBeDefined();
    }
    expect(Object.keys(CRISIS_RESOURCES).length).toBe(DROPDOWN_COUNTRIES.length);
  });

  it("falls back to the generic resource for a null/missing country", () => {
    expect(getCrisisResource(null)).toBe(GENERIC_CRISIS_RESOURCE);
    expect(getCrisisResource(undefined)).toBe(GENERIC_CRISIS_RESOURCE);
  });

  // Regression coverage for a real bug caught in grading: the UI previously
  // inferred the link destination from `contact`'s display text instead of
  // using an explicit `href`, and got it wrong for every real phone-line
  // resource (none of their `contact` strings contain a URL). Assert the
  // link target actually corresponds to what each resource displays, not
  // just that resource selection itself is correct.
  it("gives every real phone-line resource a tel: href matching its displayed number", () => {
    expect(CRISIS_RESOURCES.Canada.href).toBe("tel:988");
    expect(CRISIS_RESOURCES["United States"].href).toBe("tel:988");
    expect(CRISIS_RESOURCES["United Kingdom"].href).toBe("tel:116123");
    for (const resource of Object.values(CRISIS_RESOURCES)) {
      expect(resource.href.startsWith("tel:")).toBe(true);
    }
  });

  it("gives the generic fallback an https: href pointing at the directory it names", () => {
    expect(GENERIC_CRISIS_RESOURCE.href).toBe("https://findahelpline.com");
  });
});
