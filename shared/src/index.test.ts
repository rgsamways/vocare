import { describe, expect, it } from "vitest";
import { APP_NAME } from "./index.js";

describe("APP_NAME", () => {
  it("is Vocare", () => {
    expect(APP_NAME).toBe("Vocare");
  });
});
