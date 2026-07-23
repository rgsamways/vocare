import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Minimal M6 precursor — bare create-only surface for M2 to exercise
 * anchor-aware steering end-to-end. Full CRUD/edit/archive/anchor_revisions
 * are M6's; see m2-conversation-engine/design.md's Decisions section.
 */
export const anchors = pgTable("anchors", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  targetRole: text("target_role"),
  targetIndustry: text("target_industry"),
  jobDescriptionText: text("job_description_text"),
  company: text("company"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

/**
 * Practice sessions (distinct from Better Auth's own "session" table,
 * which tracks auth sessions). See design.md's Migration Plan.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    status: text("status", { enum: ["start", "in-progress", "complete"] })
      .notNull()
      .default("start"),
    crisisFlagged: boolean("crisis_flagged").notNull().default(false),
    anchorId: uuid("anchor_id").references(() => anchors.id),
    // Chosen once at session start (auto-varied or user-selected) and reused
    // for every turn — never re-derived mid-conversation. See design.md's
    // Decisions section on persona properties.
    personaAgeRange: text("persona_age_range").notNull(),
    personaGenderPresentation: text("persona_gender_presentation").notNull(),
    // Chosen once at session start, reflecting which input path was offered —
    // not re-derived per turn even if the user mixes voice and typed turns.
    // See m3-voice-capture/design.md's Decisions.
    mode: text("mode", { enum: ["voice", "text"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("sessions_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
);

/**
 * Full conversation record, per spec Section 3's data model. The redirect
 * control's own invocation is persisted as a speaker:"user" row too (a
 * "control-turn") rather than a separate enum value — see design.md's
 * Decisions section — identified by REDIRECT_TURN_CONTENT in redirect.ts.
 */
export const transcriptTurns = pgTable(
  "transcript_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    speaker: text("speaker", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transcript_turns_session_id_ts_idx").on(table.sessionId, table.ts)],
);

/**
 * One row per completed session, written by the async mining pass — never
 * read back to the client (see m4-post-session-mining/specs/session-mining's
 * "No user-facing mining surface" requirement). `sessionId` is the primary
 * key itself rather than a separate `id`, matching this file's existing
 * natural-key convention (`stripePayments`/`stripeWebhookEvents`) and
 * enforcing the one-row-per-session constraint directly.
 *
 * `clarity`/`sentiment` enum values are a placeholder taxonomy pending real
 * usage data, same posture as config.ts's other placeholders. No
 * `filler_word_count` column — see design.md's Decisions on why that signal
 * is skipped entirely rather than stored as a non-value.
 */
export const sessionMiningResults = pgTable("session_mining_results", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id),
  ownershipLanguagePresent: boolean("ownership_language_present").notNull(),
  tradeoffReasoningPresent: boolean("tradeoff_reasoning_present").notNull(),
  techDomainMentions: jsonb("tech_domain_mentions").notNull().$type<string[]>(),
  clarity: text("clarity", { enum: ["clear", "mixed", "unclear"] }).notNull(),
  sentiment: text("sentiment", { enum: ["positive", "neutral", "negative"] }).notNull(),
  growthSignals: jsonb("growth_signals").notNull().$type<string[]>(),
  outcomeMentioned: boolean("outcome_mentioned").notNull(),
  quantifiedImpactExamples: jsonb("quantified_impact_examples").notNull().$type<string[]>(),
  // Omitted entirely (not defaulted to []) when the session has no linked
  // anchor with target_role set — see design.md's Decisions.
  audienceKeywordMatches: jsonb("audience_keyword_matches").$type<string[]>(),
  topicRelevanceScore: integer("topic_relevance_score").notNull(),
  minedAt: timestamp("mined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Maps a completed checkout's PaymentIntent back to the user it unlocked —
 * a `charge.dispute.created` event only carries the charge/PaymentIntent,
 * not our userId, so this is how the dispute handler finds who to revoke.
 */
export const stripePayments = pgTable("stripe_payments", {
  paymentIntentId: text("payment_intent_id").primaryKey(),
  userId: text("user_id").notNull(),
});

/**
 * Holds sign-up-form fields (age gate, country) between the magic-link
 * request and the account actually being created on verify — Better
 * Auth's magic-link plugin doesn't carry custom fields through that gap
 * (see databaseHooks.user.create.before in auth.ts, which consumes this).
 */
export const pendingSignups = pgTable("pending_signups", {
  email: text("email").primaryKey(),
  dateOfBirth: date("date_of_birth").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
