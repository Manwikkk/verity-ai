/**
 * Audit logging service: records security-relevant events.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma.js";
import { logger } from "../utils/logger.js";

export type AuditAction =
  | "login"
  | "login_google"
  | "guest_session"
  | "logout"
  | "register"
  | "document_upload"
  | "document_delete"
  | "query"
  | "query_incognito"
  | "prompt_injection_blocked"
  | "jailbreak_blocked"
  | "cross_tenant_denied"
  | "low_confidence_fallback"
  | "provider_change"
  | "api_key_update"
  | "chat_delete"
  | "chat_create";

export async function logAudit(
  action: AuditAction,
  opts: {
    tenantId?: string;
    userId?: string;
    details?: Record<string, unknown>;
    ip?: string;
  } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        tenantId: opts.tenantId ?? null,
        userId: opts.userId ?? null,
        details: opts.details ? (opts.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ip: opts.ip ?? null,
      },
    });
  } catch (err) {
    // Audit logging should never crash the request
    logger.error("Failed to write audit log", {
      action,
      error: (err as Error).message,
    });
  }
}
