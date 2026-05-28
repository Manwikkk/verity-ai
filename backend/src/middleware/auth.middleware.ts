/**
 * Auth middleware: extracts and verifies JWT from Authorization header.
 * Attaches user info to request for downstream handlers.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type TokenPayload } from "../auth/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// Extend Fastify request to carry auth context
declare module "fastify" {
  interface FastifyRequest {
    auth: TokenPayload;
  }
}

/** Require a valid JWT. Guests are allowed. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = header.slice(7);
  try {
    request.auth = await verifyToken(token);
  } catch (err) {
    logger.warn("JWT verification failed", { error: (err as Error).message });
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/** Require a non-guest authenticated user. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (request.auth.isGuest) {
    throw new UnauthorizedError("This action requires a signed-in account");
  }
}
