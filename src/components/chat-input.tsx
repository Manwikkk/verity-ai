import { useState, useRef, useEffect } from "react";
import { Paperclip, ArrowUp, ChevronDown, Mic, Check, Lock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { settings as settingsApi } from "@/lib/api";
import { useApp, PROVIDERS, type ProviderId } from "@/lib/store";

interface ChatInputProps {
  onSend?: (value: string) => void;
  onAttach?: (files: FileList) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onAttach,
  placeholder = "Ask across your knowledge base…",
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceBaseRef = useRef("");
  const navigate = useNavigate();

  const provider = useApp((s) => s.provider);
  const setProvider = useApp((s) => s.setProvider);
  const isGuest = useApp((s) => s.user?.isGuest ?? false);
  const workspaceId = useApp((s) => s.activeWorkspaceId);
  const [providerConfigs, setProviderConfigs] = useState<any[]>([]);
  const current = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!workspaceId || isGuest) {
      setProviderConfigs([]);
      return;
    }

    settingsApi
      .listProviders(workspaceId)
      .then((res) => {
        setProviderConfigs(res.providers);
        const defaultProvider = res.providers.find((p: any) => p.isDefault && p.hasKey);
        if (defaultProvider?.providerId) {
          setProvider(defaultProvider.providerId as ProviderId);
        }
      })
      .catch(() => setProviderConfigs([]));
  }, [workspaceId, isGuest, setProvider]);

  const hasKey = (id: ProviderId) => {
    const config = providerConfigs.find((p) => p.providerId === id || p.id === id);
    return Boolean(config?.hasKey || PROVIDERS.find((p) => p.id === id)?.hasServerKey);
  };

  const submit = () => {
    if (!value.trim() || disabled) return;
    if (!hasKey(provider)) {
      toast.error(`Add an API key for ${current.name} in Settings to use this model.`);
      navigate({ to: "/settings" });
      return;
    }
    onSend?.(value);
    setValue("");
  };

  const pickProvider = (id: ProviderId) => {
    const available = hasKey(id);

    // If user is guest, they can't change providers or add keys
    if (isGuest) {
      toast.error("Sign in to manage API providers");
      setModelOpen(false);
      return;
    }

    // If the key is not available, redirect to settings
    if (!available) {
      setModelOpen(false);
      toast.error(`Add an API key for ${PROVIDERS.find((p) => p.id === id)?.name} first`, {
        description: "Redirecting to Settings…",
      });
      navigate({ to: "/settings" });
      return;
    }

    // Key is available — select it
    setProvider(id);
    setModelOpen(false);
  };

  const toggleRecording = () => {
    if (disabled) return;

    if (recording) {
      recognitionRef.current?.stop?.();
      setRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    voiceBaseRef.current = value.trim();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalText = "";
    recognition.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const dictated = `${finalText}${interimText}`.trim();
      setValue(dictated ? `${voiceBaseRef.current ? `${voiceBaseRef.current} ` : ""}${dictated}` : voiceBaseRef.current);
    };
    recognition.onerror = () => {
      toast.error("Voice input stopped", { description: "Please check microphone permission." });
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognition.start();
    setRecording(true);
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
            disabled={disabled}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 outline-none"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf,text/plain,.txt,.md,.doc,.docx"
                hidden
                onChange={(e) => e.target.files && onAttach?.(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
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
                  disabled={disabled}
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
                      const locked = !available;
                      return (
                        <li key={p.id}>
                          <button
                            onClick={() => pickProvider(p.id)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors duration-150",
                              locked
                                ? "hover:bg-sidebar-accent/40 opacity-60 cursor-pointer"
                                : "hover:bg-sidebar-accent",
                              selected && "bg-sidebar-accent/60",
                            )}
                          >
                            <span className="mt-1 h-3.5 w-3.5 shrink-0">
                              {locked ? (
                                <Lock
                                  className="h-3.5 w-3.5 text-muted-foreground"
                                  strokeWidth={1.75}
                                />
                              ) : selected ? (
                                <Check className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                              ) : null}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "text-[13px] font-medium",
                                    locked ? "text-muted-foreground" : "text-foreground",
                                  )}
                                >
                                  {p.name}
                                </span>
                                {p.isDefault && (
                                  <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground hairline rounded px-1 py-px">
                                    Default
                                  </span>
                                )}
                                {locked && (
                                  <span className="mono text-[9px] uppercase tracking-wider text-warning hairline rounded px-1 py-px">
                                    No key
                                  </span>
                                )}
                              </div>
                              <div className="text-[11.5px] text-muted-foreground/90 mt-0.5">
                                {p.description}
                              </div>
                              {locked && (
                                <span className="mt-1 inline-block text-[11px] text-primary/80">
                                  Click to add API key →
                                </span>
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
                disabled={disabled}
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
                disabled={!value.trim() || disabled}
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-md transition-all duration-200",
                  value.trim() && !disabled
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
