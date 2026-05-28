import { X, ExternalLink, Download, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Source {
  title: string;
  section: string;
  confidence: number;
}

export function SourcePanel({
  source,
  onClose,
}: {
  source: Source | null;
  onClose: () => void;
}) {
  const open = !!source;
  return (
    <aside
      className={cn(
        "absolute top-0 right-0 h-full w-[420px] surface hairline-l flex flex-col transition-transform duration-300 ease-out z-20",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="h-14 px-5 flex items-center justify-between hairline-b">
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Source · Document Review
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {source && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 hairline-b">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
              {source.title}
            </h2>
            <p className="mt-1 mono text-[11px] text-muted-foreground">
              {source.section}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-[11.5px]">
              <Field label="Confidence" value={`${Math.round(source.confidence * 100)}%`} accent />
              <Field label="Doc ID" value="DOC-04821" />
              <Field label="Version" value="v4.2" />
              <Field label="Updated" value="2026-04-18" />
              <Field label="Owner" value="HR Operations" />
              <Field label="Classification" value="Internal" />
            </dl>

            <div className="mt-4 flex items-center gap-1.5">
              <button className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md hairline bg-surface-raised text-[11.5px] text-foreground hover:bg-accent transition">
                <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                Open
              </button>
              <button className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md hairline bg-surface-raised text-[11.5px] text-foreground hover:bg-accent transition">
                <Download className="h-3 w-3" strokeWidth={1.75} />
                Download
              </button>
              <span className="ml-auto inline-flex items-center gap-1 mono text-[10px] text-success">
                <Shield className="h-3 w-3" strokeWidth={1.75} />
                Verified
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Retrieved chunk
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="rounded-md hairline bg-surface-sunken p-4 text-[13px] leading-[1.65] text-foreground/90">
              <p>
                <mark className="bg-primary/15 text-foreground rounded px-0.5">
                  Eligible employees may carry over up to ten (10) unused vacation days
                  into the following calendar year.
                </mark>{" "}
                Days exceeding this limit shall be forfeited unless the employee submits
                a written request to People Operations no later than December 15.
              </p>
              <p className="mt-3 text-muted-foreground">
                For employees based in the European Union, regional statutory minimums
                apply and supersede this policy where more favorable to the employee.
              </p>
            </div>
            <div className="mt-3 mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Chunk 14 of 87 · Embedding model: text-embedding-3-large
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-foreground tabular-nums", accent && "text-primary font-medium")}>
        {value}
      </dd>
    </div>
  );
}
