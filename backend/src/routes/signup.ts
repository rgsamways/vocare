import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { MINIMUM_AGE } from "../config.js";

interface SignupBody {
  email?: string;
  dateOfBirth?: string;
  country?: string;
}

function calculateAge(dateOfBirth: Date, now: Date): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = now.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Pre-checks the age gate and stashes sign-up-only fields (date of birth,
 * country) before the client requests the actual magic link from Better
 * Auth's own mounted endpoint — see auth.ts's databaseHooks.user.create.before,
 * which is what actually consumes pending_signups on verify.
 */
export async function signupRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SignupBody }>("/auth/pending-signup", async (request, reply) => {
    const { email, dateOfBirth, country } = request.body ?? {};

    if (!email || !dateOfBirth || !country) {
      return reply.code(400).send({ error: "email, dateOfBirth, and country are required" });
    }

    const [existingUser] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email));

    if (existingUser) {
      // Returning user — no age gate or pending record needed, they already have an account.
      return reply.send({ ok: true, isNewUser: false });
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return reply.code(400).send({ error: "invalid dateOfBirth" });
    }

    if (calculateAge(dob, new Date()) < MINIMUM_AGE) {
      return reply.code(400).send({ error: "below_minimum_age" });
    }

    await db
      .insert(schema.pendingSignups)
      .values({ email, dateOfBirth, country })
      .onConflictDoUpdate({
        target: schema.pendingSignups.email,
        set: { dateOfBirth, country },
      });

    return reply.send({ ok: true, isNewUser: true });
  });
}
