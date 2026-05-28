import { FileText, ChevronRight, Copy, ThumbsUp, ThumbsDown, MoreVertical, Pin, Download, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; section: string; confidence: number }[];
  isLoading?: boolean;
  attachments?: {
    id: string;
    name: string;
    size?: string;
    status?: number;
    statusLabel?: string;
    chunks?: number;
    pages?: number;
  }[];
  timestamp: string;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

export function MessageThread({
  messages,
  onOpenSource,
}: {
  messages: Message[];
  onOpenSource?: (source: { title: string; section: string; confidence: number }) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-10">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserMessage key={m.id} message={m} />
          ) : (
            <AssistantMessage key={m.id} message={m} onOpenSource={onOpenSource} />
          ),
        )}
      </div>
    </div>
  );
}

function ChatMessageMenu({ messageContent }: { messageContent: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleCopy = async () => {
    await copyText(messageContent);
    setOpen(false);
    toast.success("Copied to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([messageContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `message_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
    toast.success("Message downloaded");
  };

  const handlePin = () => {
    setOpen(false);
    toast.success("Message pinned");
  };

  const handleDelete = () => {
    setOpen(false);
    toast.success("Message deleted");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-6 w-6 grid place-items-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-all duration-150"
        aria-label="Message options"
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <div
        className={cn(
          "absolute right-0 top-full mt-1 z-30 w-40 rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-top-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        )}
      >
        <button
          onClick={handlePin}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
        >
          <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
          Pin message
        </button>
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          Copy text
        </button>
        <button
          onClick={handleDownload}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          Download
        </button>
        <div className="h-px bg-border mx-2" />
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Delete
        </button>
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: Message }) {
  return (
    <div className="group flex flex-col items-end">
      <div className="flex items-center gap-2 mb-2">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <ChatMessageMenu messageContent={message.content} />
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          You · {message.timestamp}
        </div>
      </div>
      <div className="max-w-[85%] rounded-lg bg-surface-raised hairline px-4 py-2.5 text-[14px] text-foreground leading-relaxed">
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {message.attachments.map((doc) => (
              <DocumentChip key={doc.id} doc={doc} />
            ))}
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}

function DocumentChip({
  doc,
}: {
  doc: NonNullable<Message["attachments"]>[number];
}) {
  const ready = doc.status === 6;
  const failed = typeof doc.status === "number" && doc.status < 0;
  const label = ready
    ? "Ready"
    : failed
      ? "Failed"
      : doc.statusLabel || "Processing";

  return (
    <div className="flex items-center gap-2 rounded-md hairline bg-background/60 px-2.5 py-2 text-left">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-foreground">{doc.name}</div>
        <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {doc.size || "PDF"} {doc.pages ? `· ${doc.pages} pages` : ""} {doc.chunks ? `· ${doc.chunks} chunks` : ""}
        </div>
      </div>
      <span className={cn("inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-wider", ready ? "text-success" : failed ? "text-destructive" : "text-warning")}>
        {ready ? (
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        ) : failed ? (
          <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
        )}
        {label}
      </span>
    </div>
  );
}

function AssistantMessage({
  message,
  onOpenSource,
}: {
  message: Message;
  onOpenSource?: (s: { title: string; section: string; confidence: number }) => void;
}) {
  const loading = message.isLoading || message.content.length === 0;
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    await copyText(message.content);
    toast.success("Copied answer");
  };

  const handleFeedback = (value: "up" | "down") => {
    setFeedback(value);
    toast.success(value === "up" ? "Marked helpful" : "Marked not helpful");
    window.setTimeout(() => setFeedback(null), 900);
  };

  return (
    <article className="group">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded bg-foreground grid place-items-center">
          <div className="h-1.5 w-1.5 bg-background" />
        </div>
        <span className="text-[12.5px] font-medium text-foreground">Verity</span>
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex-1">
          · {loading ? "Generating answer" : `Retrieved ${message.sources?.length ?? 0} sources`} · {message.timestamp}
        </span>
        {!loading && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <ChatMessageMenu messageContent={message.content} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg hairline bg-surface px-3 py-2.5 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          Reading workspace documents and drafting a cited answer...
        </div>
      ) : (
        <FormattedAnswer content={message.content} />
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Sources
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ul className="space-y-1">
            {message.sources.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => onOpenSource?.(s)}
                  className="group w-full flex items-center gap-3 rounded-md hairline bg-surface hover:bg-surface-raised transition-all duration-200 px-3 py-2 text-left"
                >
                  <span className="mono text-[10px] text-muted-foreground w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-foreground truncate">{s.title}</div>
                    <div className="mono text-[10px] text-muted-foreground truncate">
                      {s.section}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBar value={s.confidence} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && (
        <div className="mt-4 flex items-center gap-1">
          <ActionButton icon={Copy} label="Copy" onClick={handleCopy} />
          <ActionButton icon={ThumbsUp} active={feedback === "up"} onClick={() => handleFeedback("up")} />
          <ActionButton icon={ThumbsDown} active={feedback === "down"} onClick={() => handleFeedback("down")} />
        </div>
      )}
    </article>
  );
}

function FormattedAnswer({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="prose-block text-[14px] leading-[1.7] text-foreground/95 space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^[-*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }

        if (lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line.trim()))) {
          return (
            <ol key={i} className="list-decimal space-y-1.5 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^\d+\.\s+/, "")}</li>
              ))}
            </ol>
          );
        }

        if (/^#{1,3}\s+/.test(block.trim())) {
          return (
            <h3 key={i} className="pt-1 text-[15px] font-semibold text-foreground">
              {block.replace(/^#{1,3}\s+/, "")}
            </h3>
          );
        }

        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-14 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="mono text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-[11.5px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200",
        active && "scale-110 bg-primary/15 text-primary ring-1 ring-primary/25",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}
