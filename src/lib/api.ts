/**
 * Centralized API client for the Verity backend.
 * Handles JWT injection, error parsing, and SSE streaming.
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/** Get the stored auth token. */
function getToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("verity-auth-token");
    return raw;
  } catch {
    return null;
  }
}

/** Set the auth token. */
export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("verity-auth-token", token);
}

/** Clear the auth token. */
export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("verity-auth-token");
}

/** Build headers with optional auth token. */
function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

/** Standard fetch wrapper with error handling. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasJsonBody = body !== undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(hasJsonBody ? { "Content-Type": "application/json" } : undefined),
    body: hasJsonBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──

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

export const auth = {
  login: (email: string, password: string) =>
    request<AuthResult>("POST", "/auth/login", { email, password }),

  register: (email: string, password: string, name: string) =>
    request<AuthResult>("POST", "/auth/register", { email, password, name }),

  google: (idToken: string) => request<AuthResult>("POST", "/auth/google", { idToken }),

  guest: () => request<AuthResult>("POST", "/auth/guest"),
};

// ── Tenants ──

export const tenants = {
  list: () => request<{ tenants: any[] }>("GET", "/tenants"),
  get: (id: string) => request<any>("GET", `/tenant/${id}`),
  create: (data: { name: string; tag: string; env?: string }) =>
    request<any>("POST", "/tenant", data),
  delete: (id: string) => request<void>("DELETE", `/tenant/${id}`),
};

// ── Documents ──

export const documents = {
  list: (tenantId: string) => request<{ documents: any[] }>("GET", `/tenant/${tenantId}/documents`),

  upload: async (tenantId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/tenant/${tenantId}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || err.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  getStatus: (tenantId: string, docId: string) =>
    request<any>("GET", `/tenant/${tenantId}/documents/${docId}/status`),

  download: async (tenantId: string, docId: string) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/tenant/${tenantId}/documents/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Download failed" }));
      throw new Error(err.error || err.message || `Download failed: ${res.status}`);
    }
    return res.blob();
  },

  delete: (tenantId: string, docId: string) =>
    request<void>("DELETE", `/tenant/${tenantId}/documents/${docId}`),
};

// ── Chats ──

export const chats = {
  list: (tenantId: string) => request<{ chats: any[] }>("GET", `/tenant/${tenantId}/chats`),

  create: (tenantId: string, title: string) =>
    request<any>("POST", `/tenant/${tenantId}/chats`, { title }),

  get: (tenantId: string, chatId: string) =>
    request<any>("GET", `/tenant/${tenantId}/chats/${chatId}`),

  update: (tenantId: string, chatId: string, data: { title?: string; pinned?: boolean }) =>
    request<any>("PATCH", `/tenant/${tenantId}/chats/${chatId}`, data),

  delete: (tenantId: string, chatId: string) =>
    request<void>("DELETE", `/tenant/${tenantId}/chats/${chatId}`),
};

// ── Query (SSE Streaming) ──

export interface StreamEvent {
  type: "token" | "sources" | "done" | "error";
  data: any;
}

export function streamQuery(
  tenantId: string,
  query: string,
  onEvent: (event: StreamEvent) => void,
  options?: { chatId?: string; providerId?: string; isIncognito?: boolean },
): AbortController {
  const controller = new AbortController();
  const path = options?.isIncognito
    ? `/tenant/${tenantId}/query/incognito`
    : `/tenant/${tenantId}/query`;

  const token = getToken();

  fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query,
      chatId: options?.chatId,
      providerId: options?.providerId,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Query failed" }));
        onEvent({ type: "error", data: err });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent({ type: eventType as any, data });
            } catch {
              /* skip malformed */
            }
            eventType = "";
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onEvent({ type: "error", data: { message: err.message } });
      }
    });

  return controller;
}

// ── Search ──

export const search = {
  query: (tenantId: string, q: string) =>
    request<{ results: any[] }>("GET", `/tenant/${tenantId}/search?q=${encodeURIComponent(q)}`),
};

// ── Settings ──

export const settings = {
  listProviders: (tenantId: string) =>
    request<{ providers: any[] }>("GET", `/tenant/${tenantId}/settings/providers`),

  updateProvider: (
    tenantId: string,
    providerId: string,
    data: { apiKey?: string; model?: string; isDefault?: boolean },
  ) => request<any>("PUT", `/tenant/${tenantId}/settings/providers/${providerId}`, data),

  removeProvider: (tenantId: string, providerId: string) =>
    request<void>("DELETE", `/tenant/${tenantId}/settings/providers/${providerId}`),
};

// ── Health ──

export const health = {
  check: () => request<{ status: string; checks: Record<string, string> }>("GET", "/health"),
};
