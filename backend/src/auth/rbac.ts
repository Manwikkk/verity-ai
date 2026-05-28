/**
 * Role-Based Access Control (RBAC) definitions and helpers.
 */
import type { Role } from "@prisma/client";
import { ForbiddenError } from "../utils/errors.js";

/** Permission actions in the system. */
export type Permission =
  | "query"
  | "query:custom_provider"
  | "chat:read"
  | "chat:write"
  | "chat:delete"
  | "document:read"
  | "document:upload"
  | "document:delete"
  | "settings:read"
  | "settings:write"
  | "tenant:read"
  | "tenant:write"
  | "tenant:create"
  | "search";

/** Permission matrix per role. */
const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  SUPER_ADMIN: new Set([
    "query", "query:custom_provider",
    "chat:read", "chat:write", "chat:delete",
    "document:read", "document:upload", "document:delete",
    "settings:read", "settings:write",
    "tenant:read", "tenant:write", "tenant:create",
    "search",
  ]),
  TENANT_ADMIN: new Set([
    "query", "query:custom_provider",
    "chat:read", "chat:write", "chat:delete",
    "document:read", "document:upload", "document:delete",
    "settings:read", "settings:write",
    "tenant:read", "tenant:write",
    "search",
  ]),
  TENANT_USER: new Set([
    "query", "query:custom_provider",
    "chat:read", "chat:write", "chat:delete",
    "document:read", "document:upload",
    "settings:read", "settings:write",
    "tenant:read", "tenant:write", "tenant:create",
    "search",
  ]),
  GUEST: new Set([
    "query",
    "tenant:read",
    "search",
  ]),
};

/** Check if a role has a specific permission. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Assert a role has a permission; throw ForbiddenError if not. */
export function requirePermission(role: Role | string, permission: Permission): void {
  if (!hasPermission(role as Role, permission)) {
    throw new ForbiddenError(`Insufficient permissions: requires '${permission}'`);
  }
}
