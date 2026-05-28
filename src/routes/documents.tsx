import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell, Topbar } from "@/components/app-shell";
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Search,
  Filter,
  MoreHorizontal,
  Download,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveWorkspace } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Verity" },
      { name: "description", content: "Manage and index your organization's documents." },
    ],
  }),
  component: DocumentsPage,
});

const stages = [
  "Uploading",
  "Extracting Text",
  "Chunking Content",
  "Generating Embeddings",
  "Indexing Vectors",
  "Securing Tenant Data",
  "Ready",
];

const documents = [
  {
    name: "HR Handbook v4.2.pdf",
    size: "2.4 MB",
    pages: 184,
    owner: "People Ops",
    updated: "2 hours ago",
    status: 4,
    chunks: 412,
  },
  {
    name: "Vendor Master Service Agreement — Template.docx",
    size: "186 KB",
    pages: 22,
    owner: "Legal",
    updated: "Yesterday",
    status: 6,
    chunks: 87,
  },
  {
    name: "Finance Operations Manual 2026.pdf",
    size: "5.1 MB",
    pages: 312,
    owner: "Finance",
    updated: "3 days ago",
    status: 6,
    chunks: 1284,
  },
  {
    name: "GDPR Processor Obligations.pdf",
    size: "412 KB",
    pages: 36,
    owner: "Compliance",
    updated: "5 days ago",
    status: 6,
    chunks: 142,
  },
  {
    name: "Q2 Procurement SOPs.pdf",
    size: "1.2 MB",
    pages: 64,
    owner: "Procurement",
    updated: "1 week ago",
    status: 2,
    chunks: 0,
  },
];

function DocumentsPage() {
  const [activeDoc, setActiveDoc] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ws = useActiveWorkspace();
  
  // Slice the seed dataset per workspace so each tenant sees its own subset.
  const offset = ws.id.charCodeAt(0) % documents.length;
  const initialDocs = [...documents.slice(offset), ...documents.slice(0, offset)];
  const [wsDocs, setWsDocs] = useState(initialDocs);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const downloadDoc = (name: string) => {
    setMenuOpenId(null);
    toast.success("Document downloaded", { description: name });
  };

  const deleteDoc = (name: string) => {
    setWsDocs((docs) => docs.filter((d) => d.name !== name));
    setMenuOpenId(null);
    toast.success("Document deleted", { description: name });
  };

  return (
    <AppShell>
      <Topbar
        eyebrow={ws.name}
        title="Documents"
        meta={
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            · {wsDocs.length.toLocaleString()} indexed
          </span>
        }
        right={
          <button className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition">
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Upload documents
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Processing pipeline */}
        <section className="px-8 py-7 hairline-b">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                Active processing pipeline
              </h2>
              <p className="mt-0.5 mono text-[11px] text-muted-foreground">
                Q2_Procurement_SOPs.pdf · 1.2 MB · Started 00:01:34 ago
              </p>
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-warning">
              In progress
            </span>
          </div>

          <Pipeline currentStage={2} />
        </section>

        {/* Document list */}
        <section className="px-8 py-7">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search documents…"
                className="w-full h-8 pl-8 pr-3 rounded-md hairline bg-surface text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border-strong"
              />
            </div>
            <button className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md hairline bg-surface text-[12px] text-muted-foreground hover:text-foreground hover:bg-surface-raised transition">
              <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
              Filter
            </button>
            <div className="flex-1" />
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {wsDocs.length} documents
            </span>
          </div>

          <div className="rounded-lg hairline overflow-hidden surface">
            <div className="grid grid-cols-[1fr_120px_120px_140px_140px_40px] px-4 py-2.5 hairline-b bg-surface-sunken mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Name</span>
              <span>Owner</span>
              <span className="text-right">Chunks</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {wsDocs.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No documents found.
              </div>
            )}
            {wsDocs.map((d, i) => (
              <div
                key={d.name}
                onClick={() => setActiveDoc(i)}
                className={cn(
                  "w-full grid grid-cols-[1fr_120px_120px_140px_140px_40px] items-center px-4 py-3 text-left hairline-b last:border-b-0 transition cursor-pointer",
                  activeDoc === i
                    ? "bg-surface-raised"
                    : "hover:bg-surface-raised/60",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-foreground truncate">{d.name}</div>
                    <div className="mono text-[10px] text-muted-foreground">
                      {d.size} · {d.pages} pages
                    </div>
                  </div>
                </div>
                <span className="text-[12px] text-foreground/80">{d.owner}</span>
                <span className="mono text-[12px] tabular-nums text-foreground/80 text-right">
                  {d.chunks.toLocaleString()}
                </span>
                <StatusPill stage={d.status} />
                <span className="mono text-[11px] text-muted-foreground">{d.updated}</span>
                
                {/* 3-dot menu for documents */}
                <div className="relative" ref={menuOpenId === d.name ? menuRef : undefined}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === d.name ? null : d.name);
                    }}
                    className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {/* Dropdown menu */}
                  <div
                    className={cn(
                      "absolute right-0 top-full mt-1 z-30 w-40 rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-top-right",
                      menuOpenId === d.name
                        ? "opacity-100 scale-100 pointer-events-auto"
                        : "opacity-0 scale-95 pointer-events-none",
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadDoc(d.name);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Download
                    </button>
                    <div className="h-px bg-border mx-2" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDoc(d.name);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Pipeline({ currentStage }: { currentStage: number }) {
  return (
    <div className="rounded-lg hairline surface p-5">
      <div className="relative">
        <div className="absolute left-3 right-3 top-3 h-px bg-border" />
        <div
          className="absolute left-3 top-3 h-px bg-primary transition-all duration-500"
          style={{ width: `calc(${(currentStage / (stages.length - 1)) * 100}% - ${(currentStage / (stages.length - 1)) * 24}px)` }}
        />
        <ol className="relative grid grid-cols-7 gap-2">
          {stages.map((s, i) => {
            const state =
              i < currentStage ? "done" : i === currentStage ? "active" : "pending";
            return (
              <li key={s} className="flex flex-col items-center">
                <div
                  className={cn(
                    "relative h-6 w-6 grid place-items-center rounded-full transition",
                    state === "done" && "bg-primary text-primary-foreground",
                    state === "active" &&
                      "bg-background hairline-strong text-foreground ring-2 ring-primary/30",
                    state === "pending" && "bg-surface-sunken hairline text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                  ) : state === "active" ? (
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <span className="mono text-[9px]">{i + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2.5 mono text-[9.5px] uppercase tracking-wider text-center leading-tight",
                    state === "active" && "text-foreground",
                    state === "done" && "text-foreground/80",
                    state === "pending" && "text-muted-foreground/60",
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-px bg-border rounded-md overflow-hidden hairline">
        <Metric label="Pages" value="64 / 64" />
        <Metric label="Chunks" value="142" />
        <Metric label="Tokens" value="48,310" />
        <Metric label="ETA" value="00:00:42" />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 mono text-[14px] tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({ stage }: { stage: number }) {
  const ready = stage === 6;
  const inProgress = stage < 6;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-wider w-fit",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ready && "bg-success",
          inProgress && "bg-warning animate-pulse",
        )}
      />
      <span className={cn(ready ? "text-foreground/80" : "text-warning")}>
        {ready ? "Ready" : stages[stage]}
      </span>
    </span>
  );
}
