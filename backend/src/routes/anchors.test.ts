import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const TEST_USER_ID = "anchors-route-test-user";
const OTHER_USER_ID = "anchors-route-test-other-user";
const TEST_EMAIL = "anchors-route-test@example.com";
const OTHER_EMAIL = "anchors-route-test-other@example.com";
const TEST_USER = { id: TEST_USER_ID, country: "Canada" };

let sessionUser: typeof TEST_USER | null = TEST_USER;
vi.mock("../auth/session.js", () => ({
  getSessionUser: async () => sessionUser,
}));

const { buildApp } = await import("../app.js");
const { db, schema } = await import("../db/client.js");

async function cleanup() {
  for (const userId of [TEST_USER_ID, OTHER_USER_ID]) {
    const ownedAnchors = await db
      .select({ id: schema.anchors.id })
      .from(schema.anchors)
      .where(eq(schema.anchors.userId, userId));
    const anchorIds = ownedAnchors.map((a) => a.id);
    if (anchorIds.length > 0) {
      await db.delete(schema.anchorRevisions).where(inArray(schema.anchorRevisions.anchorId, anchorIds));
    }
    await db.delete(schema.anchors).where(eq(schema.anchors.userId, userId));
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  }
}

async function createAnchor(
  userId: string,
  overrides: Partial<{
    label: string;
    targetRole: string | null;
    targetIndustry: string | null;
    jobDescriptionText: string | null;
    company: string | null;
    archivedAt: Date | null;
  }> = {},
) {
  const [anchor] = await db
    .insert(schema.anchors)
    .values({
      userId,
      label: overrides.label ?? "Backend engineer",
      targetRole: overrides.targetRole ?? "Backend engineer",
      targetIndustry: overrides.targetIndustry ?? null,
      jobDescriptionText: overrides.jobDescriptionText ?? null,
      company: overrides.company ?? null,
      archivedAt: overrides.archivedAt ?? null,
    })
    .returning();
  return anchor;
}

describe("anchors routes", () => {
  beforeEach(async () => {
    await cleanup();
    sessionUser = TEST_USER;
    await db.insert(schema.user).values({
      id: TEST_USER_ID,
      name: "",
      email: TEST_EMAIL,
      emailVerified: true,
      entitlementStatus: "paid",
      dateOfBirth: new Date("1990-01-01"),
      country: "Canada",
    });
    await db.insert(schema.user).values({
      id: OTHER_USER_ID,
      name: "",
      email: OTHER_EMAIL,
      emailVerified: true,
      entitlementStatus: "paid",
      dateOfBirth: new Date("1990-01-01"),
      country: "Canada",
    });
  });

  afterEach(cleanup);

  describe("GET /anchors", () => {
    it("returns 401 when unauthenticated", async () => {
      sessionUser = null;
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/anchors" });
      expect(res.statusCode).toBe(401);
    });

    it("excludes archived anchors by default", async () => {
      const active = await createAnchor(TEST_USER_ID, { label: "Active" });
      await createAnchor(TEST_USER_ID, { label: "Archived", archivedAt: new Date() });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/anchors" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.map((a: { id: string }) => a.id)).toEqual([active.id]);
    });

    it("includes archived anchors when requested", async () => {
      await createAnchor(TEST_USER_ID, { label: "Active" });
      await createAnchor(TEST_USER_ID, { label: "Archived", archivedAt: new Date() });

      const app = buildApp();
      const res = await app.inject({ method: "GET", url: "/anchors?includeArchived=true" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });
  });

  describe("PATCH /anchors/:id", () => {
    it("writes exactly one revision with the pre-edit snapshot when a field changes", async () => {
      const anchor = await createAnchor(TEST_USER_ID, { targetRole: "Backend engineer" });

      const app = buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: `/anchors/${anchor.id}`,
        payload: { targetRole: "Staff backend engineer" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().targetRole).toBe("Staff backend engineer");

      const revisions = await db
        .select()
        .from(schema.anchorRevisions)
        .where(eq(schema.anchorRevisions.anchorId, anchor.id));
      expect(revisions).toHaveLength(1);
      expect(revisions[0].targetRole).toBe("Backend engineer");
      expect(revisions[0].label).toBe(anchor.label);
    });

    it("writes no revision when the edit changes no fields", async () => {
      const anchor = await createAnchor(TEST_USER_ID, { targetRole: "Backend engineer" });

      const app = buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: `/anchors/${anchor.id}`,
        payload: { targetRole: "Backend engineer" },
      });
      expect(res.statusCode).toBe(200);

      const revisions = await db
        .select()
        .from(schema.anchorRevisions)
        .where(eq(schema.anchorRevisions.anchorId, anchor.id));
      expect(revisions).toHaveLength(0);
    });

    it("denies editing another user's anchor as if it did not exist", async () => {
      const anchor = await createAnchor(OTHER_USER_ID);

      const app = buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: `/anchors/${anchor.id}`,
        payload: { targetRole: "Anything" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("archive / unarchive", () => {
    it("toggles archivedAt without writing a revision", async () => {
      const anchor = await createAnchor(TEST_USER_ID);
      const app = buildApp();

      const archiveRes = await app.inject({ method: "POST", url: `/anchors/${anchor.id}/archive` });
      expect(archiveRes.statusCode).toBe(200);
      expect(archiveRes.json().archivedAt).not.toBeNull();

      const unarchiveRes = await app.inject({ method: "POST", url: `/anchors/${anchor.id}/unarchive` });
      expect(unarchiveRes.statusCode).toBe(200);
      expect(unarchiveRes.json().archivedAt).toBeNull();

      const revisions = await db
        .select()
        .from(schema.anchorRevisions)
        .where(eq(schema.anchorRevisions.anchorId, anchor.id));
      expect(revisions).toHaveLength(0);
    });

    it("denies archiving another user's anchor as if it did not exist", async () => {
      const anchor = await createAnchor(OTHER_USER_ID);
      const app = buildApp();
      const res = await app.inject({ method: "POST", url: `/anchors/${anchor.id}/archive` });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /anchors/:id/revisions", () => {
    it("returns revisions oldest-first", async () => {
      const anchor = await createAnchor(TEST_USER_ID, { targetRole: "Role A" });
      const app = buildApp();

      await app.inject({ method: "PATCH", url: `/anchors/${anchor.id}`, payload: { targetRole: "Role B" } });
      await app.inject({ method: "PATCH", url: `/anchors/${anchor.id}`, payload: { targetRole: "Role C" } });

      const res = await app.inject({ method: "GET", url: `/anchors/${anchor.id}/revisions` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0].targetRole).toBe("Role A");
      expect(body[1].targetRole).toBe("Role B");
    });

    it("returns an empty list for a never-edited anchor", async () => {
      const anchor = await createAnchor(TEST_USER_ID);
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/anchors/${anchor.id}/revisions` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("denies reading another user's anchor revision history", async () => {
      const anchor = await createAnchor(OTHER_USER_ID);
      const app = buildApp();
      const res = await app.inject({ method: "GET", url: `/anchors/${anchor.id}/revisions` });
      expect(res.statusCode).toBe(404);
    });
  });
});
