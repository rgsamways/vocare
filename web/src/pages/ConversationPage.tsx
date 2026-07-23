import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL as string;

// Minimal local typing for the Web Speech API — not part of TS's default
// DOM lib, and this is the only surface of it this codebase touches.
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// Feature-detected, never user-agent-sniffed — see
// m3-voice-capture/design.md's Decisions on why (Firefox has none, Safari's
// support varies enough by context that per-browser special-casing isn't
// worth it).
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Must match the exact string in backend/src/conversation/redirect.ts's
// REDIRECT_TURN_CONTENT — rendering the same literal keeps the transcript
// visually honest about what was actually persisted.
const REDIRECT_TURN_CONTENT = "Let's talk about something else.";

// Mirrors backend/src/config.ts's PERSONA_COMBINATIONS — a placeholder
// starter set pending tone review (see m2-conversation-engine/design.md's
// Open Questions). Kept as a small local duplicate rather than a shared
// package export since it's UI copy for a picker, not shared app logic.
const PERSONA_OPTIONS = [
  { ageRange: "20s-30s", genderPresentation: "feminine", label: "20s–30s, feminine presentation" },
  { ageRange: "20s-30s", genderPresentation: "masculine", label: "20s–30s, masculine presentation" },
  { ageRange: "20s-30s", genderPresentation: "neutral", label: "20s–30s, neutral presentation" },
  { ageRange: "40s-50s", genderPresentation: "feminine", label: "40s–50s, feminine presentation" },
  { ageRange: "40s-50s", genderPresentation: "masculine", label: "40s–50s, masculine presentation" },
  { ageRange: "60s+", genderPresentation: "neutral", label: "60s+, neutral presentation" },
];

interface TopicSeedChip {
  id: string;
  label: string;
  prompt: string;
}

interface CrisisResource {
  name: string;
  contact: string;
  description: string;
  href: string;
}

interface Turn {
  speaker: "user" | "assistant";
  content: string;
}

type Phase = "setup" | "chat";

