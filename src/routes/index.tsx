import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { AppShell, Topbar } from "@/components/app-shell";
import { ChatInput } from "@/components/chat-input";
import { Welcome } from "@/components/welcome";
import { MessageThread, type Message } from "@/components/message-thread";
import { SourcePanel, type Source } from "@/components/source-panel";
import { ArrowRight, FilePlus2, Lock, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp, useActiveWorkspace } from "@/lib/store";
import { auth, chats as chatsApi, documents as docsApi, streamQuery } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workspace — Verity" },
      {
        name: "description",
        content: "Query your organization's documents through a secure AI workspace.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const ws = useActiveWorkspace();
  const activeChatId = useApp((s) => s.activeChatId);
  const addChat = useApp((s) => s.addChat);
  const handleGuestSuccess = useApp((s) => s.handleGuestSuccess);
  const chats = useApp((s) => s.chats);
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const provider = useApp((s) => s.provider);
  const isGuest = useApp((s) => s.user?.isGuest ?? false);
  const currentChat = chats.find((c) => c.id === activeChatId) ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const statusTimersRef = useRef<Record<string, number>>({});

  // Fetch chat history
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeChatId && ws && !isGuest && isLoggedIn) {
      chatsApi
        .get(ws.id, activeChatId)
        .then((res) => {
          setMessages(
            res.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              sources: m.sources,
            })),
          );
        })
        .catch((err) => {
          console.error("Failed to load chat", err);
        });
    } else {
      setMessages([]);
    }
  }, [activeChatId, ws, isGuest, isLoggedIn]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!ws) return;
      if (isGuest) {
        toast.error("Sign in required", {
          description: "Create an account or sign in to upload documents.",
        });
        return;
      }
      const arr = Array.from(files);
      if (!arr.length) return;

      // Upload files immediately
      for (const file of arr) {
        const toastId = toast.loading(`Uploading ${file.name}...`);
        const messageId = crypto.randomUUID();
        try {
          const doc = await docsApi.upload(ws.id, file);
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              role: "user",
              content: "Uploaded a document for this workspace.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              attachments: [
                {
                  id: doc.id,
                  name: doc.name,
                  size: doc.size,
                  status: doc.status,
                  statusLabel: "Uploading",
                  chunks: doc.chunks,
                  pages: doc.pages,
                },
              ],
            },
          ]);
          toast.success(`Attached ${file.name} to ${ws.name}`, { id: toastId });
          statusTimersRef.current[doc.id] = window.setInterval(async () => {
            try {
              const status = await docsApi.getStatus(ws.id, doc.id);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        attachments: m.attachments?.map((a) =>
                          a.id === doc.id
                            ? {
                                ...a,
                                status: status.status,
                                statusLabel: status.statusLabel,
                                chunks: status.chunks,
                                pages: status.pages,
                              }
                            : a,
                        ),
                      }
                    : m,
                ),
              );

              if (status.status === 6 || status.status < 0) {
                window.clearInterval(statusTimersRef.current[doc.id]);
                delete statusTimersRef.current[doc.id];
                if (status.status === 6) {
                  toast.success("Document ready", { description: status.name });
                }
              }
            } catch {
              window.clearInterval(statusTimersRef.current[doc.id]);
              delete statusTimersRef.current[doc.id];
            }
          }, 2000);
        } catch (err: any) {
          toast.error(`Failed to upload ${file.name}`, { description: err.message, id: toastId });
        }
      }
    },
    [ws, isGuest],
  );

  useEffect(() => {
    return () => {
      Object.values(statusTimersRef.current).forEach((timer) => window.clearInterval(timer));
      statusTimersRef.current = {};
    };
  }, []);

  // page-level drag and drop
  useEffect(() => {
    if (!isLoggedIn) return;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        setDragOver(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if ((e as DragEvent).relatedTarget === null) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <LoggedOutLanding
        guestLoading={guestLoading}
        onContinueWithoutAccount={async () => {
          setGuestLoading(true);
          try {
            const result = await auth.guest();
            handleGuestSuccess(result);
            toast.success("Continuing without an account");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Unable to start guest mode right now.",
            );
          } finally {
            setGuestLoading(false);
          }
        }}
      />
    );
  }

  const send = (text: string) => {
    if (!ws) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const tempChatId = activeChatId;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const asstMsgId = crypto.randomUUID();
    const asstMsg: Message = {
      id: asstMsgId,
      role: "assistant",
      content: "",
      isLoading: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);

    const controller = streamQuery(
      ws.id,
      text,
      (event) => {
        if (event.type === "token") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? { ...m, content: m.content + event.data.token, isLoading: false }
                : m,
            ),
          );
        } else if (event.type === "sources") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? { ...m, sources: event.data.sources, isLoading: false }
                : m,
            ),
          );
          if (event.data.chatId && !tempChatId && !isGuest) {
            // New chat created on backend, add to state
            addChat({
              id: event.data.chatId,
              workspaceId: ws.id,
              title: text.slice(0, 60),
              createdAt: Date.now(),
              pinned: false,
            });
          }
        } else if (event.type === "error") {
          toast.error("Generation failed", { description: event.data.message });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsgId
                ? {
                    ...m,
                    content: m.content + "\n\n**Error:** " + event.data.message,
                    isLoading: false,
                  }
                : m,
            ),
          );
        } else if (event.type === "done") {
          setMessages((prev) =>
            prev.map((m) => (m.id === asstMsgId ? { ...m, isLoading: false } : m)),
          );
          abortControllerRef.current = null;
        }
      },
      {
        chatId: tempChatId ?? undefined,
        providerId: provider,
        isIncognito: false,
      },
    );

    abortControllerRef.current = controller;
  };

  return (
    <AppShell>
      <Topbar
        eyebrow="Workspace"
        title={currentChat?.title ?? "New chat"}
        meta={
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            · {ws?.name ?? "Loading workspace"}
          </span>
        }
        right={
          isGuest ? (
            <Link
              to="/auth"
              className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-surface px-3 py-1.5 rounded-md hairline"
            >
              <LogIn className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="mono text-[10px] uppercase tracking-wider">Sign in</span>
            </Link>
          ) : undefined
        }
      />
      <div className="flex-1 flex flex-col min-h-0 relative">
        {messages.length === 0 ? (
          <Welcome />
        ) : (
          <MessageThread messages={messages} onOpenSource={setSource} />
        )}
        <ChatInput onSend={send} onAttach={handleFiles} />
        <SourcePanel source={source} onClose={() => setSource(null)} />

        {dragOver && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur-[1px] pointer-events-none">
            <div className="rounded-2xl hairline-strong bg-surface-raised px-10 py-10 flex flex-col items-center gap-3 shadow-raised">
              <div className="h-14 w-14 rounded-xl hairline grid place-items-center text-muted-foreground">
                <FilePlus2 className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <div className="text-[15px] font-medium text-foreground">Drop files here to add</div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace · {ws?.name ?? "Preparing"}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LoggedOutLanding({
  guestLoading,
  onContinueWithoutAccount,
}: {
  guestLoading: boolean;
  onContinueWithoutAccount: () => Promise<void>;
}) {
  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-hidden">
      <div className="absolute inset-0 grid-backdrop grid-backdrop-fade pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[18px] font-semibold tracking-tight">Verity</span>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Knowledge Workspace
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="inline-flex h-9 items-center gap-2 rounded-md hairline bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <LogIn className="h-4 w-4" strokeWidth={1.75} />
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Create account
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-12">
          <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <section>
              <div className="inline-flex items-center gap-2 rounded-full hairline bg-surface-raised px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Multi-tenant RAG workspace
                </span>
              </div>

              <h1 className="mt-6 max-w-4xl text-display text-[42px] font-semibold leading-[1.02] tracking-tight sm:text-[56px]">
                Secure tenant-scoped retrieval,
                <span className="text-muted-foreground"> from upload to cited answer.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted-foreground">
                Verity is a Node.js and TypeScript RAG system for organizations that upload PDFs,
                policies, FAQs, and manuals, then query only their own tenant knowledge base with
                guardrails against prompt injection, low-confidence retrieval, and data leakage.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Sign in or create account
                  <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                </Link>
                <button
                  onClick={() => void onContinueWithoutAccount()}
                  disabled={guestLoading}
                  className="inline-flex h-11 items-center gap-2 rounded-md hairline bg-surface px-5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
                >
                  {guestLoading ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" strokeWidth={1.75} />
                      Starting guest mode...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" strokeWidth={1.75} />
                      Continue without account
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="rounded-2xl hairline-strong bg-surface-raised/80 p-5 shadow-raised backdrop-blur-sm">
              <div className="rounded-xl hairline bg-surface p-4">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-foreground/95 grid place-items-center">
                    <div className="h-3 w-3 rounded-[2px] bg-background" />
                  </div>
                  <div>
                    <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Workspace preview
                    </p>
                    <p className="text-[14px] font-medium">What you unlock after sign-in</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    "Save chats and return to them later",
                    "Upload documents, extract text, chunk content, and store embeddings",
                    "Query tenant-filtered vectors with source-backed answers",
                    "Use guardrails for prompt injection, out-of-scope, and low confidence cases",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-lg hairline bg-surface-raised px-3 py-3"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="text-[13.5px] text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
