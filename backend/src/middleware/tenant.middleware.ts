/**
 * Tenant middleware: validates that the authenticated user
 * has access to the requested tenant. Prevents cross-tenant access.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { TenantMismatchError, ForbiddenError, NotFoundError } from "../utils/errors.js";
import { requirePermission, type Permission } from "../auth/rbac.js";
import type { Role } from "@prisma/client";
import { prisma } from "../utils/prisma.js";

// Extend request to carry resolved tenant context
declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
    tenantRole: Role;
  }
}

/**
 * Validates that the user belongs to the tenant specified in the route.
 * Resolves the user's role within that tenant for RBAC checks.
 */
export async function requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const params = request.params as Record<string, string>;
  const tenantId = params.tenantId;

  if (!tenantId) {
    throw new ForbiddenError("Tenant ID is required");
  }

  const { auth } = request;

  if (auth.isGuest) {
    const membership = auth.tenants.find((t) => t.id === tenantId);
    if (!membership) {
      throw new TenantMismatchError();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundError("Tenant");
    }

    request.tenantId = tenantId;
    request.tenantRole = "GUEST" as Role;
    return;
  }

  const tokenMembership = auth.tenants.find((t) => t.id === tenantId);
  const dbMembership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: auth.sub, tenantId } },
    select: { role: true, tenant: { select: { id: true } } },
  });

  const role = dbMembership?.role ?? tokenMembership?.role;
  if (!role) {
    throw new TenantMismatchError();
  }

  if (!dbMembership?.tenant) {
    throw new NotFoundError("Tenant");
  }

  request.tenantId = tenantId;
  request.tenantRole = role as Role;
}

/**
 * Factory: creates a preHandler that enforces both tenant membership
 * AND a specific RBAC permission within that tenant.
 */
export function requireTenantPermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireTenant(request, reply);
    requirePermission(request.tenantRole, permission);
  };
}
