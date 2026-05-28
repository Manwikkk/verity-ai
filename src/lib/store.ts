import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";

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
  name: string;
  initials: string;
  email: string;
  role: string;
}

interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  chats: Chat[];
  activeChatId: string | null;
  provider: ProviderId;
  sidebarCollapsed: boolean;
  apiKeys: Record<string, string>;

  // Auth
  isLoggedIn: boolean;
  user: UserInfo | null;

  setActiveWorkspace: (id: string) => void;
  addChat: (title: string) => string;
  deleteChat: (id: string) => void;
  setActiveChat: (id: string | null) => void;
  setProvider: (p: ProviderId) => void;
  toggleSidebar: () => void;
  setApiKey: (id: string, key: string) => void;
  pinChat: (id: string) => void;
  login: (user: UserInfo) => void;
  logout: () => void;
}

const seedWorkspaces: Workspace[] = [
  { id: "northwind", name: "Northwind Legal", tag: "N", env: "prod", docs: 1284 },
  { id: "atlas", name: "Atlas Manufacturing", tag: "A", env: "prod", docs: 642 },
  { id: "verity-internal", name: "Verity Internal", tag: "V", env: "dev", docs: 89 },
];

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      workspaces: seedWorkspaces,
      activeWorkspaceId: "northwind",
      chats: [],
      activeChatId: null,
      provider: "groq",
      sidebarCollapsed: false,
      apiKeys: {},

      // Auth
      isLoggedIn: false,
      user: null,

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id, activeChatId: null }),
      addChat: (title) => {
        const id = crypto.randomUUID();
        const chat: Chat = {
          id,
          workspaceId: get().activeWorkspaceId,
          title: title.slice(0, 60),
          createdAt: Date.now(),
          pinned: false,
        };
        // Only persist chats if logged in
        if (get().isLoggedIn) {
          set((s) => ({ chats: [chat, ...s.chats], activeChatId: id }));
        } else {
          set({ activeChatId: id });
        }
        return id;
      },
      deleteChat: (id) =>
        set((s) => ({
          chats: s.chats.filter((c) => c.id !== id),
          activeChatId: s.activeChatId === id ? null : s.activeChatId,
        })),
      setActiveChat: (id) => set({ activeChatId: id }),
      setProvider: (p) => set({ provider: p }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setApiKey: (id, key) => set((s) => ({ apiKeys: { ...s.apiKeys, [id]: key } })),
      pinChat: (id) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c,
          ),
        })),
      login: (user) => set({ isLoggedIn: true, user }),
      logout: () => set({ isLoggedIn: false, user: null }),
    }),
    { name: "verity-app" },
  ),
);

export function useActiveWorkspace() {
  const id = useApp((s) => s.activeWorkspaceId);
  const ws = useApp((s) => s.workspaces.find((w) => w.id === id)!);
  return ws;
}

export function useWorkspaceChats() {
  return useApp(
    useShallow((s) => {
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

export function providerHasKey(p: ProviderId): boolean {
  const info = PROVIDERS.find((x) => x.id === p);
  if (info?.hasServerKey) return true;
  return Boolean(useApp.getState().apiKeys[p]);
}
