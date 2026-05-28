/**
 * Guardrails: detect and block prompt injection, jailbreak attempts,
 * and other unsafe inputs before they reach the LLM.
 */
import { logger } from "../utils/logger.js";

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  threat?: string;
}

// Patterns that indicate prompt injection
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+(?:a|an)\s+/i,
  /new\s+instructions?\s*:/i,
  /system\s*prompt\s*:/i,
  /\[system\]/i,
  /\<\s*system\s*\>/i,
  /act\s+as\s+(?:a|an)\s+/i,
  /pretend\s+(?:you(?:'re|\s+are)\s+)/i,
  /reveal\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions)/i,
  /what\s+(?:are\s+)?your\s+(?:system\s+)?instructions/i,
  /override\s+(?:your\s+)?(?:safety|guard)/i,
  /bypass\s+(?:your\s+)?(?:safety|filter|guard)/i,
];

// Jailbreak patterns
const JAILBREAK_PATTERNS = [
  /do\s+anything\s+now/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /evil\s+mode/i,
  /unrestricted\s+mode/i,
  /no\s+restrictions/i,
  /without\s+(?:any\s+)?(?:ethical|moral|safety)\s+(?:constraints|guidelines|restrictions)/i,
  /jailbreak/i,
];

// Cross-tenant probing patterns
const TENANT_PROBE_PATTERNS = [
  /show\s+(?:me\s+)?(?:all|other)\s+tenants?/i,
  /access\s+(?:another|other|different)\s+(?:tenant|workspace|organization)/i,
  /switch\s+(?:to\s+)?(?:another|other|different)\s+(?:tenant|workspace)/i,
  /data\s+(?:from|of)\s+(?:another|other|different)\s+(?:tenant|workspace|organization)/i,
];

/**
 * Check a user query against all guardrail patterns.
 * Returns passed=true if the query is safe.
 */
export function checkGuardrails(query: string): GuardrailResult {
  // Check prompt injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      logger.warn("Prompt injection detected", { pattern: pattern.source, query: query.slice(0, 100) });
      return {
        passed: false,
        reason: "Your query appears to contain instructions that could compromise the system. Please rephrase your question.",
        threat: "prompt_injection",
      };
    }
  }

  // Check jailbreak
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(query)) {
      logger.warn("Jailbreak attempt detected", { pattern: pattern.source, query: query.slice(0, 100) });
      return {
        passed: false,
        reason: "This type of request is not supported. Please ask a question about your documents.",
        threat: "jailbreak",
      };
    }
  }

  // Check cross-tenant probing
  for (const pattern of TENANT_PROBE_PATTERNS) {
    if (pattern.test(query)) {
      logger.warn("Cross-tenant probe detected", { pattern: pattern.source, query: query.slice(0, 100) });
      return {
        passed: false,
        reason: "Cross-tenant data access is not permitted. Your queries are scoped to your current workspace.",
        threat: "cross_tenant_probe",
      };
    }
  }

  return { passed: true };
}

/**
 * Validate that all retrieved chunks belong to the expected tenant.
 * Defense-in-depth check — should never fail if retrieval is correct.
 */
export function validateTenantChunks(
  chunks: Array<{ tenantId: string }>,
  expectedTenantId: string,
): boolean {
  const violations = chunks.filter((c) => c.tenantId !== expectedTenantId);
  if (violations.length > 0) {
    logger.error("CRITICAL: Cross-tenant chunks detected in retrieval!", {
      expectedTenantId,
      violatingChunks: violations.length,
    });
    return false;
  }
  return true;
}
