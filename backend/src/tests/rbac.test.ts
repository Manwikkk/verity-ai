import { describe, it, expect } from "vitest";
import { hasPermission } from "../auth/rbac.js";

describe("RBAC", () => {
  describe("GUEST role", () => {
    it("can query", () => expect(hasPermission("GUEST", "query")).toBe(true));
    it("cannot use custom providers", () => expect(hasPermission("GUEST", "query:custom_provider")).toBe(false));
    it("cannot read chats", () => expect(hasPermission("GUEST", "chat:read")).toBe(false));
    it("cannot write chats", () => expect(hasPermission("GUEST", "chat:write")).toBe(false));
    it("cannot upload docs", () => expect(hasPermission("GUEST", "document:upload")).toBe(false));
    it("cannot manage settings", () => expect(hasPermission("GUEST", "settings:write")).toBe(false));
    it("can search", () => expect(hasPermission("GUEST", "search")).toBe(true));
    it("can read tenants", () => expect(hasPermission("GUEST", "tenant:read")).toBe(true));
    it("cannot create tenants", () => expect(hasPermission("GUEST", "tenant:create")).toBe(false));
  });

  describe("TENANT_USER role", () => {
    it("can query", () => expect(hasPermission("TENANT_USER", "query")).toBe(true));
    it("can use custom providers", () => expect(hasPermission("TENANT_USER", "query:custom_provider")).toBe(true));
    it("can read chats", () => expect(hasPermission("TENANT_USER", "chat:read")).toBe(true));
    it("can write chats", () => expect(hasPermission("TENANT_USER", "chat:write")).toBe(true));
    it("can upload docs", () => expect(hasPermission("TENANT_USER", "document:upload")).toBe(true));
    it("cannot delete docs", () => expect(hasPermission("TENANT_USER", "document:delete")).toBe(false));
    it("can read settings", () => expect(hasPermission("TENANT_USER", "settings:read")).toBe(true));
    it("can write settings", () => expect(hasPermission("TENANT_USER", "settings:write")).toBe(true));
    it("can create tenants", () => expect(hasPermission("TENANT_USER", "tenant:create")).toBe(true));
  });

  describe("TENANT_ADMIN role", () => {
    it("can query", () => expect(hasPermission("TENANT_ADMIN", "query")).toBe(true));
    it("can delete docs", () => expect(hasPermission("TENANT_ADMIN", "document:delete")).toBe(true));
    it("can write settings", () => expect(hasPermission("TENANT_ADMIN", "settings:write")).toBe(true));
    it("can write tenants", () => expect(hasPermission("TENANT_ADMIN", "tenant:write")).toBe(true));
    it("cannot create tenants", () => expect(hasPermission("TENANT_ADMIN", "tenant:create")).toBe(false));
  });

  describe("SUPER_ADMIN role", () => {
    it("can do everything", () => {
      const permissions = [
        "query", "query:custom_provider", "chat:read", "chat:write", "chat:delete",
        "document:read", "document:upload", "document:delete",
        "settings:read", "settings:write", "tenant:read", "tenant:write", "tenant:create", "search",
      ] as const;
      for (const perm of permissions) {
        expect(hasPermission("SUPER_ADMIN", perm)).toBe(true);
      }
    });
  });
});
