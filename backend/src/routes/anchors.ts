import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getSessionUser } from "../auth/session.js";
import { db, schema } from "../db/client.js";

const EDITABLE_FIELDS = [
  "label",
  "targetRole",
  "targetIndustry",
  "jobDescriptionText",
  "company",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

interface UpdateAnchorBody {
  label?: string;
  targetRole?: string | null;
  targetIndustry?: string | null;
  jobDescriptionText?: string | null;
  company?: string | null;
}

async function loadOwnedAnchor(anchorId: string, userId: string) {
  const [anchor] = await db
    .select()
    .from(schema.anchors)
    .where(and(eq(schema.anchors.id, anchorId), eq(schema.anchors.userId, userId)));
  return anchor ?? null;
}

export async function anchorsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { includeArchived?: string } }>("/anchors", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const includeArchived = request.query?.includeArchived === "true";
    const conditions = [eq(schema.anchors.userId, user.id)];
    if (!includeArchived) conditions.push(isNull(schema.anchors.archivedAt));

    const anchors = await db
      .select()
      .from(schema.anchors)
      .where(and(...conditions))
      .orderBy(desc(schema.anchors.createdAt));

    return reply.send(anchors);
  });

  fastify.patch<{ Params: { id: string }; Body: UpdateAnchorBody }>(
    "/anchors/:id",
    async (request, reply) => {
      const user = await getSessionUser(request);
      if (!user) return reply.code(401).send({ error: "unauthenticated" });

      const anchor = await loadOwnedAnchor(request.params.id, user.id);
      if (!anchor) return reply.code(404).send({ error: "anchor_not_found" });

      const body = request.body ?? {};
      if ("label" in body && !body.label) {
        return reply.code(400).send({ error: "label is required" });
      }

      // Only fields actually present in the body are candidates for change —
      // an omitted field means "leave as-is", not "clear it". `label` is
      // NOT NULL on `anchors`, so it's tracked separately from the nullable
      // fields to keep the update payload's type honest (already guarded
      // non-empty above when present).
      const changed: { label?: string } & Partial<Record<Exclude<EditableField, "label">, string | null>> = {};
      for (const field of EDITABLE_FIELDS) {
        if (!(field in body)) continue;
        if (field === "label") {
          if (typeof body.label === "string" && body.label !== anchor.label) {
            changed.label = body.label;
          }
          continue;
        }
        const nextValue = body[field] ?? null;
        if (nextValue !== anchor[field]) {
          changed[field] = nextValue;
        }
      }

      // No field actually differs from the anchor's current values — per
      // design.md's Decisions, a no-op edit writes no revision row.
      if (Object.keys(changed).length === 0) {
        return reply.send(anchor);
      }

      const [updated] = await db.transaction(async (tx) => {
        await tx.insert(schema.anchorRevisions).values({
          anchorId: anchor.id,
          label: anchor.label,
          targetRole: anchor.targetRole,
          targetIndustry: anchor.targetIndustry,
          jobDescriptionText: anchor.jobDescriptionText,
          company: anchor.company,
        });
        return tx
          .update(schema.anchors)
          .set(changed)
          .where(eq(schema.anchors.id, anchor.id))
          .returning();
      });

      return reply.send(updated);
    },
  );

  fastify.post<{ Params: { id: string } }>("/anchors/:id/archive", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const anchor = await loadOwnedAnchor(request.params.id, user.id);
    if (!anchor) return reply.code(404).send({ error: "anchor_not_found" });

    const [updated] = await db
      .update(schema.anchors)
      .set({ archivedAt: new Date() })
      .where(eq(schema.anchors.id, anchor.id))
      .returning();

    return reply.send(updated);
  });

  fastify.post<{ Params: { id: string } }>("/anchors/:id/unarchive", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const anchor = await loadOwnedAnchor(request.params.id, user.id);
    if (!anchor) return reply.code(404).send({ error: "anchor_not_found" });

    const [updated] = await db
      .update(schema.anchors)
      .set({ archivedAt: null })
      .where(eq(schema.anchors.id, anchor.id))
      .returning();

    return reply.send(updated);
  });

  fastify.get<{ Params: { id: string } }>("/anchors/:id/revisions", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });

    const anchor = await loadOwnedAnchor(request.params.id, user.id);
    if (!anchor) return reply.code(404).send({ error: "anchor_not_found" });

    const revisions = await db
      .select()
      .from(schema.anchorRevisions)
      .where(eq(schema.anchorRevisions.anchorId, anchor.id))
      .orderBy(asc(schema.anchorRevisions.revisedAt));

    return reply.send(revisions);
  });
}
