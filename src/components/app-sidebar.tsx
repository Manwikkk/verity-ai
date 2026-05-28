import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  MessagesSquare,
  FileText,
  EyeOff,
  Settings,
  ChevronDown,
  Trash2,
  Check,
  MoreHorizontal,
  Pin,
  Download,
  LogIn,
  LogOut,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useApp, useActiveWorkspace, useWorkspaceChats, type UserInfo } from "@/lib/store";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "New Chat", icon: Plus, exact: true, shortcut: "Ctrl+N", shortcutKey: "n" },
  { to: "/search", label: "Search", icon: Search, shortcut: "Ctrl+K", shortcutKey: "k" },
  { to: "/documents", label: "Documents", icon: FileText, shortcut: "Ctrl+D", shortcutKey: "d" },
  { to: "/incognito", label: "Incognito", icon: EyeOff, shortcut: "Ctrl+I", shortcutKey: "i" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const collapsed = useApp((s) => s.sidebarCollapsed);
  const toggle = useApp((s) => s.toggleSidebar);
  const workspace = useActiveWorkspace();
  const chats = useWorkspaceChats();
  const deleteChat = useApp((s) => s.deleteChat);
  const pinChat = useApp((s) => s.pinChat);
  const activeChatId = useApp((s) => s.activeChatId);
  const setActiveChat = useApp((s) => s.setActiveChat);
  const workspaces = useApp((s) => s.workspaces);
  const setActiveWorkspace = useApp((s) => s.setActiveWorkspace);
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const user = useApp((s) => s.user);
  const login = useApp((s) => s.login);
  const logout = useApp((s) => s.logout);
  const [wsOpen, setWsOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menu & user menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const match = nav.find((item) => item.shortcutKey === key);
        if (match) {
          e.preventDefault();
          if (match.exact) setActiveChat(null);
          navigate({ to: match.to });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, setActiveChat]);

  const handleLogin = () => {
    const demoUser: UserInfo = {
      name: "Elena Marsh",
      initials: "EM",
      email: "elena.marsh@northwind.legal",
      role: "Admin",
    };
    login(demoUser);
    toast.success("Signed in successfully", { description: `Welcome back, ${demoUser.name}` });
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    toast.success("Signed out");
  };

  const downloadChat = (chatId: string, title: string) => {
    const blob = new Blob([`Chat: ${title}\nExported at: ${new Date().toISOString()}\n\n(Chat messages are stored in memory only for this demo)`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpenId(null);
    toast.success("Chat downloaded");
  };

  const deleteAllChats = () => {
    const wsChats = chats.filter((c) => c.workspaceId === workspace.id);
    wsChats.forEach((c) => deleteChat(c.id));
    toast.success("All chats deleted");
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 bg-sidebar text-sidebar-foreground hairline-r transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
        collapsed ? "w-[60px]" : "w-[260px]",
      )}
    >
      {/* Brand + collapse */}
      <div className="h-14 flex items-center gap-2.5 px-3 hairline-b shrink-0">
        {/* Only show logo when collapsed */}
        {collapsed && (
          <div className="mx-auto relative h-6 w-6 rounded-[5px] bg-foreground flex items-center justify-center shrink-0">
            <div className="h-2 w-2 bg-background rounded-[1px]" />
          </div>
        )}
        {!collapsed && (
          <>
            <div className="flex items-baseline gap-2 flex-1 min-w-0">
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                Verity
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                v1.0
              </span>
            </div>
            <button
              onClick={toggle}
              className="ml-auto h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-200"
              aria-label="Collapse sidebar"
            >
              {/* Sidebar toggle icon matching screenshot — small square outline */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="1" width="12" height="12" rx="2" />
                <line x1="5" y1="1" x2="5" y2="13" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Workspace selector */}
      {!collapsed ? (
        <div className="relative mx-3 mt-3 shrink-0">
          <button
            onClick={() => setWsOpen((o) => !o)}
            className="w-full flex items-center justify-between rounded-md hairline bg-surface px-3 py-2 text-left transition-all duration-200 hover:bg-sidebar-accent"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 hairline grid place-items-center">
                <span className="mono text-[11px] font-semibold text-foreground">
                  {workspace.tag}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">
                  {workspace.name}
                </div>
                <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Tenant · {workspace.env}
                </div>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                wsOpen && "rotate-180",
              )}
            />
          </button>
          <div
            className={cn(
              "absolute left-0 right-0 top-full mt-1 z-20 rounded-md hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-top",
              wsOpen
                ? "opacity-100 scale-y-100 pointer-events-auto"
                : "opacity-0 scale-y-95 pointer-events-none",
            )}
          >
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setActiveWorkspace(w.id);
                  setWsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-sidebar-accent transition-colors duration-150",
                  w.id === workspace.id && "bg-sidebar-accent/60",
                )}
              >
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 hairline grid place-items-center">
                  <span className="mono text-[10px] font-semibold text-foreground">
                    {w.tag}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-foreground truncate">{w.name}</div>
                  <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {w.docs} docs · {w.env}
                  </div>
                </div>
                {w.id === workspace.id && (
                  <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Primary nav */}
      <nav className={cn("pt-4 shrink-0", collapsed ? "px-2" : "px-2")}>
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => item.exact && setActiveChat(null)}
                  onMouseEnter={() => setHoveredNav(item.to)}
                  onMouseLeave={() => setHoveredNav(null)}
                  title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                  className={cn(
                    "group relative flex h-8 items-center rounded-md text-[13px] transition-all duration-200",
                    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      <kbd
                        className={cn(
                          "ml-auto mono text-[10px] text-muted-foreground hairline rounded px-1.5 py-0.5 transition-opacity duration-150",
                          hoveredNav === item.to ? "opacity-100" : "opacity-0",
                        )}
                      >
                        {item.shortcut}
                      </kbd>
                    </>
                  )}
                  {/* Tooltip for collapsed mode */}
                  {collapsed && hoveredNav === item.to && (
                    <div className="absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-surface-raised hairline-strong shadow-raised px-2.5 py-1.5 pointer-events-none">
                      <span className="text-[12px] text-foreground">{item.label}</span>
                      <span className="ml-2 mono text-[10px] text-muted-foreground">{item.shortcut}</span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Recent chats */}
      {!collapsed && (
        <div className="px-2 mt-6 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-2.5 mb-1.5 shrink-0">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Chats
            </span>
            <div className="flex items-center gap-1">
              {chats.length > 0 && (
                <button
                  onClick={deleteAllChats}
                  className="h-4 w-4 grid place-items-center rounded text-muted-foreground/50 hover:text-destructive transition-colors duration-150"
                  title="Delete all chats"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                </button>
              )}
              <MessagesSquare className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
            </div>
          </div>
          {chats.length === 0 ? (
            <p className="px-2.5 text-[12px] text-muted-foreground/60">
              {isLoggedIn ? "No chats yet." : "Sign in to save chats."}
            </p>
          ) : (
            <ul className="overflow-y-auto space-y-px pr-1 flex-1 min-h-0">
              {chats.map((c) => (
                <li key={c.id}>
                  <div
                    className={cn(
                      "group relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] transition-all duration-200 cursor-pointer",
                      activeChatId === c.id
                        ? "bg-sidebar-accent text-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                    onClick={() => setActiveChat(c.id)}
                  >
                    {c.pinned && (
                      <Pin className="h-3 w-3 text-primary shrink-0 -rotate-45" strokeWidth={1.75} />
                    )}
                    <span className="truncate flex-1">{c.title}</span>
                    {/* Three-dot menu button */}
                    <div className="relative" ref={menuOpenId === c.id ? menuRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === c.id ? null : c.id);
                        }}
                        className="h-5 w-5 grid place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent/50 transition-all duration-150"
                        aria-label="Chat options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      {/* Dropdown menu */}
                      <div
                        className={cn(
                          "absolute right-0 top-full mt-1 z-30 w-40 rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-top-right",
                          menuOpenId === c.id
                            ? "opacity-100 scale-100 pointer-events-auto"
                            : "opacity-0 scale-95 pointer-events-none",
                        )}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pinChat(c.id);
                            setMenuOpenId(null);
                            toast.success(c.pinned ? "Chat unpinned" : "Chat pinned");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
                        >
                          <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {c.pinned ? "Unpin chat" : "Pin chat"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadChat(c.id, c.title);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-sidebar-accent transition-colors duration-150"
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Download chat
                        </button>
                        <div className="h-px bg-border mx-2" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(c.id);
                            setMenuOpenId(null);
                            toast.success("Chat deleted");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Delete chat
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* spacer when collapsed */}
      {collapsed && <div className="flex-1" />}

      {/* Footer */}
      <div className="hairline-t mt-2 p-2 space-y-0.5 shrink-0">
        <Link
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex h-8 items-center rounded-md text-[13px] transition-all duration-200",
            collapsed ? "justify-center" : "gap-2.5 px-2.5",
            pathname.startsWith("/settings")
              ? "bg-sidebar-accent text-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4 opacity-80" strokeWidth={1.75} />
          {!collapsed && "Settings"}
        </Link>

        {/* User profile / Auth */}
        {isLoggedIn && user ? (
          <div className="relative" ref={userMenuRef}>
            <div
              onClick={() => setUserMenuOpen((o) => !o)}
              className={cn(
                "flex items-center rounded-md hover:bg-sidebar-accent/60 transition-all duration-200 cursor-pointer",
                collapsed ? "justify-center py-1.5" : "gap-2.5 px-2.5 py-2",
              )}
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 hairline grid place-items-center mono text-[11px] font-semibold text-foreground shrink-0">
                {user.initials}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-foreground truncate leading-tight">
                      {user.name}
                    </div>
                    <div className="mono text-[10px] uppercase tracking-wider text-muted-foreground leading-tight mt-0.5">
                      {user.role}
                    </div>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                </>
              )}
            </div>
            {/* Logout popup */}
            <div
              className={cn(
                "absolute left-0 right-0 bottom-full mb-1 z-30 rounded-lg hairline-strong bg-surface-raised shadow-raised overflow-hidden transition-all duration-200 origin-bottom",
                userMenuOpen
                  ? "opacity-100 scale-y-100 pointer-events-auto"
                  : "opacity-0 scale-y-95 pointer-events-none",
              )}
            >
              <div className="px-3 py-2 hairline-b">
                <div className="text-[12px] font-medium text-foreground truncate">{user.name}</div>
                <div className="mono text-[10px] text-muted-foreground truncate">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12px] text-destructive hover:bg-destructive/10 transition-colors duration-150"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            title={collapsed ? "Sign in" : undefined}
            className={cn(
              "flex items-center rounded-md text-[13px] transition-all duration-200 w-full",
              collapsed ? "justify-center h-8" : "gap-2.5 px-2.5 h-9",
              "bg-primary/15 text-primary hover:bg-primary/25",
            )}
          >
            <LogIn className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="font-medium">Sign in</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
