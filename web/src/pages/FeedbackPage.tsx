import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL as string;

interface CoachingNote {
  kind: string;
  note: string;
  quote?: string;
}

interface FeedbackReport {
  sessionId: string;
  coachingNotes: CoachingNote[];
  generatedAt: string;
}

type ReportState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "pending" }
  | { status: "ready"; report: FeedbackReport };

export function FeedbackPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [state, setState] = useState<ReportState>({ status: "loading" });

  const loadReport = useCallback(async () => {
    setState({ status: "loading" });
    const url = sessionId ? `${API_URL}/sessions/${sessionId}/feedback` : `${API_URL}/feedback/latest`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      setState({ status: "none" });
      return;
    }
    const body = await res.json();
    setState(body);
  }, [sessionId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  return (
    <main>
      <h1 className="title">Feedback</h1>
      <p className="subtitle">
        Plain-language notes on what came through — not a score, just what to notice.
      </p>

      <div aria-live="polite">
        {state.status === "loading" && <p className="subtitle">Loading your feedback...</p>}

        {state.status === "none" && (
          <p className="subtitle">
            Nothing here yet — complete a practice session to see your first feedback report.
          </p>
        )}

        {state.status === "pending" && (
          <>
            <p className="subtitle">
              Your feedback is still being prepared — this usually takes just a few seconds.
            </p>
            <button className="btn secondary" onClick={loadReport}>
              Check again
            </button>
          </>
        )}

        {state.status === "ready" && (
          <ul className="feedback-notes" aria-label="Coaching notes for this session">
            {state.report.coachingNotes.map((note, index) => (
              <li className="feedback-note" key={index}>
                <p>{note.note}</p>
                {note.quote && (
                  <blockquote className="feedback-quote">
                    <p>&ldquo;{note.quote}&rdquo;</p>
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
