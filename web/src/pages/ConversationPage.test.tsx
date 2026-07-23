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
        if (url.toString().endsWith("/anchors")) {
          return new Response(JSON.stringify([]));
        }
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
      if (url.toString().endsWith("/anchors")) {
        return new Response(JSON.stringify([]));
      }
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

  // Regression test for 2026-07-23, corrected same day: an earlier fix
  // guessed that Chrome finalizing the exact same segment twice was itself
  // a bug and collapsed it — but Robin then reproduced a real case on a
  // laptop where genuinely repeating a word on purpose ("test test test")
  // got collapsed down to one "test", which is wrong. Exact-duplicate,
  // equal-length segments are always concatenated now — only a segment
  // that's strictly *longer* and a prefix-extension of the previous one
  // (mergeSpeechSegments' actual fix, below) gets merged.
  it("preserves an exact word/segment repeated on purpose instead of collapsing it", async () => {
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
      results: [[{ transcript: "test " }], [{ transcript: "test " }], [{ transcript: "test" }]],
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Type your reply...")).toHaveValue("test test test"),
    );
  });

  // Regression test for the real, confirmed root cause on Android Chrome
  // (Pixel 10, 2026-07-23): Robin's own exact repro was each SpeechRecognition
  // entry cumulatively restating the whole utterance so far — "I'm", then
  // "I'm going", then "I'm going to", etc. — which the two fixes above never
  // addressed, since neither assumed entries could be prefix-extensions of
  // each other rather than distinct or exactly-repeated segments.
  it("collapses a chain of cumulative-restatement entries instead of concatenating all of them", async () => {
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
        [{ transcript: "I'm" }],
        [{ transcript: "I'm going" }],
        [{ transcript: "I'm going to" }],
        [{ transcript: "I'm going to say" }],
        [{ transcript: "I'm going to say the..." }],
      ],
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Type your reply...")).toHaveValue("I'm going to say the..."),
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
        if (url.toString().endsWith("/anchors")) {
          return new Response(JSON.stringify([]));
        }
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

const EXISTING_ANCHOR = {
  id: "anchor-1",
  label: "Backend Engineer, FinTech",
  targetRole: "Backend infra",
  targetIndustry: "FinTech",
};

interface FetchCall {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

function stubAnchorPickerFetch(existingAnchors: Array<typeof EXISTING_ANCHOR>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url: url.toString(),
        method,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });

      if (url.toString().endsWith("/sessions/current")) {
        return new Response(JSON.stringify({ session: null }));
      }
      if (url.toString().endsWith("/anchors") && method === "GET") {
        return new Response(JSON.stringify(existingAnchors));
      }
      if (url.toString().endsWith("/anchors") && method === "POST") {
        return new Response(
          JSON.stringify({ id: "anchor-new", label: "Fresh anchor", targetRole: null, targetIndustry: null }),
        );
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
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
  return calls;
}

// Regression coverage for the gap Robin found explaining anchors: the
// session-start toggle used to only ever create a brand-new anchor via
// POST /anchors, with no way to reuse one that already exists — every
// checked session created another anchor instead of linking to one.
describe("ConversationPage existing-anchor picker", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a picker (not the checkbox) when the user has existing anchors, and picking one skips POST /anchors", async () => {
    const calls = stubAnchorPickerFetch([EXISTING_ANCHOR]);

    render(
      <MemoryRouter>
        <ConversationPage />
      </MemoryRouter>,
    );

    const picker = await waitFor(() =>
      screen.getByRole("combobox", { name: /practicing for something specific/i }),
    );
    expect(screen.queryByRole("checkbox", { name: /practicing for something specific/i })).not.toBeInTheDocument();

    fireEvent.change(picker, { target: { value: EXISTING_ANCHOR.id } });
    fireEvent.submit(screen.getByRole("button", { name: /start practicing/i }).closest("form")!);

    await waitFor(() => screen.getByPlaceholderText("Type your reply..."));

    expect(calls.some((c) => c.url.endsWith("/anchors") && c.method === "POST")).toBe(false);
    const startCall = calls.find((c) => c.url.endsWith("/sessions/start"));
    expect(startCall?.body?.anchorId).toBe(EXISTING_ANCHOR.id);
  });

  it("still calls POST /anchors when 'create a new anchor' is chosen", async () => {
    const calls = stubAnchorPickerFetch([EXISTING_ANCHOR]);

    render(
      <MemoryRouter>
        <ConversationPage />
      </MemoryRouter>,
    );

    const picker = await waitFor(() =>
      screen.getByRole("combobox", { name: /practicing for something specific/i }),
    );
    fireEvent.change(picker, { target: { value: "new" } });

    const labelInput = await waitFor(() => screen.getByLabelText("Label"));
    fireEvent.change(labelInput, { target: { value: "Fresh anchor" } });
    fireEvent.submit(screen.getByRole("button", { name: /start practicing/i }).closest("form")!);

    await waitFor(() => screen.getByPlaceholderText("Type your reply..."));

    const postAnchor = calls.find((c) => c.url.endsWith("/anchors") && c.method === "POST");
    expect(postAnchor?.body?.label).toBe("Fresh anchor");
    const startCall = calls.find((c) => c.url.endsWith("/sessions/start"));
    expect(startCall?.body?.anchorId).toBe("anchor-new");
  });

  it("shows the original checkbox, not a picker, for a user with zero anchors", async () => {
    stubAnchorPickerFetch([]);

    render(
      <MemoryRouter>
        <ConversationPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: /start practicing/i }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /practicing for something specific/i })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("combobox", { name: /practicing for something specific/i }),
    ).not.toBeInTheDocument();
  });
});
