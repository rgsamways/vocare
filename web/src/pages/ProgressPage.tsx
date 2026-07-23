import { useCallback, useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL as string;

interface Anchor {
  id: string;
  label: string;
  targetRole: string | null;
  targetIndustry: string | null;
  jobDescriptionText: string | null;
  company: string | null;
  createdAt: string;
  archivedAt: string | null;
}

interface AnchorRevision {
  id: string;
  anchorId: string;
  label: string;
  targetRole: string | null;
  targetIndustry: string | null;
  jobDescriptionText: string | null;
  company: string | null;
  revisedAt: string;
}

type AnchorSnapshot = Pick<Anchor, "label" | "targetRole" | "targetIndustry" | "jobDescriptionText" | "company">;

interface SessionSummary {
  sessionId: string;
  createdAt: string;
  completedAt: string | null;
  anchorLabel: string | null;
  topicPreview: string | null;
}

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

interface TranscriptTurn {
  id: string;
  speaker: "user" | "assistant";
  content: string;
  ts: string;
}

interface SessionDetail extends SessionSummary {
  turns: TranscriptTurn[];
  feedbackReport: FeedbackReport | null;
}

interface Trend {
  direction: "improved" | "declined" | "unchanged";
  message: string;
}

interface AudienceTrend extends Trend {
  anchorId: string;
  anchorLabel: string | null;
}

interface TrendsResponse {
  tradeoffReasoningTrend: Trend | null;
  audienceAlignmentTrends: AudienceTrend[];
}

interface EditForm {
  label: string;
  targetRole: string;
  targetIndustry: string;
  jobDescriptionText: string;
  company: string;
}

const EMPTY_ANCHOR_FORM: EditForm = {
  label: "",
  targetRole: "",
  targetIndustry: "",
  jobDescriptionText: "",
  company: "",
};

const ANCHOR_FIELDS: Array<{ key: keyof AnchorSnapshot; label: string }> = [
  { key: "label", label: "Label" },
  { key: "targetRole", label: "Target role" },
  { key: "targetIndustry", label: "Target industry" },
  { key: "jobDescriptionText", label: "Job description" },
  { key: "company", label: "Company" },
];

// Client-side diff between two consecutive anchor snapshots — the server
// only ever stores plain pre-edit field values, never a generated diff
// sentence, so this is where "narrowed from X to Y" gets built. See
// m6-progress-over-time/design.md's Decisions.
function diffAnchorSnapshots(before: AnchorSnapshot, after: AnchorSnapshot): string[] {
  const changes: string[] = [];
  for (const { key, label } of ANCHOR_FIELDS) {
    const from = before[key] ?? "(not set)";
    const to = after[key] ?? "(not set)";
    if (from !== to) {
      changes.push(`${label}: "${from}" → "${to}"`);
    }
  }
  return changes;
}

function toEditForm(anchor: Anchor): EditForm {
  return {
    label: anchor.label,
    targetRole: anchor.targetRole ?? "",
    targetIndustry: anchor.targetIndustry ?? "",
    jobDescriptionText: anchor.jobDescriptionText ?? "",
    company: anchor.company ?? "",
  };
}

// The mockup's anchor-card shows only the single most-recent change, always
// visible (not gated behind "View history") — see design.md's 2026-07-23
// correction. `revisions` is oldest-first, so the most recent edit is the
// diff between the last revision snapshot and the live anchor.
function latestRevisionSummary(anchor: Anchor, revisions: AnchorRevision[] | undefined) {
  if (!revisions || revisions.length === 0) return null;
  const lastRevision = revisions[revisions.length - 1];
  const lines = diffAnchorSnapshots(lastRevision, anchor);
  if (lines.length === 0) return null;
  return { revisedAt: lastRevision.revisedAt, lines };
}

function AnchorFieldset({
  idPrefix,
  form,
  onChange,
}: {
  idPrefix: string;
  form: EditForm;
  onChange: (form: EditForm) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-label`}>Label</label>
        <input
          id={`${idPrefix}-label`}
          type="text"
          value={form.label}
          onChange={(e) => onChange({ ...form, label: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-role`}>Target role (optional)</label>
        <input
          id={`${idPrefix}-role`}
          type="text"
          value={form.targetRole}
          onChange={(e) => onChange({ ...form, targetRole: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-industry`}>Target industry (optional)</label>
        <input
          id={`${idPrefix}-industry`}
          type="text"
          value={form.targetIndustry}
          onChange={(e) => onChange({ ...form, targetIndustry: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-jd`}>Job description (optional)</label>
        <textarea
          id={`${idPrefix}-jd`}
          value={form.jobDescriptionText}
          onChange={(e) => onChange({ ...form, jobDescriptionText: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-company`}>Company (optional)</label>
        <input
          id={`${idPrefix}-company`}
          type="text"
          value={form.company}
          onChange={(e) => onChange({ ...form, company: e.target.value })}
        />
      </div>
    </>
  );
}

function AnchorHistory({ anchor, revisions }: { anchor: Anchor; revisions: AnchorRevision[] | undefined }) {
  if (!revisions) return <p className="subtitle">Loading history...</p>;

  const timeline: Array<{ snapshot: AnchorSnapshot; at: string | null }> = [
    ...revisions.map((r) => ({ snapshot: r, at: r.revisedAt })),
    { snapshot: anchor, at: null },
  ];

  const steps = timeline
    .slice(1)
    .map((entry, i) => ({ at: entry.at, lines: diffAnchorSnapshots(timeline[i].snapshot, entry.snapshot) }))
    .filter((step) => step.lines.length > 0);

  if (steps.length === 0) {
    return <p className="subtitle">No edits yet — this anchor hasn't changed since it was created.</p>;
  }

  return (
    <ul aria-label={`Revision history for ${anchor.label}`} style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {steps.map((step, i) => (
        <li key={i} style={{ marginBottom: 10 }}>
          <p className="subtitle" style={{ margin: "0 0 4px" }}>
            {step.at ? new Date(step.at).toLocaleDateString() : "Most recent edit"}
          </p>
          {step.lines.map((line, j) => (
            <p key={j} style={{ margin: "0 0 2px", fontSize: 13.5 }}>
              {line}
            </p>
          ))}
        </li>
      ))}
    </ul>
  );
}

function AnchorCard({
  anchor,
  editing,
  editForm,
  savingEdit,
  historyOpen,
  revisions,
  onStartEdit,
  onCancelEdit,
  onEditFormChange,
  onSaveEdit,
  onToggleArchive,
  onToggleHistory,
}: {
  anchor: Anchor;
  editing: boolean;
  editForm: EditForm | null;
  savingEdit: boolean;
  historyOpen: boolean;
  revisions: AnchorRevision[] | undefined;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditFormChange: (form: EditForm) => void;
  onSaveEdit: () => void;
  onToggleArchive: () => void;
  onToggleHistory: () => void;
}) {
  if (editing && editForm) {
    return (
      <li className="anchor-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveEdit();
          }}
        >
          <AnchorFieldset idPrefix={`edit-${anchor.id}`} form={editForm} onChange={onEditFormChange} />
          <button className="btn" type="submit" disabled={savingEdit || !editForm.label.trim()}>
            {savingEdit ? "Saving..." : "Save changes"}
          </button>
          <button className="btn secondary" type="button" style={{ marginTop: 8 }} onClick={onCancelEdit}>
            Cancel
          </button>
        </form>
      </li>
    );
  }

  const roleIndustryLine = [anchor.targetRole, anchor.targetIndustry].filter(Boolean).join(", ");
  const latestRevision = latestRevisionSummary(anchor, revisions);

  return (
    <li className={`anchor-card${anchor.archivedAt ? "" : " active"}`}>
      <h4>{anchor.label}</h4>
      <p>{anchor.archivedAt ? "Archived" : "Active"}</p>
      {roleIndustryLine && <p>{roleIndustryLine}</p>}

      {latestRevision && (
        <div className="anchor-revision earned">
          <span>
            Revised {new Date(latestRevision.revisedAt).toLocaleDateString()}: {latestRevision.lines.join("; ")}
          </span>
        </div>
      )}

      <div className="anchor-card-actions">
        <button type="button" onClick={onStartEdit}>
          Edit
        </button>
        <button type="button" onClick={onToggleArchive}>
          {anchor.archivedAt ? "Unarchive" : "Archive"}
        </button>
        <button type="button" onClick={onToggleHistory} aria-expanded={historyOpen}>
          {historyOpen ? "Hide full history" : "View full history"}
        </button>
      </div>

      {historyOpen && (
        <div aria-live="polite">
          <AnchorHistory anchor={anchor} revisions={revisions} />
        </div>
      )}
    </li>
  );
}

export function ProgressPage() {
  const [anchors, setAnchors] = useState<Anchor[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [revisionsByAnchor, setRevisionsByAnchor] = useState<Record<string, AnchorRevision[]>>({});
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [showCreateAnchor, setShowCreateAnchor] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(EMPTY_ANCHOR_FORM);
  const [creatingAnchor, setCreatingAnchor] = useState(false);

  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, SessionDetail>>({});

  const [trends, setTrends] = useState<TrendsResponse | null>(null);

  const loadAnchors = useCallback(async (includeArchived: boolean) => {
    const res = await fetch(`${API_URL}/anchors${includeArchived ? "?includeArchived=true" : ""}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const list: Anchor[] = await res.json();
    setAnchors(list);

    // Prefetch every anchor's revisions so the most-recent-change callout
    // renders immediately, not gated behind "View full history" — matches
    // the mockup's always-visible anchor-revision.earned callout. Low
    // per-user anchor count keeps this cheap unbatched.
    const fetched = await Promise.all(
      list.map(async (anchor) => {
        const revisionsRes = await fetch(`${API_URL}/anchors/${anchor.id}/revisions`, { credentials: "include" });
        if (!revisionsRes.ok) return null;
        const revisions: AnchorRevision[] = await revisionsRes.json();
        return [anchor.id, revisions] as const;
      }),
    );
    setRevisionsByAnchor((prev) => {
      const next = { ...prev };
      for (const entry of fetched) {
        if (entry) next[entry[0]] = entry[1];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadAnchors(showArchived);
  }, [showArchived, loadAnchors]);

  useEffect(() => {
    fetch(`${API_URL}/sessions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setSessions);
    fetch(`${API_URL}/progress/trends`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setTrends);
  }, []);

  function startEdit(anchor: Anchor) {
    setEditingId(anchor.id);
    setEditForm(toEditForm(anchor));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(anchor: Anchor) {
    if (!editForm || !editForm.label.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/anchors/${anchor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: editForm.label,
          targetRole: editForm.targetRole || null,
          targetIndustry: editForm.targetIndustry || null,
          jobDescriptionText: editForm.jobDescriptionText || null,
          company: editForm.company || null,
        }),
      });
      if (res.ok) {
        const updated: Anchor = await res.json();
        setAnchors((prev) => prev?.map((a) => (a.id === anchor.id ? updated : a)) ?? prev);
        // The just-edited anchor's history/inline callout are now stale —
        // drop the cached copy and re-fetch instead of showing a pre-edit list.
        const revisionsRes = await fetch(`${API_URL}/anchors/${anchor.id}/revisions`, { credentials: "include" });
        if (revisionsRes.ok) {
          const revisions: AnchorRevision[] = await revisionsRes.json();
          setRevisionsByAnchor((prev) => ({ ...prev, [anchor.id]: revisions }));
        }
        cancelEdit();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleArchive(anchor: Anchor) {
    const action = anchor.archivedAt ? "unarchive" : "archive";
    const res = await fetch(`${API_URL}/anchors/${anchor.id}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return;
    const updated: Anchor = await res.json();
    if (!showArchived && updated.archivedAt) {
      setAnchors((prev) => prev?.filter((a) => a.id !== anchor.id) ?? prev);
    } else {
      setAnchors((prev) => prev?.map((a) => (a.id === anchor.id ? updated : a)) ?? prev);
    }
  }

  async function toggleHistory(anchorId: string) {
    if (openHistoryId === anchorId) {
      setOpenHistoryId(null);
      return;
    }
    setOpenHistoryId(anchorId);
    if (!revisionsByAnchor[anchorId]) {
      const res = await fetch(`${API_URL}/anchors/${anchorId}/revisions`, { credentials: "include" });
      if (res.ok) {
        const revisions: AnchorRevision[] = await res.json();
        setRevisionsByAnchor((prev) => ({ ...prev, [anchorId]: revisions }));
      }
    }
  }

  async function createAnchor() {
    if (!createForm.label.trim()) return;
    setCreatingAnchor(true);
    try {
      const res = await fetch(`${API_URL}/anchors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: createForm.label,
          targetRole: createForm.targetRole || undefined,
          targetIndustry: createForm.targetIndustry || undefined,
          jobDescriptionText: createForm.jobDescriptionText || undefined,
          company: createForm.company || undefined,
        }),
      });
      if (res.ok) {
        setCreateForm(EMPTY_ANCHOR_FORM);
        setShowCreateAnchor(false);
        await loadAnchors(showArchived);
      }
    } finally {
      setCreatingAnchor(false);
    }
  }

  async function toggleSession(sessionId: string, willOpen: boolean) {
    setOpenSessionId(willOpen ? sessionId : null);
    if (willOpen && !sessionDetails[sessionId]) {
      const res = await fetch(`${API_URL}/sessions/${sessionId}`, { credentials: "include" });
      if (res.ok) {
        const detail: SessionDetail = await res.json();
        setSessionDetails((prev) => ({ ...prev, [sessionId]: detail }));
      }
    }
  }

  const hasNoTrends =
    trends !== null && !trends.tradeoffReasoningTrend && trends.audienceAlignmentTrends.length === 0;

  return (
    <main>
      <h1 className="title">Progress &amp; anchors</h1>
      <p className="subtitle">
        Your past sessions, how things are trending over time, and the goals you're practicing
        against.
      </p>

      <section aria-labelledby="trends-heading">
        <h2 id="trends-heading" className="subtitle-h">
          Trends
        </h2>
        <div aria-live="polite">
          {trends === null && <p className="subtitle">Loading trends...</p>}
          {hasNoTrends && (
            <p className="subtitle">Nothing to show yet — keep practicing to see how things are trending.</p>
          )}
          {trends?.tradeoffReasoningTrend && (
            <div className="trend-line">{trends.tradeoffReasoningTrend.message}</div>
          )}
          {trends?.audienceAlignmentTrends.map((trend) => (
            <div className="trend-line" key={trend.anchorId}>
              {trend.anchorLabel ? `${trend.anchorLabel}: ${trend.message}` : trend.message}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="subtitle-h">
          Past sessions
        </h2>
        {sessions === null && <p className="subtitle">Loading sessions...</p>}
        {sessions?.length === 0 && (
          <p className="subtitle">Nothing here yet — complete a practice session to see it here.</p>
        )}

        {sessions?.map((session) => {
          const detail = sessionDetails[session.sessionId];
          const open = openSessionId === session.sessionId;
          const noteText =
            session.topicPreview ?? `Session on ${new Date(session.createdAt).toLocaleDateString()}`;
          return (
            <details
              className="history-row"
              key={session.sessionId}
              open={open}
              onToggle={(e) => toggleSession(session.sessionId, e.currentTarget.open)}
            >
              <summary>
                <span className="history-note-wrap">
                  <span className="chevron-icon" aria-hidden="true">
                    ›
                  </span>
                  <span className="history-note">
                    {noteText}
                    {session.anchorLabel ? ` — ${session.anchorLabel}` : ""}
                  </span>
                </span>
                <span className="history-date">{new Date(session.createdAt).toLocaleDateString()}</span>
              </summary>

              <div className="history-expanded" aria-live="polite">
                {!detail && <p className="subtitle">Loading session...</p>}
                {detail && (
                  <>
                    {detail.turns.map((turn) => (
                      <div key={turn.id} className={`bubble ${turn.speaker === "user" ? "user" : "ai"}`}>
                        {turn.content}
                      </div>
                    ))}
                    {detail.feedbackReport ? (
                      <ul
                        className="feedback-notes"
                        aria-label="Coaching notes for this session"
                        style={{ marginTop: 14 }}
                      >
                        {detail.feedbackReport.coachingNotes.map((note, i) => (
                          <li className="feedback-note" key={i}>
                            <p>{note.note}</p>
                            {note.quote && (
                              <blockquote className="feedback-quote">
                                <p>&ldquo;{note.quote}&rdquo;</p>
                              </blockquote>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtitle" style={{ marginTop: 14 }}>
                        No feedback report for this session yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </section>

      <section aria-labelledby="anchors-heading">
        <h2 id="anchors-heading" className="subtitle-h">
          Your anchors
        </h2>
        <label className="checkline">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginTop: "2px" }}
          />
          <span>Show archived anchors</span>
        </label>

        {anchors === null && <p className="subtitle">Loading anchors...</p>}
        {anchors?.length === 0 && (
          <p className="subtitle">No anchors yet — add one below, or set one up when you start a practice session.</p>
        )}

        <ul aria-label="Your anchors" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {anchors?.map((anchor) => (
            <AnchorCard
              key={anchor.id}
              anchor={anchor}
              editing={editingId === anchor.id}
              editForm={editingId === anchor.id ? editForm : null}
              savingEdit={savingEdit}
              historyOpen={openHistoryId === anchor.id}
              revisions={revisionsByAnchor[anchor.id]}
              onStartEdit={() => startEdit(anchor)}
              onCancelEdit={cancelEdit}
              onEditFormChange={setEditForm}
              onSaveEdit={() => saveEdit(anchor)}
              onToggleArchive={() => toggleArchive(anchor)}
              onToggleHistory={() => toggleHistory(anchor.id)}
            />
          ))}
        </ul>

        {!showCreateAnchor && (
          <button type="button" className="add-anchor-link" onClick={() => setShowCreateAnchor(true)}>
            + Add another anchor
          </button>
        )}
        {showCreateAnchor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAnchor();
            }}
            style={{ marginTop: 10 }}
          >
            <AnchorFieldset idPrefix="create-anchor" form={createForm} onChange={setCreateForm} />
            <button className="btn" type="submit" disabled={creatingAnchor || !createForm.label.trim()}>
              {creatingAnchor ? "Adding..." : "Add anchor"}
            </button>
            <button
              className="btn secondary"
              type="button"
              style={{ marginTop: 8 }}
              onClick={() => {
                setShowCreateAnchor(false);
                setCreateForm(EMPTY_ANCHOR_FORM);
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