export function ConversationPage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("setup");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // True until the mount-time resume check below resolves — avoids flashing
  // the setup screen before we know whether an open session already exists.
  const [resuming, setResuming] = useState(true);

  // Checked once — feature support doesn't change mid-session.
  const [micSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const [micListening, setMicListening] = useState(false);
  const [micDisabled, setMicDisabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [personaMode, setPersonaMode] = useState<"auto" | "custom">("auto");
  const [personaIndex, setPersonaIndex] = useState(0);

  const [wantsAnchor, setWantsAnchor] = useState(false);
  const [anchorLabel, setAnchorLabel] = useState("");
  const [anchorTargetRole, setAnchorTargetRole] = useState("");
  const [anchorTargetIndustry, setAnchorTargetIndustry] = useState("");
  const [anchorJobDescription, setAnchorJobDescription] = useState("");
  const [anchorCompany, setAnchorCompany] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chips, setChips] = useState<TopicSeedChip[]>([]);
  const [timeExpectation, setTimeExpectation] = useState("");
  const [anchorBadge, setAnchorBadge] = useState<string | null>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [crisisFlagged, setCrisisFlagged] = useState(false);
  const [crisisResource, setCrisisResource] = useState<CrisisResource | null>(null);
  const [ending, setEnding] = useState(false);

  // Resume support — before M2.1's tab bar existed, this page was the only
  // way to reach the conversation, so losing local state on unmount never
  // came up. Now that Feedback/Progress/Profile are all one tap away,
  // navigating off and back needs to land back in the same session, not a
  // fresh setup screen with the old one silently orphaned. Full history/
  // resume UI is M6's job later; this only stops the silent data loss.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/current`, { credentials: "include" });
        if (res.ok) {
          const { session } = await res.json();
          if (session) {
            setSessionId(session.sessionId);
            setChips(session.chips);
            setTimeExpectation(session.timeExpectation);
            setAnchorBadge(session.anchorBadge);
            setTurns(session.turns);
            if (session.crisisFlagged) {
              setCrisisFlagged(true);
              if (session.crisisResource) setCrisisResource(session.crisisResource);
            }
            setPhase("chat");
          }
        }
      } finally {
        setResuming(false);
      }
    })();
  }, []);

  function applyTurnResponse(userContent: string, body: { reply: string; crisisFlagged: boolean; crisisResource?: CrisisResource }) {
    setTurns((prev) => [
      ...prev,
      { speaker: "user", content: userContent },
      { speaker: "assistant", content: body.reply },
    ]);
    // Monotonic — once flagged, a later response can never un-flag it, and
    // the card it renders never disappears for the rest of the session.
    if (body.crisisFlagged) {
      setCrisisFlagged(true);
      if (body.crisisResource) setCrisisResource(body.crisisResource);
    }
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setStartError(null);

    if (wantsAnchor && !anchorLabel.trim()) {
      setStartError("Give your anchor a short label, or turn off the anchor toggle.");
      return;
    }

    setStarting(true);
    try {
      let anchorId: string | undefined;
      let anchorBadgeText: string | null = null;

      if (wantsAnchor) {
        const anchorRes = await fetch(`${API_URL}/anchors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            label: anchorLabel,
            targetRole: anchorTargetRole || undefined,
            targetIndustry: anchorTargetIndustry || undefined,
            jobDescriptionText: anchorJobDescription || undefined,
            company: anchorCompany || undefined,
          }),
        });
        if (!anchorRes.ok) {
          setStartError("Couldn't save that anchor. Please try again.");
          return;
        }
        const anchor = await anchorRes.json();
        anchorId = anchor.id;
        anchorBadgeText = [anchorTargetRole, anchorTargetIndustry].filter(Boolean).join(", ") || anchorLabel;
      }

      const persona = personaMode === "custom" ? PERSONA_OPTIONS[personaIndex] : undefined;

      // Reflects which input path is offered in this browser, not literal
      // mic usage yet — see m3-voice-capture/design.md's Decisions on
      // `sessions.mode` meaning session-start intent, not per-turn enforcement.
      const mode = micSupported ? "voice" : "text";

      const startRes = await fetch(`${API_URL}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ anchorId, persona, mode }),
      });
      const body = await startRes.json();
      if (!startRes.ok) {
        setStartError(
          body.message ?? "Couldn't start a session right now — please try again shortly.",
        );
        return;
      }

      setSessionId(body.sessionId);
      setChips(body.chips);
      setTimeExpectation(body.timeExpectation);
      setAnchorBadge(anchorBadgeText);
      setPhase("chat");
    } finally {
      setStarting(false);
    }
  }

  async function sendTurn(content: string) {
    if (!sessionId || !content.trim() || sending) return;
    setSending(true);
    setChips([]); // chips disappear once the conversation starts
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (res.ok) applyTurnResponse(content, body);
    } finally {
      setSending(false);
    }
  }

  async function handleComposerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = composerText;
    setComposerText("");
    await sendTurn(content);
  }

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    try {
      const recognition = new Ctor();
      // continuous:true — false auto-stops as soon as the browser's
      // endpointer thinks one utterance ended, which cut users off
      // mid-thought on natural pauses (observed in manual testing, gets
      // more aggressive with repeated use in the same tab). Stopping is now
      // purely user-driven via the mic button's stop action.
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        // Reported 2026-07-23: fast speech leaves less silence for Chrome's
        // endpointer to cleanly delimit segment boundaries, and it sometimes
        // finalizes the exact same segment more than once as separate
        // adjacent entries in event.results — duplicating that segment's
        // words every time it happens. Not something our code changed (no
        // edits here since M3); Chrome's own recognition service appears to
        // have shifted, and its exact segmentation behavior isn't publicly
        // documented (see m3-voice-capture/design.md's Decisions). This
        // collapses only an exact, immediately-adjacent repeat of a whole
        // segment — a legitimate back-to-back verbatim repeat ("very very
        // good") could in principle also be a single segment repeated this
        // way and get collapsed, but that's rare next to the disruptive,
        // frequent glitch this targets.
        let transcript = "";
        let previousSegment: string | null = null;
        for (let i = 0; i < event.results.length; i++) {
          const segment = event.results[i][0].transcript;
          if (segment === previousSegment) continue;
          transcript += segment;
          previousSegment = segment;
        }
        setComposerText(transcript);
      };
      recognition.onerror = () => {
        setMicListening(false);
        setMicDisabled(true);
      };
      recognition.onend = () => {
        setMicListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setMicListening(true);
    } catch {
      // Construction or start() threw (e.g. denied permission, Safari
      // PWA-context restriction) — fall back to typed-only, same as an
      // unsupported browser. See design.md's Decisions.
      setMicDisabled(true);
      setMicListening(false);
    }
  }

  function handleMicToggle() {
    if (micListening) {
      recognitionRef.current?.stop();
      setMicListening(false);
    } else {
      startListening();
    }
  }

  async function handleChipTap(chip: TopicSeedChip) {
    await sendTurn(chip.prompt);
  }

  async function handleRedirect() {
    if (!sessionId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/redirect`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (res.ok) applyTurnResponse(REDIRECT_TURN_CONTENT, body);
    } finally {
      setSending(false);
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    setEnding(true);
    try {
      await fetch(`${API_URL}/sessions/${sessionId}/end`, {
        method: "POST",
        credentials: "include",
      });
      navigate(`/feedback/${sessionId}`);
    } finally {
      setEnding(false);
    }
  }

  if (resuming) {
    return <main />;
  }

  if (phase === "setup") {
    return (
      <main>
        <h1 className="title">Start a practice session</h1>
        <p className="subtitle">
          Open-ended, no script. Talk about whatever's on your mind about work — past, present,
          or what's next.
        </p>

        {startError && <div className="error-strip">{startError}</div>}

        <form onSubmit={handleStart}>
          <div className="field">
            <label htmlFor="persona-mode">Who you're talking with</label>
            <select
              id="persona-mode"
              value={personaMode}
              onChange={(e) => setPersonaMode(e.target.value as "auto" | "custom")}
            >
              <option value="auto">Surprise me (varies each session)</option>
              <option value="custom">Let me choose</option>
            </select>
          </div>

          {personaMode === "custom" && (
            <div className="field">
              <label htmlFor="persona-choice">Presentation</label>
              <select
                id="persona-choice"
                value={personaIndex}
                onChange={(e) => setPersonaIndex(Number(e.target.value))}
              >
                {PERSONA_OPTIONS.map((option, index) => (
                  <option key={option.label} value={index}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="checkline">
            <input
              type="checkbox"
              checked={wantsAnchor}
              onChange={(e) => setWantsAnchor(e.target.checked)}
              style={{ marginTop: "2px" }}
            />
            <span>Practicing for something specific? Link a target role or industry.</span>
          </label>

          {wantsAnchor && (
            <>
              <div className="field">
                <label htmlFor="anchor-label">Label</label>
                <input
                  id="anchor-label"
                  type="text"
                  placeholder="e.g. Backend Engineer, FinTech"
                  value={anchorLabel}
                  onChange={(e) => setAnchorLabel(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="anchor-role">Target role (optional)</label>
                <input
                  id="anchor-role"
                  type="text"
                  value={anchorTargetRole}
                  onChange={(e) => setAnchorTargetRole(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="anchor-industry">Target industry (optional)</label>
                <input
                  id="anchor-industry"
                  type="text"
                  value={anchorTargetIndustry}
                  onChange={(e) => setAnchorTargetIndustry(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="anchor-jd">Job description (optional, kept for feedback later — not used to steer this conversation)</label>
                <input
                  id="anchor-jd"
                  type="text"
                  value={anchorJobDescription}
                  onChange={(e) => setAnchorJobDescription(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="anchor-company">Company (optional)</label>
                <input
                  id="anchor-company"
                  type="text"
                  value={anchorCompany}
                  onChange={(e) => setAnchorCompany(e.target.value)}
                />
              </div>
            </>
          )}

          <p className="time-expectation">No need to rush — take whatever time feels right.</p>

          <button className="btn" type="submit" disabled={starting}>
            {starting ? "Starting..." : "Start practicing"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <div className="noscore-strip">Not scored. Nothing here is being graded — just talk.</div>
      {anchorBadge && <div className="anchor-badge">Practicing for: {anchorBadge}</div>}
      {timeExpectation && <p className="time-expectation">{timeExpectation}</p>}

      {turns.map((turn, index) => (
        <div key={index} className={`bubble ${turn.speaker === "user" ? "user" : "ai"}`}>
          {turn.content}
        </div>
      ))}

      {crisisFlagged && crisisResource && (
        <div className="safety-card">
          <h3>Before we keep going —</h3>
          <p>That sounded heavier than ordinary work stress. No pressure to say more here.</p>
          <a className="resource-link" href={crisisResource.href}>
            {crisisResource.name}
            <span className="resource-contact">{crisisResource.contact}</span>
          </a>
          <p style={{ marginBottom: 0 }}>
            Whenever you're ready, we can keep going, or stop here — either is completely fine.
          </p>
        </div>
      )}

      {chips.length > 0 && (
        <div className="chip-row">
          {chips.map((chip) => (
            <button key={chip.id} className="chip" onClick={() => handleChipTap(chip)} disabled={sending}>
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={handleComposerSubmit}>
        <input
          type="text"
          placeholder="Type your reply..."
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          disabled={sending}
        />
        {micSupported && (
          <button
            type="button"
            className={`iconbtn mic${micListening ? " listening" : ""}`}
            onClick={handleMicToggle}
            disabled={sending || micDisabled}
            aria-label={micListening ? "Stop recording" : "Speak your reply"}
          >
            ●
          </button>
        )}
        <button className="iconbtn" type="submit" disabled={sending || !composerText.trim()} aria-label="Send message">
          →
        </button>
      </form>

      <div className="session-controls">
        <button className="endlink" onClick={handleRedirect} disabled={sending}>
          Let's talk about something else
        </button>
        <button className="endlink" onClick={handleEnd} disabled={ending}>
          {ending ? "Ending..." : "End session"}
        </button>
      </div>
    </main>
  );
}
