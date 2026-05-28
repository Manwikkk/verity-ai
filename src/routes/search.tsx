import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Topbar } from "@/components/app-shell";
import { Search as SearchIcon, FileText, Hash } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Verity" }] }),
  component: SearchPage,
});

const results = [
  { kind: "chat", title: "Q3 vendor compliance review", snippet: "…requires SOC 2 Type II attestations for processors handling…", time: "2h" },
  { kind: "doc", title: "GDPR Processor Obligations.pdf", snippet: "§3.1 — The processor shall implement appropriate technical measures…", time: "Indexed 5d" },
  { kind: "chat", title: "PTO carryover policy for EU staff", snippet: "Eligible employees may carry over up to ten (10) unused vacation days…", time: "Yesterday" },
  { kind: "doc", title: "HR Handbook v4.2.pdf", snippet: "§4.2 Vacation Carryover — For employees based in the European Union…", time: "Indexed 2h" },
];

function SearchPage() {
  return (
    <AppShell>
      <Topbar eyebrow="Workspace" title="Search" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Search chats, documents, and indexed chunks…"
              className="w-full h-11 pl-10 pr-3 rounded-lg hairline-strong bg-surface-raised text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-ring/60"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <kbd className="hairline rounded px-1.5 py-0.5">⌘K</kbd>
            <span>open from anywhere</span>
            <span className="opacity-50">·</span>
            <span>Scoped to Northwind Legal</span>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Recent results
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ul className="space-y-1">
              {results.map((r) => (
                <li key={r.title}>
                  <a
                    href="#"
                    className="group flex items-start gap-3 rounded-md hairline bg-surface hover:bg-surface-raised transition px-3.5 py-3"
                  >
                    {r.kind === "doc" ? (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" strokeWidth={1.75} />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5" strokeWidth={1.75} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-foreground truncate">{r.title}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground truncate">
                        {r.snippet}
                      </div>
                    </div>
                    <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {r.time}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
