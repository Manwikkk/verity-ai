import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Topbar } from "@/components/app-shell";
import { ChatInput } from "@/components/chat-input";
import { EyeOff, ShieldOff, Info } from "lucide-react";

export const Route = createFileRoute("/incognito")({
  head: () => ({ meta: [{ title: "Incognito — Verity" }] }),
  component: IncognitoPage,
});

function IncognitoPage() {
  return (
    <AppShell>
      <Topbar
        eyebrow="Private"
        title="Incognito session"
        right={
          <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-wider text-foreground hairline-strong rounded-md px-2 py-1 bg-background">
            <ShieldOff className="h-3 w-3" strokeWidth={1.75} />
            Not stored · Not logged
          </span>
        }
      />
      <div className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, oklch(1 0 0) 0 1px, transparent 1px 8px)",
          }}
        />
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
          <div className="max-w-xl text-center">
            <div className="mx-auto h-14 w-14 rounded-lg hairline-strong bg-surface grid place-items-center mb-6">
              <EyeOff className="h-6 w-6 text-foreground" strokeWidth={1.5} />
            </div>
            <h1 className="text-display text-[28px] leading-tight font-semibold tracking-tight text-foreground">
              You are in Incognito Mode
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
              Chats in Incognito Mode are not stored, indexed, or associated with your
              workspace. Document retrieval remains scoped to your tenant.
            </p>

            <div className="mt-6 mx-auto max-w-md rounded-md hairline bg-surface px-3.5 py-3 flex items-start gap-2.5 text-left">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Audit logs still record the time and user of incognito sessions for
                compliance, but content and queries are discarded after the session ends.
              </p>
            </div>
          </div>
        </div>
        <ChatInput placeholder="Ask privately — nothing here will be saved…" />
      </div>
    </AppShell>
  );
}
