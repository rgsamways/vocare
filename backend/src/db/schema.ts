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
    anchorId: uuid("anchor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("sessions_user_id_created_at_idx").on(table.userId, table.createdAt),
  ],
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
