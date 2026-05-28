import { FileText, Scale, ShieldCheck, BookOpen } from "lucide-react";
import { useActiveWorkspace } from "@/lib/store";

const suggestions = [
  {
    icon: Scale,
    label: "Policy",
    title: "Summarize our updated remote work policy",
    sub: "HR Handbook · v4.2",
  },
  {
    icon: ShieldCheck,
    label: "Compliance",
    title: "Which vendors require SOC 2 Type II attestations?",
    sub: "Procurement SOPs · 2025",
  },
  {
    icon: FileText,
    label: "Operations",
    title: "List approvals required for budgets above $50k",
    sub: "Finance Manual · §3.4",
  },
  {
    icon: BookOpen,
    label: "Legal",
    title: "Extract data processor obligations from MSA template",
    sub: "Legal Templates",
  },
];

export function Welcome() {
  const ws = useActiveWorkspace();
  return (
    <div className="relative flex-1 flex flex-col items-center px-6 overflow-y-auto overflow-x-hidden pt-[12vh] pb-8">
      <div className="absolute inset-0 grid-backdrop grid-backdrop-fade pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

      <div className="relative w-full max-w-3xl">
        {/* Architectural mark — matching the top-left sidebar logo exactly */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative h-9 w-9 rounded-[7px] bg-foreground flex items-center justify-center shrink-0">
            <div className="h-3 w-3 bg-background rounded-[2px]" />
          </div>
          <div>
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Workspace · {ws?.name ?? "Loading"}
            </p>
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mt-0.5">
              {(ws?.docs ?? 0).toLocaleString()} documents indexed
            </p>
          </div>
        </div>

        <h1 className="text-display text-[40px] leading-[1.05] font-semibold tracking-tight text-foreground">
          Ask questions across your
          <br />
          <span className="text-muted-foreground">organization's knowledge base.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
          Retrieve verifiable answers from policies, manuals, contracts, and operational
          documents — with citations to the exact source.
        </p>

        <div className="mt-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Suggested queries
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.title}
                className="group text-left rounded-lg hairline bg-surface hover:bg-surface-raised hover:border-border-strong transition-all duration-200 p-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <s.icon className="h-3 w-3" strokeWidth={1.75} />
                    {s.label}
                  </span>
                  <span className="mono text-[10px] text-muted-foreground/60 group-hover:text-foreground/60 transition-colors duration-200">↗</span>
                </div>
                <div className="text-[13.5px] text-foreground leading-snug">
                  {s.title}
                </div>
                <div className="mt-1.5 mono text-[10.5px] text-muted-foreground/80">
                  {s.sub}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
