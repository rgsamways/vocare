import { describe, expect, it } from "vitest";
import { matchRoleLanguage, ROLE_LANGUAGE_REFERENCE } from "./role-language.js";

describe("matchRoleLanguage", () => {
  it("returns the backend engineer category's terms on an exact match", () => {
    expect(matchRoleLanguage("backend engineer")).toBe(
      ROLE_LANGUAGE_REFERENCE.find((c) => c.category === "backend engineer")!.terms,
    );
  });

  it("returns the product manager category's terms on a substring match", () => {
    expect(matchRoleLanguage("Senior Product Manager")).toBe(
      ROLE_LANGUAGE_REFERENCE.find((c) => c.category === "product manager")!.terms,
    );
  });

  it("matches case-insensitively", () => {
    expect(matchRoleLanguage("DESIGNER")).toBe(
      ROLE_LANGUAGE_REFERENCE.find((c) => c.category === "designer")!.terms,
    );
  });

  it("returns undefined for an unrecognized target_role, not the generic fallback", () => {
    expect(matchRoleLanguage("underwater basket weaver")).toBeUndefined();
  });

  it("returns undefined for null, undefined, or empty target_role", () => {
    expect(matchRoleLanguage(null)).toBeUndefined();
    expect(matchRoleLanguage(undefined)).toBeUndefined();
    expect(matchRoleLanguage("   ")).toBeUndefined();
  });

  it("still matches the general professional category on its own confident matchKeys", () => {
    expect(matchRoleLanguage("Marketing Lead")).toBe(
      ROLE_LANGUAGE_REFERENCE.find((c) => c.category === "general professional")!.terms,
    );
  });
});
