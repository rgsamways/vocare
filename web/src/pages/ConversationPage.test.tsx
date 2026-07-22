import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ConversationPage } from "./ConversationPage";

const CRISIS_RESOURCE = {
  name: "Talk Suicide Canada",
  contact: "Call or text 9-8-8",
  description: "Free, 24/7 support for anyone in Canada in crisis or thinking about suicide.",
  href: "tel:988",
};

// Regression test for a real bug caught in grading: the safety card's link
// was built by inferring tel:/https: from the resource's *display text*
// instead of using an explicit href, and always resolved to the generic
// fallback URL regardless of which resource was actually shown. This drives
// the component through a real crisis-flagged turn and asserts the rendered
// <a> tag's href matches the resource displayed, not just that a resource
// was selected.
describe("ConversationPage safety card", () => {
  it("renders a resource link whose href matches the resource actually shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().endsWith("/sessions/start")) {
          return new Response(
            JSON.stringify({
              sessionId: "session-1",
              status: "start",
              chips: [],
              timeExpectation: "Take your time.",
              persona: { ageRange: "20s-30s", genderPresentation: "neutral" },
            }),
          );
        }
        if (url.toString().endsWith("/turns")) {
          return new Response(
            JSON.stringify({
              reply: "Support is already surfaced below this chat.",
              crisisFlagged: true,
              crisisResource: CRISIS_RESOURCE,
            }),
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <MemoryRouter>
        <ConversationPage />
      </MemoryRouter>,
    );

    fireEvent.submit(screen.getByRole("button", { name: /start practicing/i }).closest("form")!);
    await waitFor(() => screen.getByPlaceholderText("Type your reply..."));

    fireEvent.change(screen.getByPlaceholderText("Type your reply..."), {
      target: { value: "explicit crisis language" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Type your reply...").closest("form")!);

    await waitFor(() => screen.getByText(CRISIS_RESOURCE.name));

    const link = screen.getByRole("link", { name: new RegExp(CRISIS_RESOURCE.name) });
    expect(link).toHaveAttribute("href", CRISIS_RESOURCE.href);
  });
});
