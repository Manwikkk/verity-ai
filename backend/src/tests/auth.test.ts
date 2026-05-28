import { describe, it, expect } from "vitest";
import { encrypt, decrypt, maskApiKey } from "../utils/crypto.js";

// Set a test encryption key
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Crypto", () => {
  it("encrypts and decrypts a string", () => {
    const plaintext = "sk-ant-test-key-1234567890abcdef";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "test-api-key";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b); // Different IVs → different ciphertext
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("fails to decrypt with wrong data", () => {
    expect(() => decrypt("invalid-base64-data!!!")).toThrow();
  });
});

describe("maskApiKey", () => {
  it("masks a typical API key", () => {
    const masked = maskApiKey("sk-ant-test-key-1234567890abcdef");
    expect(masked).toMatch(/^sk-a.*cdef$/);
    expect(masked).toContain("•");
  });

  it("handles short keys", () => {
    const masked = maskApiKey("short");
    expect(masked).toBe("•••••");
  });

  it("handles exact 8-char keys", () => {
    const masked = maskApiKey("12345678");
    expect(masked).toBe("••••••••");
  });

  it("shows first 4 and last 4 for long keys", () => {
    const masked = maskApiKey("abcdefghijklmnop");
    expect(masked.startsWith("abcd")).toBe(true);
    expect(masked.endsWith("mnop")).toBe(true);
  });
});
