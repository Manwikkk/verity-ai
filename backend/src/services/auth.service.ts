/**
 * Auth service: handles user registration, login, Google auth, and guest sessions.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { signToken, signGuestToken, type TokenPayload } from "../auth/jwt.js";
import { verifyGoogleToken } from "../auth/google.js";
import { logAudit } from "./audit.service.js";
import { UnauthorizedError, ConflictError, NotFoundError } from "../utils/errors.js";

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    initials: string;
    role: string;
    isGuest: boolean;
  };
  tenants: Array<{
    id: string;
    name: string;
    tag: string;
    env: string;
    docs: number;
    role: string;
  }>;
}

function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

function buildWorkspaceName(name: string): string {
  const firstName = name.trim().split(/\s+/)[0] || "My";
  return `${firstName}'s Workspace`;
}

function buildWorkspaceTag(name: string): string {
  const compact = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (compact.slice(0, 2) || "VW").padEnd(2, "W");
}

async function ensureUserHasWorkspace(userId: string, name: string): Promise<void> {
  const membershipCount = await prisma.tenantMembership.count({
    where: { userId },
  });

  if (membershipCount > 0) {
    return;
  }

  await prisma.tenant.create({
    data: {
      name: buildWorkspaceName(name),
      tag: buildWorkspaceTag(name),
      env: "prod",
      memberships: {
        create: {
          userId,
          role: "TENANT_ADMIN",
        },
      },
      providerConfigs: {
        createMany: {
          data: [
            {
              providerId: "groq",
              displayName: "Groq",
              model: "llama-3.3-70b-versatile",
              isDefault: true,
              hasServerKey: true,
              status: "connected",
            },
            {
              providerId: "gemini",
              displayName: "Google Gemini",
              model: "gemini-2.5-pro",
              isDefault: false,
              hasServerKey: false,
              status: "disconnected",
            },
            {
              providerId: "anthropic",
              displayName: "Anthropic",
              model: "claude-sonnet-4-20250514",
              isDefault: false,
              hasServerKey: false,
              status: "disconnected",
            },
            {
              providerId: "openai",
              displayName: "OpenAI",
              model: "gpt-4.1",
              isDefault: false,
              hasServerKey: false,
              status: "disconnected",
            },
          ],
        },
      },
    },
  });
}

/** Register a new user with email/password. */
export async function registerUser(
  email: string,
  password: string,
  name: string,
  ip?: string,
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  await ensureUserHasWorkspace(user.id, user.name);

  await logAudit("register", { userId: user.id, ip });

  return buildAuthResult(user.id);
}

/** Login with email/password. */
export async function loginUser(email: string, password: string, ip?: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new NotFoundError("Account");
  }

  if (!user.passwordHash) {
    throw new UnauthorizedError("This account uses Google sign-in. Continue with Google instead.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Incorrect password");

  await logAudit("login", { userId: user.id, ip });

  return buildAuthResult(user.id);
}

/** Login/register via Google OAuth. */
export async function googleAuth(idToken: string, ip?: string): Promise<AuthResult> {
  const googleUser = await verifyGoogleToken(idToken);

  let user = await prisma.user.findUnique({ where: { googleId: googleUser.googleId } });

  if (!user) {
    // Check if email already exists (link accounts)
    user = await prisma.user.findUnique({ where: { email: googleUser.email } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleId: googleUser.googleId, avatarUrl: googleUser.avatarUrl },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.avatarUrl,
        },
      });

      await ensureUserHasWorkspace(user.id, user.name);
    }
  }

  await ensureUserHasWorkspace(user.id, user.name);

  await logAudit("login_google", { userId: user.id, ip });

  return buildAuthResult(user.id);
}

/** Create a guest session — ephemeral, no persistence. */
export async function createGuestSession(ip?: string): Promise<AuthResult> {
  const tenants = await prisma.tenant.findMany({
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "asc" },
  });
  const guestTenants = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    tag: tenant.tag,
    env: tenant.env,
    docs: tenant._count.documents,
    role: "GUEST",
  }));

  const token = await signGuestToken(guestTenants.map((tenant) => ({
    id: tenant.id,
    role: tenant.role,
  })));
  await logAudit("guest_session", { ip });
  return {
    token,
    user: {
      id: "guest",
      email: "",
      name: "Guest",
      initials: "GU",
      role: "GUEST",
      isGuest: true,
    },
    tenants: guestTenants,
  };
}

/** Build the full auth result with tenants for a given user ID. */
async function buildAuthResult(userId: string): Promise<AuthResult> {
  let user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          tenant: {
            include: { _count: { select: { documents: true } } },
          },
        },
      },
    },
  });

  if (user.memberships.length === 0) {
    await ensureUserHasWorkspace(user.id, user.name);
    user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            tenant: {
              include: { _count: { select: { documents: true } } },
            },
          },
        },
      },
    });
  }

  const tenants = user.memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    tag: m.tenant.tag,
    env: m.tenant.env,
    docs: m.tenant._count.documents,
    role: m.role,
  }));

  // Determine the highest role across tenants
  const roleOrder = ["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_USER", "GUEST"] as const;
  const highestRole = tenants.reduce((best, t) => {
    const current = roleOrder.indexOf(t.role as any);
    const prev = roleOrder.indexOf(best as any);
    return current < prev ? t.role : best;
  }, "TENANT_USER" as string);

  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: highestRole,
    isGuest: false,
    tenants: tenants.map((t) => ({ id: t.id, role: t.role })),
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      initials: getInitials(user.name),
      role: highestRole,
      isGuest: false,
    },
    tenants,
  };
}
