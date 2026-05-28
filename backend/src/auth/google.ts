/**
 * Google OAuth token verification.
 * Verifies Google ID tokens using google-auth-library.
 */
import { OAuth2Client } from "google-auth-library";
import { logger } from "../utils/logger.js";

const client = new OAuth2Client();

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Verify a Google ID token and extract user info.
 * @param idToken The Google ID token from the frontend
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID not configured");
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error("Invalid Google token payload");
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      avatarUrl: payload.picture,
    };
  } catch (err) {
    logger.error("Google token verification failed", { error: (err as Error).message });
    throw new Error("Invalid Google sign-in token");
  }
}
