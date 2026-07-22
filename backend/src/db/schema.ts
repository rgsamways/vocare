import {
  boolean,
  date,
  index,
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
