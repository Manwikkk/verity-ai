/**
 * JWT utilities: sign and verify access tokens.
 * Uses jose for edge-compatible JWT handling.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface TokenPayload extends JWTPayload {
  sub: string;        // userId
  email: string;
  name: string;
  role: string;        // global role hint
  isGuest: boolean;
  tenants: { id: string; role: string }[];
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

/** Sign a JWT access token. */
export async function signToken(payload: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || "24h";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

/** Verify and decode a JWT token. Throws on invalid/expired. */
export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as TokenPayload;
}

/** Sign a short-lived guest token (1h). */
export async function signGuestToken(
  tenants: { id: string; role: string }[] = [],
): Promise<string> {
  const guestId = `guest_${crypto.randomUUID()}`;
  return new SignJWT({
    sub: guestId,
    email: "",
    name: "Guest",
    role: "GUEST",
    isGuest: true,
    tenants,
  } satisfies Omit<TokenPayload, "iat" | "exp">)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}
