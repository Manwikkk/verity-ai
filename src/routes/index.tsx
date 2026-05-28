import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { AppShell, Topbar } from "@/components/app-shell";
import { ChatInput } from "@/components/chat-input";
import { Welcome } from "@/components/welcome";
import { MessageThread, type Message } from "@/components/message-thread";
import { SourcePanel, type Source } from "@/components/source-panel";
import { FilePlus2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useApp, useActiveWorkspace } from "@/lib/store";

export const Route = createFileRoute("/")(  {
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

const seedReply: Message = {
  id: "a1",
  role: "assistant",
  timestamp: "12:04",
  content:
    "Eligible employees may carry over up to ten (10) unused vacation days into the following calendar year. Days exceeding this limit are forfeited unless the employee submits a written exception request to People Operations by December 15.\n\nFor EU-based employees, regional statutory minimums apply and supersede this clause where more favorable to the employee. Carryover for managers (Level M3 and above) follows a separate executive policy.",
  sources: [
    { title: "HR Handbook — Time Off & Leave", section: "§4.2 Vacation Carryover · p. 24", confidence: 0.94 },
    { title: "EU Employment Policy Addendum", section: "§2.1 Statutory Minimums · p. 7", confidence: 0.81 },
    { title: "Executive Compensation Framework", section: "§6 Leave for M3+ · p. 12", confidence: 0.62 },
  ],
};

// per-chat message store kept in-memory (UI only)
const messagesByChat: Record<string, Message[]> = {};

function Index() {
  const ws = useActiveWorkspace();
  const activeChatId = useApp((s) => s.activeChatId);
  const addChat = useApp((s) => s.addChat);
  const chats = useApp((s) => s.chats);
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const currentChat = chats.find((c) => c.id === activeChatId) ?? null;

  const [, force] = useState(0);
  const [source, setSource] = useState<Source | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const messages = activeChatId ? messagesByChat[activeChatId] ?? [] : [];

  const send = (text: string) => {
    let chatId = activeChatId;
    if (!chatId) {
      chatId = addChat(text);
      messagesByChat[chatId] = [];
    }
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    messagesByChat[chatId] = [...(messagesByChat[chatId] ?? []), userMsg];
    force((n) => n + 1);
    setTimeout(() => {
      messagesByChat[chatId!] = [
        ...(messagesByChat[chatId!] ?? []),
        { ...seedReply, id: crypto.randomUUID() },
      ];
      force((n) => n + 1);
    }, 350);
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    toast.success(
      `Attached ${arr.length} file${arr.length > 1 ? "s" : ""} to ${ws.name}`,
      { description: arr.map((f) => f.name).join(", ").slice(0, 80) },
    );
  }, [ws.name]);

  // page-level drag and drop
  useEffect(() => {
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
  }, [handleFiles]);

  return (
    <AppShell>
      <Topbar
        eyebrow="Workspace"
        title={currentChat?.title ?? "New chat"}
        meta={
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            · {ws.name}
          </span>
        }
        right={
          !isLoggedIn ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <LogIn className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="mono text-[10px] uppercase tracking-wider">Guest mode</span>
            </div>
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

        {/* Drag-and-drop overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur-[1px] pointer-events-none">
            <div className="rounded-2xl hairline-strong bg-surface-raised px-10 py-10 flex flex-col items-center gap-3 shadow-raised">
              <div className="h-14 w-14 rounded-xl hairline grid place-items-center text-muted-foreground">
                <FilePlus2 className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <div className="text-[15px] font-medium text-foreground">
                Drop files here to add
              </div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Workspace · {ws.name}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
