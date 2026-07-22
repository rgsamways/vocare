import { eq, like } from "drizzle-orm";
import { db, schema } from "../db/client.js";

/**
 * The single owned interception point for account deletion — an explicit,
 * ordered, transactional delete, not `ON DELETE CASCADE` FKs (design.md's
 * decision: a cascade at the DB level can't be intercepted by future
 * application logic, e.g. M7's eventual recomputation-vs-disclosure policy).
 *
 * Tables covered now: the `user` row itself (Better Auth's table, carrying
 * our entitlement fields), practice `sessions`, `stripe_payments`, and
 * Better Auth's own `session`/`account`/`verification` tables — real names
 * confirmed via its Drizzle adapter (tasks.md 2.5), not guessed.
 *
 * `verification` rows aren't keyed by userId (Better Auth keys them by the
 * token itself, storing the email inside a JSON `value` column) — matched
 * by email instead so no stale magic-link token for this identity survives
 * deletion (see account-management spec's "cannot sign in again" scenario).
 *
 * Tables named in proposal.md/spec Section 13 that don't exist yet as of
 * M1 — transcript_turns, session_mining_results, feedback_reports,
 * tier1_profiles, anchors, anchor_revisions — belong in this same function,
 * added by whichever module (M2/M4/M5/M6/M9) creates each one. This is the
 * one file to grep to check whether that happened.
 */
export async function deleteUserCascade(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(schema.user).where(eq(schema.user.id, userId));
    if (!user) return;

    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await tx.delete(schema.stripePayments).where(eq(schema.stripePayments.userId, userId));
    await tx.delete(schema.account).where(eq(schema.account.userId, userId));
    await tx.delete(schema.session).where(eq(schema.session.userId, userId));
    await tx
      .delete(schema.verification)
      .where(like(schema.verification.value, `%"email":"${user.email}"%`));
    await tx.delete(schema.user).where(eq(schema.user.id, userId));
  });
}
