import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
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
import { useActiveWorkspace, useApp } from "@/lib/store";
import { documents as docsApi } from "@/lib/api";
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

function DocumentsPage() {
  const [activeDoc, setActiveDoc] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ws = useActiveWorkspace();
  const isGuest = useApp((s) => s.user?.isGuest ?? false);
  const [wsDocs, setWsDocs] = useState<any[]>([]);
  const [processingDoc, setProcessingDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest" | "name">("latest");

  const owners = useMemo(
    () => Array.from(new Set(wsDocs.map((d) => d.owner).filter(Boolean))).sort(),
    [wsDocs],
  );

  const visibleDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return wsDocs
      .filter((doc) => {
        const matchesSearch =
          !normalized ||
          doc.name?.toLowerCase().includes(normalized) ||
          doc.owner?.toLowerCase().includes(normalized) ||
          doc.mimeType?.toLowerCase().includes(normalized);
        const matchesOwner = ownerFilter === "all" || doc.owner === ownerFilter;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "ready" && doc.status === 6) ||
          (statusFilter === "processing" && doc.status >= 0 && doc.status < 6) ||
          (statusFilter === "failed" && doc.status < 0);
        return matchesSearch && matchesOwner && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === "oldest") return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        if (sortOrder === "name") return String(a.name).localeCompare(String(b.name));
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [ownerFilter, query, sortOrder, statusFilter, wsDocs]);

  const fetchDocs = async () => {
    if (!ws) return;
    try {
      const res = await docsApi.list(ws.id);
      setWsDocs(res.documents);

      // Find if any document is processing
      const processing = res.documents.find((d: any) => d.status < 6 && d.status >= 0);
      if (processing) {
        setProcessingDoc(processing);
      } else {
        setProcessingDoc(null);
      }
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [ws?.id]);

  // Poll for status if processing
  useEffect(() => {
    if (!ws || !processingDoc) return;

    const interval = setInterval(async () => {
      try {
        const res = await docsApi.getStatus(ws.id, processingDoc.id);
        setProcessingDoc((prev: any) => ({ ...prev, ...res }));

        if (res.status === 6) {
          toast.success("Document processed", { description: res.name });
          fetchDocs();
        } else if (res.status < 0) {
          toast.error("Processing failed", { description: res.name });
          fetchDocs();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ws?.id, processingDoc?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleUpload = () => {
    if (!ws) return;
    if (isGuest) {
      toast.error("Sign in required", {
        description: "Create an account or sign in to upload documents.",
      });
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = e.target.files;
      if (!files.length) return;

      for (const file of Array.from(files) as File[]) {
        const toastId = toast.loading(`Uploading ${file.name}...`);
        try {
          await docsApi.upload(ws.id, file);
          toast.success(`Uploaded ${file.name}`, { id: toastId });
          fetchDocs();
        } catch (err: any) {
          toast.error(`Upload failed`, { description: err.message, id: toastId });
        }
      }
    };
    input.click();
  };

  const downloadDoc = async (id: string, name: string) => {
    if (!ws) return;
    try {
      const blob = await docsApi.download(ws.id, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded", { description: name });
    } catch (err: any) {
      toast.error("Download failed", { description: err.message });
    } finally {
      setMenuOpenId(null);
    }
  };

  const deleteDoc = async (id: string, name: string) => {
    if (!ws) return;
    setDeletingId(id);
    try {
      await docsApi.delete(ws.id, id);
      setWsDocs((docs) => docs.filter((doc) => doc.id !== id));
      setProcessingDoc((doc: any) => (doc?.id === id ? null : doc));
      toast.success("Document deleted", { description: name });
      void fetchDocs();
    } catch (err: any) {
      toast.error("Failed to delete document", { description: err.message });
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  return (
    <AppShell>
      <Topbar
        eyebrow={ws?.name ?? "Workspace"}
        title="Documents"
        meta={
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            · {wsDocs.length.toLocaleString()} indexed
          </span>
        }
        right={
          <button
            onClick={handleUpload}
            disabled={isGuest}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-foreground text-background text-[12.5px] font-medium hover:opacity-90 transition"
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Upload documents
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {!ws ? (
          <section className="px-8 py-10 text-sm text-muted-foreground">
            Preparing workspace documents...
          </section>
        ) : null}

        {processingDoc && (
          <section className="px-8 py-7 hairline-b">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                  Active processing pipeline
                </h2>
                <p className="mt-0.5 mono text-[11px] text-muted-foreground">
                  {processingDoc.name} · {processingDoc.size}
                </p>
              </div>
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-warning">
                In progress
              </span>
            </div>

            <Pipeline
              currentStage={processingDoc.status}
              pages={processingDoc.pages}
              chunks={processingDoc.chunks}
            />
          </section>
        )}

        <section className="px-8 py-7">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="w-full h-8 pl-8 pr-3 rounded-md hairline bg-surface text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none focus:border-border-strong"
              />
            </div>
            <button
              onClick={() => setFilterOpen((open) => !open)}
              className={cn(
                "h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md hairline bg-surface text-[12px] hover:text-foreground hover:bg-surface-raised transition",
                filterOpen || ownerFilter !== "all" || statusFilter !== "all" || sortOrder !== "latest"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
              Filter
            </button>
            <div className="flex-1" />
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {visibleDocs.length} of {wsDocs.length} documents
            </span>
          </div>

          {filterOpen && (
            <div className="mb-4 grid gap-3 rounded-lg hairline bg-surface px-4 py-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="space-y-1.5">
                <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Owner</span>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="h-8 w-full rounded-md hairline bg-background px-2 text-[12px] text-foreground outline-none"
                >
                  <option value="all">All owners</option>
                  {owners.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 w-full rounded-md hairline bg-background px-2 text-[12px] text-foreground outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="ready">Ready</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Sort</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                  className="h-8 w-full rounded-md hairline bg-background px-2 text-[12px] text-foreground outline-none"
                >
                  <option value="latest">Latest uploaded</option>
                  <option value="oldest">Oldest uploaded</option>
                  <option value="name">Name A-Z</option>
                </select>
              </label>
              <button
                onClick={() => {
                  setQuery("");
                  setOwnerFilter("all");
                  setStatusFilter("all");
                  setSortOrder("latest");
                }}
                className="mt-5 h-8 rounded-md hairline bg-background px-3 text-[12px] text-foreground hover:bg-accent"
              >
                Reset
              </button>
            </div>
          )}

          <div className="rounded-lg hairline surface">
            <div className="grid grid-cols-[1fr_120px_120px_140px_140px_40px] px-4 py-2.5 hairline-b bg-surface-sunken mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Name</span>
              <span>Owner</span>
              <span className="text-right">Chunks</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {loading ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Loading documents...
              </div>
            ) : visibleDocs.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                No documents match your search or filters.
              </div>
            ) : (
              visibleDocs.map((d, i) => (
                <div
                  key={d.id}
                  onClick={() => setActiveDoc(i)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_120px_120px_140px_140px_40px] items-center px-4 py-3 text-left hairline-b last:border-b-0 transition cursor-pointer",
                    activeDoc === i ? "bg-surface-raised" : "hover:bg-surface-raised/60",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText
                      className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                      strokeWidth={1.75}
                    />
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

                  <div className="relative" ref={menuOpenId === d.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === d.id ? null : d.id);
                      }}
                      className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
                      disabled={deletingId === d.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <div
                      className={cn(
                        "absolute right-0 z-30 w-40 rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-top-right",
                        i >= visibleDocs.length - 2 ? "bottom-full mb-1" : "top-full mt-1",
                        menuOpenId === d.id
                          ? "opacity-100 scale-100 pointer-events-auto"
                          : "opacity-0 scale-95 pointer-events-none",
                      )}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void downloadDoc(d.id, d.name);
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
                          void deleteDoc(d.id, d.name);
                        }}
                        disabled={deletingId === d.id}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {deletingId === d.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Pipeline({
  currentStage,
  pages,
  chunks,
}: {
  currentStage: number;
  pages?: number;
  chunks?: number;
}) {
  const displayStage = currentStage < 0 ? 0 : currentStage > 6 ? 6 : currentStage;
  return (
    <div className="rounded-lg hairline surface p-5">
      <div className="relative">
        <div className="absolute left-3 right-3 top-3 h-px bg-border" />
        <div
          className="absolute left-3 top-3 h-px bg-primary transition-all duration-500"
          style={{
            width: `calc(${(displayStage / (stages.length - 1)) * 100}% - ${(displayStage / (stages.length - 1)) * 24}px)`,
          }}
        />
        <ol className="relative grid grid-cols-7 gap-2">
          {stages.map((s, i) => {
            const state = i < displayStage ? "done" : i === displayStage ? "active" : "pending";
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

      <div className="mt-5 grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden hairline">
        <Metric label="Pages" value={pages ? `${pages}` : "..."} />
        <Metric label="Chunks" value={chunks ? `${chunks}` : "..."} />
        <Metric label="Status" value={currentStage === 6 ? "Done" : "Processing"} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 mono text-[14px] tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function StatusPill({ stage }: { stage: number }) {
  const failed = stage < 0;
  const ready = stage === 6;
  const inProgress = stage >= 0 && stage < 6;
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
          failed && "bg-destructive",
          inProgress && "bg-warning animate-pulse",
        )}
      />
      <span
        className={cn(ready ? "text-foreground/80" : failed ? "text-destructive" : "text-warning")}
      >
        {ready ? "Ready" : failed ? "Failed" : stages[stage]}
      </span>
    </span>
  );
}
