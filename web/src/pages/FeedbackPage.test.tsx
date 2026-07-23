import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FeedbackPage } from "./FeedbackPage";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/feedback/:sessionId" element={<FeedbackPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FeedbackPage", () => {
  it("fetches /feedback/latest when reached with no session id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "none" })));
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/feedback");

    await waitFor(() => expect(screen.getByText(/complete a practice session/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/feedback/latest"), expect.anything());
  });

  it("fetches /sessions/:id/feedback when reached with a session id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "pending" })));
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/feedback/session-123");

    await waitFor(() => expect(screen.getByText(/still being prepared/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/session-123/feedback"),
      expect.anything(),
    );
  });

  it("renders coaching notes and quotes, with no numeric score anywhere", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "ready",
            report: {
              sessionId: "session-123",
              generatedAt: new Date().toISOString(),
              coachingNotes: [
                { kind: "ownership", note: "You described your own role clearly." },
                {
                  kind: "quantified_impact",
                  note: "You tied a decision to a measurable result.",
                  quote: "cut deploy time by 40%",
                },
              ],
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/feedback/session-123");

    await waitFor(() => expect(screen.getByText("You described your own role clearly.")).toBeInTheDocument());
    expect(screen.getByText(/cut deploy time by 40%/)).toBeInTheDocument();
    // The quoted phrase itself may contain a number (it's the user's own
    // words), and the page's own intro copy says "not a score" by design —
    // the real guarantee is that topicRelevanceScore itself never appears.
    expect(screen.queryByText(/topic relevance/i)).not.toBeInTheDocument();
  });

  it("shows a Check again control while a report is pending", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "pending" })));
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/feedback/session-123");

    await waitFor(() => expect(screen.getByRole("button", { name: /check again/i })).toBeInTheDocument());
  });
});
