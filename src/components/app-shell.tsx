import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
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
