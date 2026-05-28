import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Topbar } from "@/components/app-shell";
import { Check, KeyRound, Plus, Settings2, User, Database, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp, type UserInfo } from "@/lib/store";
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

const providers = [
  {
    name: "Anthropic",
    model: "claude-sonnet-4.5",
    status: "connected",
    isDefault: true,
    keyMask: "sk-ant-•••••••••••••a91x",
    latency: "284ms",
  },
  {
    name: "OpenAI",
    model: "gpt-4.1",
    status: "connected",
    isDefault: false,
    keyMask: "sk-•••••••••••••f3e2",
    latency: "412ms",
  },
  {
    name: "Google",
    model: "gemini-2.5-pro",
    status: "connected",
    isDefault: false,
    keyMask: "AIza•••••••••••mZ8K",
    latency: "501ms",
  },
  {
    name: "Groq",
    model: "llama-3.3-70b",
    status: "disconnected",
    isDefault: false,
    keyMask: "—",
    latency: "—",
  },
];

function SettingsPage() {
  const [tab, setTab] = useState("providers");
  const isLoggedIn = useApp((s) => s.isLoggedIn);

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
              {tab === "providers" && <ProvidersTab isLoggedIn={isLoggedIn} />}
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
  const login = useApp((s) => s.login);

  const handleLogin = () => {
    const demoUser: UserInfo = {
      name: "Elena Marsh",
      initials: "EM",
      email: "elena.marsh@northwind.legal",
      role: "Admin",
    };
    login(demoUser);
    toast.success("Signed in successfully", { description: `Welcome back, ${demoUser.name}` });
  };

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
              You need to be signed in to add, edit, or manage API keys. Sign in to get started.
            </p>
          </div>
          <button
            onClick={handleLogin}
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
      <SectionHeader
        title="LLM Providers"
        sub="Manage your model providers, API keys, and routing defaults."
        action={
          <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md hairline bg-surface-raised text-[12.5px] text-foreground hover:bg-accent transition-all duration-200">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add provider
          </button>
        }
      />

      <div className="space-y-2.5">
        {providers.map((p) => (
          <ProviderCard key={p.name} {...p} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard(p: (typeof providers)[number]) {
  const connected = p.status === "connected";
  return (
    <div className="rounded-lg hairline surface p-4 transition-all duration-200 hover:bg-surface-raised/50">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-md hairline bg-surface-raised grid place-items-center mono text-[13px] font-semibold text-foreground">
          {p.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-foreground">{p.name}</span>
            {p.isDefault && (
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
            <span>Model: {p.model}</span>
            <span className="opacity-50">·</span>
            <span>Key: {p.keyMask}</span>
            {connected && (
              <>
                <span className="opacity-50">·</span>
                <span>p50 {p.latency}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {connected && !p.isDefault && (
            <button className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md hairline bg-background text-[11.5px] text-foreground hover:bg-accent transition-all duration-200">
              <Check className="h-3 w-3" strokeWidth={2} />
              Set default
            </button>
          )}
          <button className="h-7 px-2.5 inline-flex items-center rounded-md hairline bg-background text-[11.5px] text-foreground hover:bg-accent transition-all duration-200">
            {connected ? "Edit key" : "Add key"}
          </button>
          {connected && (
            <button className="h-7 px-2.5 inline-flex items-center rounded-md text-[11.5px] text-muted-foreground hover:text-destructive transition-all duration-200">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  return (
    <div>
      <SectionHeader title="Preferences" sub="Tune retrieval behavior and response style." />
      <div className="space-y-3">
        <Row label="Retrieval depth" value="Top 8 chunks" desc="Maximum sources considered per query." />
        <Row label="Response tone" value="Operational" desc="Concise, citation-first answers." />
        <Row label="Cite inline" value="Enabled" desc="Insert [n] citations within response text." />
        <Row label="Auto-summarize uploads" value="Disabled" desc="Generate an executive summary when new documents are indexed." />
      </div>
    </div>
  );
}

function DataTab() {
  return (
    <div>
      <SectionHeader title="Data & Retention" sub="Control how Verity stores tenant data." />
      <div className="space-y-3">
        <Row label="Chat retention" value="180 days" desc="Conversations are purged after this period." />
        <Row label="Audit log export" value="Monthly · S3" desc="Encrypted JSONL exports to your bucket." />
        <Row label="Vector store region" value="eu-west-1" desc="Tenant-isolated namespace." />
      </div>
    </div>
  );
}

function AccountTab() {
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const user = useApp((s) => s.user);
  const login = useApp((s) => s.login);

  const handleLogin = () => {
    const demoUser: UserInfo = {
      name: "Elena Marsh",
      initials: "EM",
      email: "elena.marsh@northwind.legal",
      role: "Admin",
    };
    login(demoUser);
    toast.success("Signed in successfully", { description: `Welcome back, ${demoUser.name}` });
  };

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
            onClick={handleLogin}
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
        <button className="h-8 px-3 rounded-md hairline bg-surface-raised text-[12.5px] text-foreground hover:bg-accent transition-all duration-200">
          Manage profile
        </button>
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
        <button className="h-7 px-2.5 rounded-md hairline bg-background text-[11.5px] text-foreground hover:bg-accent transition-all duration-200">
          Change
        </button>
      </div>
    </div>
  );
}
