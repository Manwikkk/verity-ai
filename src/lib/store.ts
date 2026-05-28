import { useShallow } from "zustand/react/shallow";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { setToken, clearToken, type AuthResult } from "./api";

// SSR-safe localStorage wrapper — returns a no-op storage on the server
// to prevent "localStorage is not defined" errors during TanStack Start SSR.
const ssrSafeStorage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
});

export interface Workspace {
  id: string;
  name: string;
  tag: string;
  env: string;
  docs: number;
}

export interface Chat {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: number;
  pinned?: boolean;
}

export type ProviderId = "groq" | "gemini" | "anthropic" | "openai";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  isDefault?: boolean;
  hasServerKey?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "groq", name: "Groq", description: "Fast inference, free tier", isDefault: true, hasServerKey: true },
  { id: "gemini", name: "Google Gemini", description: "Fast and cheap inference" },
  { id: "anthropic", name: "Anthropic", description: "Best for complex, multi-step tasks" },
  { id: "openai", name: "OpenAI", description: "Great for everyday questions and drafts" },
];

export interface UserInfo {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: string;
  isGuest: boolean;
}

interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  chats: Chat[];
  activeChatId: string | null;
  provider: ProviderId;
  sidebarCollapsed: boolean;

  // Auth
  isLoggedIn: boolean;
  user: UserInfo | null;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (id: string | null) => void;
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  deleteChat: (id: string) => void;
  setActiveChat: (id: string | null) => void;
  setProvider: (p: ProviderId) => void;
  toggleSidebar: () => void;
  pinChat: (id: string) => void;
  
  handleAuthSuccess: (result: AuthResult) => void;
  handleGuestSuccess: (result: AuthResult) => void;
  logout: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      chats: [],
      activeChatId: null,
      provider: "groq",
      sidebarCollapsed: false,

      // Auth
      isLoggedIn: false,
      user: null,

      setWorkspaces: (workspaces) => set((s) => ({
        workspaces,
        activeWorkspaceId: workspaces.some((w) => w.id === s.activeWorkspaceId)
          ? s.activeWorkspaceId
          : workspaces[0]?.id || null,
      })),
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id, activeChatId: null }),
      setChats: (chats) => set({ chats }),
      addChat: (chat) => {
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: chat.id }));
      },
      deleteChat: (id) =>
        set((s) => ({
          chats: s.chats.filter((c) => c.id !== id),
          activeChatId: s.activeChatId === id ? null : s.activeChatId,
        })),
      setActiveChat: (id) => set({ activeChatId: id }),
      setProvider: (p) => set({ provider: p }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      pinChat: (id) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c,
          ),
        })),

      handleAuthSuccess: (result) => {
        setToken(result.token);
        set({
          isLoggedIn: true,
          user: result.user,
          workspaces: result.tenants,
          activeWorkspaceId: result.tenants[0]?.id || null,
        });
      },
      handleGuestSuccess: (result) => {
        setToken(result.token);
        set({
          isLoggedIn: true,
          user: result.user,
          workspaces: result.tenants,
          activeWorkspaceId: result.tenants[0]?.id || null,
        });
      },
      logout: () => {
        clearToken();
        set({ isLoggedIn: false, user: null, workspaces: [], chats: [], activeWorkspaceId: null, activeChatId: null });
      },
    }),
    { 
      name: "verity-app-v2",
      storage: ssrSafeStorage,
      partialize: (state) => ({ 
        isLoggedIn: state.isLoggedIn, 
        user: state.user,
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
        provider: state.provider,
        sidebarCollapsed: state.sidebarCollapsed
      })
    },
  ),
);

export function useActiveWorkspace() {
  const id = useApp((s) => s.activeWorkspaceId);
  const ws = useApp((s) => s.workspaces.find((w) => w.id === id));
  return ws || null;
}

export function useWorkspaceChats() {
  return useApp(
    useShallow((s) => {
      if (!s.activeWorkspaceId) return [];
      const filtered = s.chats.filter((c) => c.workspaceId === s.activeWorkspaceId);
      // Sort: pinned first, then by creation date
      return filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
      });
    }),
  );
}
