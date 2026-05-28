import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { useApp } from "@/lib/store";
import { useEffect, useState } from "react";
import { auth, tenants as tenantsApi } from "@/lib/api";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const isGuest = useApp((s) => s.user?.isGuest ?? false);
  const workspace = useApp((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId));
  const handleGuestSuccess = useApp((s) => s.handleGuestSuccess);
  const setWorkspaces = useApp((s) => s.setWorkspaces);
  const logout = useApp((s) => s.logout);
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || isGuest) return;

    tenantsApi
      .list()
      .then((res) => setWorkspaces(res.tenants))
      .catch(() => {
        logout();
        toast.error("Session expired", {
          description: "Please sign in again to load your current workspace.",
        });
      });
  }, [isLoggedIn, isGuest, setWorkspaces, logout]);

  useEffect(() => {
    document.title = workspace?.name ? `${workspace.name} - Verity` : "Verity - Multi-Tenant RAG";
  }, [workspace?.name]);

  if (!isLoggedIn) {
    return (
      <div className="dark h-screen w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl hairline-strong bg-surface-raised p-6 text-center shadow-raised">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Sign in required
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Open your workspace when you're ready.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to save chats, upload documents, and manage providers. You can also continue
            without an account if you just want to explore first.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link
              to="/auth"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <LogIn className="h-4 w-4" strokeWidth={1.75} />
              Sign in
            </Link>
            <button
              onClick={async () => {
                setGuestLoading(true);
                try {
                  const result = await auth.guest();
                  handleGuestSuccess(result);
                  toast.success("Continuing without an account");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Unable to start guest mode right now.",
                  );
                } finally {
                  setGuestLoading(false);
                }
              }}
              disabled={guestLoading}
              className="inline-flex h-9 items-center gap-2 rounded-md hairline bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
            >
              {guestLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" strokeWidth={1.75} />
              )}
              Continue without account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0 surface-sunken">{children}</main>
    </div>
  );
}

export function Topbar({
  eyebrow,
  title,
  meta,
  right,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="h-14 shrink-0 hairline-b bg-background/60 backdrop-blur-[2px] flex items-center px-6 gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          {eyebrow && (
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {eyebrow}
            </span>
          )}
          <h1 className="text-[14px] font-semibold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {meta}
        </div>
      </div>
      {right}
    </header>
  );
}
