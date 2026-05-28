/**
 * Tenant service: CRUD for tenants and membership queries.
 */
import { prisma } from "../utils/prisma.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";

export interface TenantDTO {
  id: string;
  name: string;
  tag: string;
  env: string;
  docs: number;
}

/** Get all tenants the user belongs to (from JWT tenants list). */
export async function getUserTenants(tenantIds: string[]): Promise<TenantDTO[]> {
  if (tenantIds.length === 0) {
    // For guests, return all tenants (read-only)
    const tenants = await prisma.tenant.findMany({
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: "asc" },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      env: t.env,
      docs: t._count.documents,
    }));
  }

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "asc" },
  });

  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    tag: t.tag,
    env: t.env,
    docs: t._count.documents,
  }));
}

/** Get all tenants a user currently belongs to from the database. */
export async function getUserTenantsByUserId(userId: string): Promise<TenantDTO[]> {
  const memberships = await prisma.tenantMembership.findMany({
    where: { userId },
    include: { tenant: { include: { _count: { select: { documents: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    tag: m.tenant.tag,
    env: m.tenant.env,
    docs: m.tenant._count.documents,
  }));
}

/** Get a single tenant by ID. */
export async function getTenant(tenantId: string): Promise<TenantDTO> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { documents: true } } },
  });
  if (!t) throw new NotFoundError("Tenant");

  return {
    id: t.id,
    name: t.name,
    tag: t.tag,
    env: t.env,
    docs: t._count.documents,
  };
}

/** Create a new tenant. */
export async function createTenant(
  name: string,
  tag: string,
  env: string = "prod",
  creatorUserId?: string,
): Promise<TenantDTO> {
  const tenant = await prisma.tenant.create({
    data: { name, tag: tag.toUpperCase().slice(0, 8), env },
  });

  // If a creator user is provided, make them TENANT_ADMIN
  if (creatorUserId) {
    await prisma.tenantMembership.create({
      data: { userId: creatorUserId, tenantId: tenant.id, role: "TENANT_ADMIN" },
    });
  }

  // Seed default provider configs
  await prisma.providerConfig.createMany({
    data: [
      { tenantId: tenant.id, providerId: "groq", displayName: "Groq", model: "llama-3.3-70b-versatile", isDefault: true, hasServerKey: true, status: "connected" },
      { tenantId: tenant.id, providerId: "gemini", displayName: "Google Gemini", model: "gemini-2.5-pro", status: "disconnected" },
      { tenantId: tenant.id, providerId: "anthropic", displayName: "Anthropic", model: "claude-sonnet-4-20250514", status: "disconnected" },
      { tenantId: tenant.id, providerId: "openai", displayName: "OpenAI", model: "gpt-4.1", status: "disconnected" },
    ],
  });

  return { id: tenant.id, name: tenant.name, tag: tenant.tag, env: tenant.env, docs: 0 };
}

/** Delete a tenant if the user owns/admins it. */
export async function deleteTenant(tenantId: string, userId: string): Promise<void> {
  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { role: true },
  });

  if (!membership) throw new NotFoundError("Workspace");
  if (membership.role !== "TENANT_ADMIN" && membership.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Only workspace admins can delete a workspace");
  }

  const count = await prisma.tenantMembership.count({ where: { userId } });
  if (count <= 1) {
    throw new ValidationError("Create or join another workspace before deleting your last one");
  }

  await prisma.tenant.delete({ where: { id: tenantId } });
}
