import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConversationPage } from "./ConversationPage";

// This project's vitest config doesn't set test.globals, so
// @testing-library/react's auto-registered afterEach(cleanup) never fires —
// explicit here so multiple tests in this file don't accumulate DOM.
afterEach(cleanup);

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
        if (url.toString().endsWith("/sessions/current")) {
          return new Response(JSON.stringify({ session: null }));
        }
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

    await waitFor(() => screen.getByRole("button", { name: /start practicing/i }));
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

function stubStartAndTurnFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.toString().endsWith("/sessions/current")) {
        return new Response(JSON.stringify({ session: null }));
      }
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
        return new Response(JSON.stringify({ reply: "mocked reply", crisisFlagged: false }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
}

async function startSession() {
  render(
    <MemoryRouter>
      <ConversationPage />
    </MemoryRouter>,
  );
  await waitFor(() => screen.getByRole("button", { name: /start practicing/i }));
  fireEvent.submit(screen.getByRole("button", { name: /start practicing/i }).closest("form")!);
  await waitFor(() => screen.getByPlaceholderText("Type your reply..."));
}

async function submitTypedTurn() {
  fireEvent.change(screen.getByPlaceholderText("Type your reply..."), {
    target: { value: "a typed reply" },
  });
  fireEvent.submit(screen.getByPlaceholderText("Type your reply...").closest("form")!);
  await waitFor(() => screen.getByText("mocked reply"));
}

describe("ConversationPage mic control", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it("renders the mic control when SpeechRecognition is available, and typed submission still works", async () => {
    class FakeSpeechRecognition {
      continuous = false;
      interimResults = false;
      onresult: unknown = null;
      onerror: unknown = null;
      onend: unknown = null;
      start() {}
      stop() {}
    }
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
    stubStartAndTurnFetch();

    await startSession();

    expect(screen.getByRole("button", { name: /speak your reply/i })).toBeInTheDocument();

    await submitTypedTurn();
  });

  it("does not render the mic control when SpeechRecognition is unavailable, and typed submission still works", async () => {
    stubStartAndTurnFetch();

    await startSession();

    expect(screen.queryByRole("button", { name: /speak your reply/i })).not.toBeInTheDocument();

    await submitTypedTurn();
  });

  // Regression test for a real bug reported 2026-07-23: Chrome's endpointer,
  // under fast speech, sometimes finalizes the exact same segment more than
  // once as separate adjacent entries in event.results — before the fix
  // below, ConversationPage concatenated every entry unconditionally,
  // duplicating that segment's words in the composer every time it happened.
  it("collapses an immediately-repeated segment from SpeechRecognition results instead of duplicating it", async () => {
    type ResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
    const instance = {
      continuous: false,
      interimResults: false,
      onresult: null as ((event: ResultEvent) => void) | null,
      onerror: null,
      onend: null,
      start() {},
      stop() {},
    };
    function FakeSpeechRecognition() {
      return instance;
    }
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
    stubStartAndTurnFetch();

    await startSession();
    fireEvent.click(screen.getByRole("button", { name: /speak your reply/i }));

    instance.onresult!({
      results: [
        [{ transcript: "the project " }],
        [{ transcript: "the project " }],
        [{ transcript: "was a success" }],
      ],
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Type your reply...")).toHaveValue("the project was a success"),
    );
  });
});

// Regression test for the tab-bar data-loss gap: M2.1 made every tab
// reachable in one tap, and navigating away from Conversation and back used
// to always show a fresh setup screen, silently orphaning whatever session
// was already open. This asserts the mount-time resume check actually skips
// setup and restores the prior transcript, not just that the endpoint exists.
describe("ConversationPage resume", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("skips the setup screen and restores the transcript when an open session already exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.toString().endsWith("/sessions/current")) {
          return new Response(
            JSON.stringify({
              session: {
                sessionId: "session-resumed",
                status: "in-progress",
                anchorBadge: null,
                chips: [],
                timeExpectation: "Take your time.",
                turns: [
                  { speaker: "user", content: "Something I said before navigating away." },
                  { speaker: "assistant", content: "A reply from before." },
                ],
                crisisFlagged: false,
              },
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

    await waitFor(() => screen.getByText("A reply from before."));
    expect(screen.getByText("Something I said before navigating away.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start practicing/i })).not.toBeInTheDocument();
  });
});
