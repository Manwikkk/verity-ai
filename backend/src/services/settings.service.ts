/**
 * Settings service: provider config management with encrypted API keys.
 */
import { prisma } from "../utils/prisma.js";
import { encrypt, decrypt, maskApiKey } from "../utils/crypto.js";
import { NotFoundError } from "../utils/errors.js";
import { logAudit } from "./audit.service.js";
import { cached, invalidate } from "../utils/redis.js";

export interface ProviderDTO {
  id: string;
  providerId: string;
  name: string;
  model: string;
  status: string;
  isDefault: boolean;
  hasServerKey: boolean;
  hasKey: boolean;
  keyMask: string;
  latency: string;
}

/** List provider configs for a tenant. */
export async function listProviders(tenantId: string): Promise<ProviderDTO[]> {
  return cached(`providers:${tenantId}`, 600, async () => {
    const configs = await prisma.providerConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });

    return configs.map((c) => ({
      id: c.providerId,
      providerId: c.providerId,
      name: c.displayName,
      model: c.model,
      status: c.hasServerKey || c.apiKeyEncrypted ? "connected" : c.status,
      isDefault: c.isDefault,
      hasServerKey: c.hasServerKey,
      hasKey: c.hasServerKey || Boolean(c.apiKeyEncrypted),
      keyMask: c.hasServerKey ? "Server default" : c.apiKeyMask || "—",
      latency: c.hasServerKey || c.apiKeyEncrypted ? "~200ms" : "—",
    }));
  });
}

/** Update a provider: set API key, model, or default status. */
export async function updateProvider(
  tenantId: string,
  providerId: string,
  data: { apiKey?: string; model?: string; isDefault?: boolean },
  userId?: string,
): Promise<ProviderDTO> {
  const config = await prisma.providerConfig.findUnique({
    where: { tenantId_providerId: { tenantId, providerId } },
  });
  if (!config) throw new NotFoundError("Provider");

  const updateData: any = {};

  if (data.apiKey !== undefined) {
    updateData.apiKeyEncrypted = encrypt(data.apiKey);
    updateData.apiKeyMask = maskApiKey(data.apiKey);
    updateData.status = "connected";
  }

  if (data.model) {
    updateData.model = data.model;
  }

  if (data.isDefault === true) {
    // Unset other defaults first
    await prisma.providerConfig.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
    updateData.isDefault = true;
  }

  const updated = await prisma.providerConfig.update({
    where: { tenantId_providerId: { tenantId, providerId } },
    data: updateData,
  });

  await invalidate(`providers:${tenantId}`);

  await logAudit("api_key_update", {
    tenantId,
    userId,
    details: { providerId, hasNewKey: !!data.apiKey },
  });

  return {
    id: updated.providerId,
    providerId: updated.providerId,
    name: updated.displayName,
    model: updated.model,
    status: updated.hasServerKey || updated.apiKeyEncrypted ? "connected" : updated.status,
    isDefault: updated.isDefault,
    hasServerKey: updated.hasServerKey,
    hasKey: updated.hasServerKey || Boolean(updated.apiKeyEncrypted),
    keyMask: updated.hasServerKey ? "Server default" : updated.apiKeyMask || "—",
    latency: updated.hasServerKey || updated.apiKeyEncrypted ? "~200ms" : "—",
  };
}

/** Remove a provider's API key. */
export async function removeProviderKey(
  tenantId: string,
  providerId: string,
  userId?: string,
): Promise<void> {
  const config = await prisma.providerConfig.findUnique({
    where: { tenantId_providerId: { tenantId, providerId } },
  });
  if (!config) throw new NotFoundError("Provider");
  if (config.hasServerKey) return; // Can't remove server keys

  await prisma.providerConfig.update({
    where: { tenantId_providerId: { tenantId, providerId } },
    data: { apiKeyEncrypted: null, apiKeyMask: null, status: "disconnected" },
  });

  await invalidate(`providers:${tenantId}`);
  await logAudit("api_key_update", { tenantId, userId, details: { providerId, removed: true } });
}
