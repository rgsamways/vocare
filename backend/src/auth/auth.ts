import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { sendMagicLink } from "./send-magic-link.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.WEB_URL ? [process.env.WEB_URL] : undefined,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: false },
  socialProviders: {},
  session: {
    // 30-day sliding window, refreshed on activity (see spec's Session Expiration requirement).
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      entitlementStatus: {
        type: "string",
        required: true,
        input: false,
        defaultValue: "unpaid",
      },
      dateOfBirth: {
        type: "date",
        required: true,
        input: false,
      },
      country: {
        type: "string",
        required: true,
        input: false,
      },
      paidAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const [pending] = await db
            .select()
            .from(schema.pendingSignups)
            .where(eq(schema.pendingSignups.email, user.email));
          if (!pending) return false;
          return {
            data: {
              ...user,
              dateOfBirth: new Date(pending.dateOfBirth),
              country: pending.country,
              entitlementStatus: "unpaid",
            },
          };
        },
        after: async (user) => {
          await db
            .delete(schema.pendingSignups)
            .where(eq(schema.pendingSignups.email, user.email));
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 5,
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLink(email, url);
      },
    }),
  ],
});
