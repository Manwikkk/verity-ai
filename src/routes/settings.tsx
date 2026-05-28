import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell, Topbar } from "@/components/app-shell";
import { Check, KeyRound, Settings2, User, Database, LogIn, Save, Trash2, Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { settings as settingsApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Verity" }] }),
  component: SettingsPage,
});

const tabs = [
  { id: "providers", label: "API Keys", icon: KeyRound },
  { id: "preferences", label: "Preferences", icon: Settings2 },
  { id: "data", label: "Data", icon: Database },
  { id: "account", label: "Account", icon: User },
];

function SettingsPage() {
  const [tab, setTab] = useState("providers");
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const isGuest = useApp((s) => s.user?.isGuest ?? false);

  return (
    <AppShell>
      <Topbar eyebrow="Workspace" title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <div className="flex gap-8">
            <nav className="w-48 shrink-0">
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 px-2.5">
                Settings
              </div>
              <ul className="space-y-px">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setTab(t.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] transition-all duration-200",
                          active
                            ? "bg-surface-raised text-foreground hairline"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {t.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex-1 min-w-0">
              {tab === "providers" && <ProvidersTab isLoggedIn={isLoggedIn && !isGuest} />}
              {tab === "preferences" && <PreferencesTab />}
              {tab === "data" && <DataTab />}
              {tab === "account" && <AccountTab />}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5 pb-4 hairline-b">
      <div>
        <h2 className="text-[18px] font-semibold text-foreground tracking-tight">{title}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>
      </div>
      {action}
    </div>
  );
}

function ProvidersTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ws = useApp((s) => s.workspaces.find(w => w.id === s.activeWorkspaceId));
  
  const fetchProviders = async () => {
    if (!isLoggedIn || !ws?.id) return;
    try {
      setLoading(true);
      const res = await settingsApi.listProviders(ws.id);
      setProviders(res.providers);
    } catch {
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [isLoggedIn, ws?.id]);

  if (!isLoggedIn) {
    return (
      <div>
        <SectionHeader
          title="LLM Providers"
          sub="Sign in to manage your model providers and API keys."
        />
        <div className="rounded-xl hairline bg-surface p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-xl bg-surface-raised hairline grid place-items-center">
            <KeyRound className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-foreground">Authentication required</div>
            <p className="mt-1 text-[13px] text-muted-foreground max-w-sm">
              You need to be signed in to add, edit, or manage API keys. Guest mode does not support custom keys.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="mt-2 h-9 px-5 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-all duration-200"
          >
            <LogIn className="h-4 w-4" strokeWidth={1.75} />
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="API Keys" sub="Manage model keys inside Verity. Groq uses the built-in server key unless you replace it." />

      <div className="space-y-2.5">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onUpdate={fetchProviders} ws={ws} />
          ))
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider, onUpdate, ws }: { provider: any, onUpdate: () => void, ws: any }) {
  const connected = provider.hasKey;
  const setProvider = useApp((s) => s.setProvider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(provider.model ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setModel(provider.model ?? "");
  }, [provider.model]);
  
  const handleSave = async () => {
    if (!ws?.id) return;
    if (!provider.hasServerKey && !apiKey.trim() && !connected) {
      toast.error("Enter an API key first");
      return;
    }
    
    try {
      await settingsApi.updateProvider(ws.id, provider.providerId, {
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        model: model.trim() || provider.model,
        isDefault: provider.isDefault,
      });
      toast.success(`${provider.name} settings saved`);
      setApiKey("");
      setEditing(false);
      onUpdate();
    } catch {
      toast.error("Failed to save provider");
    }
  };

  const handleSetDefault = async () => {
    if (!ws?.id) return;
    try {
      await settingsApi.updateProvider(ws.id, provider.providerId, { isDefault: true });
      setProvider(provider.providerId);
      toast.success(`${provider.name} set as default`);
      onUpdate();
    } catch {
      toast.error("Failed to set default");
    }
  };

  const handleRemove = async () => {
    if (!ws?.id) return;
    try {
      await settingsApi.removeProvider(ws.id, provider.providerId);
      toast.success(`${provider.name} key removed`);
      onUpdate();
    } catch {
      toast.error("Failed to remove key");
    }
  };

  return (
    <div className="rounded-lg hairline surface p-4 transition-all duration-200 hover:bg-surface-raised/50">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-md hairline bg-surface-raised grid place-items-center mono text-[13px] font-semibold text-foreground">
          {provider.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-foreground">{provider.name}</span>
            {provider.isDefault && (
              <span className="mono text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                Default
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-wider ml-1",
                connected ? "text-success" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connected ? "bg-success" : "bg-muted-foreground/50",
                )}
              />
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 mono text-[11px] text-muted-foreground">
            <span>Model: {provider.model}</span>
            <span className="opacity-50">·</span>
            <span>Key: {connected ? provider.keyMask || "••••" : "—"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {connected && !provider.isDefault && (
            <button onClick={handleSetDefault} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md hairline bg-background text-[11.5px] text-foreground hover:bg-accent transition-all duration-200">
              <Check className="h-3 w-3" strokeWidth={2} />
              Set default
            </button>
          )}
          <button onClick={() => setEditing((v) => !v)} className="h-7 px-2.5 inline-flex items-center rounded-md hairline bg-background text-[11.5px] text-foreground hover:bg-accent transition-all duration-200">
            {editing ? "Close" : connected ? "Edit" : "Add key"}
          </button>
          {connected && !provider.hasServerKey && (
            <button onClick={handleRemove} className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-[11.5px] text-muted-foreground hover:text-destructive transition-all duration-200">
              <Trash2 className="h-3 w-3" strokeWidth={1.75} />
              Remove
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-1.5">
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">API key</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder={provider.hasServerKey ? "Leave blank to use server default" : "Paste provider API key"}
              className="h-9 w-full rounded-md hairline bg-background px-3 text-[13px] text-foreground outline-none focus:border-border-strong"
            />
          </label>
          <label className="space-y-1.5">
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Model ID</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md hairline bg-background px-3 text-[13px] text-foreground outline-none focus:border-border-strong"
            />
          </label>
          <button onClick={handleSave} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground hover:opacity-90">
            <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function PreferencesTab() {
  return (
    <div>
      <SectionHeader title="Preferences" sub="Simple defaults for a clearer workspace experience." />
      <div className="space-y-3">
        <Row label="Answer style" value="Clear and cited" desc="Verity starts direct, explains evidence, and cites sources." />
        <Row label="Search depth" value="Balanced" desc="Uses enough document chunks for accuracy without making answers noisy." />
        <Row label="Upload progress" value="Shown in chat" desc="New PDFs show parsing, chunking, embedding, and ready states in the conversation." />
      </div>
    </div>
  );
}

function DataTab() {
  return (
    <div>
      <SectionHeader title="Data" sub="Workspace data stays separated by workspace." />
      <div className="space-y-3">
        <Row label="Chats" value="Per workspace" desc="Switching workspaces switches the chat list and history." />
        <Row label="Documents" value="Per workspace" desc="Uploads and vector chunks are scoped to the active workspace." />
        <Row label="Provider keys" value="Encrypted" desc="Custom provider keys are stored encrypted on the backend." />
      </div>
    </div>
  );
}

function AccountTab() {
  const navigate = useNavigate();
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const user = useApp((s) => s.user);
  const workspaces = useApp((s) => s.workspaces);
  const activeWorkspaceId = useApp((s) => s.activeWorkspaceId);

  if (!isLoggedIn) {
    return (
      <div>
        <SectionHeader title="Account" sub="Sign in to view your profile and workspace membership." />
        <div className="rounded-xl hairline bg-surface p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-xl bg-surface-raised hairline grid place-items-center">
            <User className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-foreground">Not signed in</div>
            <p className="mt-1 text-[13px] text-muted-foreground max-w-sm">
              Sign in to access your account settings and manage your profile.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="mt-2 h-9 px-5 inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-all duration-200"
          >
            <LogIn className="h-4 w-4" strokeWidth={1.75} />
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Account" sub="Your profile and workspace membership." />
      <div className="rounded-lg hairline surface p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 grid place-items-center mono text-[14px] font-semibold text-foreground">
          {user?.initials ?? "?"}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-medium text-foreground">{user?.name ?? "Unknown"}</div>
          <div className="mono text-[11px] text-muted-foreground mt-0.5">
            {user?.email ?? ""} · Workspace {user?.role ?? ""}
          </div>
        </div>
        <ShieldCheck className="h-5 w-5 text-success" strokeWidth={1.75} />
      </div>
      <div className="mt-4 rounded-lg hairline surface p-4">
        <div className="mb-3 flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          Workspaces
        </div>
        <div className="space-y-2">
          {workspaces.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-md hairline bg-background px-3 py-2">
              <div>
                <div className="text-[13px] text-foreground">{w.name}</div>
                <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {w.docs} docs · {w.env}
                </div>
              </div>
              {w.id === activeWorkspaceId && (
                <span className="mono text-[10px] uppercase tracking-wider text-primary">Active</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <div className="rounded-lg hairline surface px-4 py-3.5 flex items-center justify-between gap-6 transition-all duration-200 hover:bg-surface-raised/50">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-foreground">{label}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{desc}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="mono text-[12px] text-foreground/90">{value}</span>
      </div>
    </div>
  );
}
