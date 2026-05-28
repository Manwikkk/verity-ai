/**
 * AES-256-GCM encryption for API keys at rest.
 * Key comes from ENCRYPTION_KEY env variable (hex-encoded 32 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length < 32) {
    throw new Error("ENCRYPTION_KEY must be set (at least 32 hex characters)");
  }
  // Take the first 32 bytes from hex or pad
  return Buffer.from(hex.padEnd(64, "0").slice(0, 64), "hex");
}

/** Encrypt a plaintext string → base64 string (iv + ciphertext + tag). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString("base64");
}

/** Decrypt a base64 packed string → plaintext. */
export function decrypt(packed: string): string {
  const key = getKey();
  const buf = Buffer.from(packed, "base64");

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Mask an API key for safe frontend display: first 4 + dots + last 4. */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(key.length - 8, 12)) + key.slice(-4);
}
