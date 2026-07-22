import type { FastifyRequest } from "fastify";
import { auth } from "./auth.js";

function toWebHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

export async function getSessionUser(request: FastifyRequest) {
  const result = await auth.api.getSession({ headers: toWebHeaders(request) });
  return result?.user ?? null;
}
