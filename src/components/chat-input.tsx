import { useState, useRef, useEffect } from "react";
import { Paperclip, ArrowUp, ChevronDown, Mic, Check, KeyRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp, PROVIDERS, type ProviderId } from "@/lib/store";

interface ChatInputProps {
  onSend?: (value: string) => void;
  onAttach?: (files: FileList) => void;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onAttach,
  placeholder = "Ask across your knowledge base…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const provider = useApp((s) => s.provider);
  const setProvider = useApp((s) => s.setProvider);
  const apiKeys = useApp((s) => s.apiKeys);
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const current = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hasKey = (id: ProviderId) =>
    PROVIDERS.find((p) => p.id === id)?.hasServerKey || Boolean(apiKeys[id]);

  const submit = () => {
    if (!value.trim()) return;
    if (!hasKey(provider)) {
      toast.error(`Add an API key for ${current.name} in Settings to use this model.`);
      return;
    }
    onSend?.(value);
    setValue("");
  };

  const pickProvider = (id: ProviderId) => {
    if (!isLoggedIn) {
      toast.error("Sign in to change API providers", { description: "You need to be signed in to manage API configurations." });
      setModelOpen(false);
      return;
    }
    setProvider(id);
    setModelOpen(false);
    if (!hasKey(id)) {
      toast.error(
        `Add an API key for ${PROVIDERS.find((p) => p.id === id)?.name} in Settings to use this model.`,
      );
    }
  };

  const toggleRecording = () => {
    setRecording((r) => !r);
  };

  return (
    <div className="px-6 pb-6 pt-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "rounded-xl bg-surface-raised hairline-strong",
            "shadow-[0_1px_0_0_oklch(1_0_0_/_5%)_inset,0_24px_60px_-30px_oklch(0_0_0_/_70%)]",
            "transition-all duration-300 focus-within:border-ring/60",
          )}
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => e.target.files && onAttach?.(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200"
              >
                <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
                Attach
              </button>
            </div>
            <div className="flex items-center gap-1.5" ref={wrapRef}>
              {/* Single Model selector */}
              <div className="relative">
                <button
                  onClick={() => setModelOpen((o) => !o)}
                  className="h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 mono"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {current.name}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 opacity-60 transition-transform duration-200",
                      modelOpen && "rotate-180",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "absolute right-0 bottom-full mb-2 w-[300px] rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden z-30 transition-all duration-200 origin-bottom-right",
                    modelOpen
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none",
                  )}
                >
                  <div className="px-3 py-2 mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hairline-b">
                    Model
                  </div>
                  <ul>
                    {PROVIDERS.map((p) => {
                      const selected = p.id === provider;
                      const available = hasKey(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            onClick={() => pickProvider(p.id)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-sidebar-accent transition-colors duration-150",
                              selected && "bg-sidebar-accent/60",
                            )}
                          >
                            <span className="mt-1 h-3.5 w-3.5 shrink-0">
                              {selected && (
                                <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-medium text-foreground">
                                  {p.name}
                                </span>
                                {p.isDefault && (
                                  <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground hairline rounded px-1 py-px">
                                    Default
                                  </span>
                                )}
                                {!available && (
                                  <KeyRound className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                                )}
                              </div>
                              <div className="text-[11.5px] text-muted-foreground/90 mt-0.5">
                                {p.description}
                              </div>
                              {!available && (
                                isLoggedIn ? (
                                  <Link
                                    to="/settings"
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 inline-block text-[11px] text-muted-foreground/80 hover:text-foreground underline-offset-2 hover:underline transition-colors duration-200"
                                  >
                                    Add API key in Settings
                                  </Link>
                                ) : (
                                  <span className="mt-1 inline-block text-[11px] text-muted-foreground/60">
                                    Sign in to add API keys
                                  </span>
                                )
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Voice */}
              <button
                onClick={toggleRecording}
                aria-label="Voice input"
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-md transition-all duration-200",
                  recording
                    ? "bg-destructive/20 text-destructive"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Mic className="h-4 w-4" strokeWidth={1.75} />
              </button>

              {/* Send */}
              <button
                onClick={submit}
                disabled={!value.trim()}
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-md transition-all duration-200",
                  value.trim()
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
