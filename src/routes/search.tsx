import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Topbar } from "@/components/app-shell";
import { Search as SearchIcon, FileText, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { useActiveWorkspace } from "@/lib/store";
import { search as searchApi } from "@/lib/api";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Verity" }] }),
  component: SearchPage,
});

function SearchPage() {
  const ws = useActiveWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ws || !query.trim()) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi.query(ws.id, query);
        setResults(res.results);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce
    
    return () => clearTimeout(timer);
  }, [query, ws?.id]);

  return (
    <AppShell>
      <Topbar eyebrow="Workspace" title="Search" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats, documents, and indexed chunks…"
              className="w-full h-11 pl-10 pr-3 rounded-lg hairline-strong bg-surface-raised text-[14px] text-foreground placeholder:text-muted-foreground outline-none focus:border-ring/60"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <kbd className="hairline rounded px-1.5 py-0.5">⌘K</kbd>
            <span>open from anywhere</span>
            <span className="opacity-50">·</span>
            <span>Scoped to {ws?.name || "Workspace"}</span>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {query ? (loading ? "Searching..." : "Results") : "Recent results"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ul className="space-y-1">
              {results.length === 0 && query && !loading && (
                <li className="text-[13px] text-muted-foreground py-4 text-center">No results found for "{query}"</li>
              )}
              {results.map((r, i) => (
                <li key={i}>
                  <a
                    href="#"
                    className="group flex items-start gap-3 rounded-md hairline bg-surface hover:bg-surface-raised transition px-3.5 py-3"
                  >
                    {r.type === "document" ? (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" strokeWidth={1.75} />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5" strokeWidth={1.75} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-foreground truncate">{r.title}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground truncate line-clamp-2 whitespace-normal leading-relaxed">
                        {r.snippet || r.content}
                      </div>
                    </div>
                    <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                      {Math.round(r.score * 100)}% match
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
