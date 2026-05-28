import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, User, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { auth } from "@/lib/api";
import { toast } from "sonner";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["signin", "signup"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Verity" },
      { name: "description", content: "Sign in to your Verity workspace." },
    ],
  }),
  component: AuthPageWrapper,
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_AUTH_ENABLED =
  import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true" && Boolean(GOOGLE_CLIENT_ID);

function AuthPageWrapper() {
  if (!GOOGLE_AUTH_ENABLED || !GOOGLE_CLIENT_ID) {
    return <AuthPage />;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthPage />
    </GoogleOAuthProvider>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const handleAuthSuccess = useApp((s) => s.handleAuthSuccess);
  const handleGuestSuccess = useApp((s) => s.handleGuestSuccess);
  const isLoggedIn = useApp((s) => s.isLoggedIn);
  const isGuest = useApp((s) => s.user?.isGuest ?? false);
  const logout = useApp((s) => s.logout);
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isLoggedIn && !isGuest) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl hairline-strong bg-surface-raised p-6 text-center shadow-raised">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Already signed in
          </p>
          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-foreground">
            Your workspace is ready.
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            You are already signed in. Open the workspace or sign out to switch accounts.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              onClick={() => navigate({ to: "/" })}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Open workspace
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex h-9 items-center rounded-md hairline bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "signup"
          ? await auth.register(email, password, name)
          : await auth.login(email, password);

      handleAuthSuccess(result);
      toast.success(mode === "signup" ? "Account created" : "Signed in", {
        description: `Welcome${mode === "signup" ? "" : " back"}, ${result.user.name}`,
      });
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(mode === "signup" ? "Registration failed" : "Sign in failed", {
        description: err.message || "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = async () => {
    setLoading(true);
    try {
      const result = await auth.guest();
      handleGuestSuccess(result);
      toast.success("Continuing as guest", {
        description: "Chats won't be saved and API keys are unavailable.",
      });
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error("Guest login failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.15_250_/_15%),transparent)]" />

      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div className="h-10 w-10 rounded-[8px] bg-foreground flex items-center justify-center mb-4">
            <div className="h-3.5 w-3.5 bg-background rounded-[2px]" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {mode === "signup"
              ? "Sign up to start querying your knowledge base"
              : "Sign in to your Verity workspace"}
          </p>
        </div>

        <div className="rounded-xl hairline-strong bg-surface-raised/50 backdrop-blur-sm p-6 shadow-[0_24px_60px_-20px_oklch(0_0_0_/_60%)] flex flex-col">
          {GOOGLE_AUTH_ENABLED && GOOGLE_CLIENT_ID ? (
            <>
              <div className="w-full flex justify-center mb-5">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (!credentialResponse.credential) return;
                    setLoading(true);
                    try {
                      const result = await auth.google(credentialResponse.credential);
                      handleAuthSuccess(result);
                      toast.success("Signed in with Google", {
                        description: `Welcome back, ${result.user.name}`,
                      });
                      navigate({ to: "/" });
                    } catch (err: any) {
                      toast.error("Google sign-in failed", { description: err.message });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => {
                    toast.error("Google login failed");
                  }}
                  theme="filled_black"
                  shape="rectangular"
                  text="continue_with"
                />
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-surface-raised/50 backdrop-blur-sm px-3 mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    or
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="mb-5 rounded-lg hairline bg-surface px-3 py-3 text-left">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 text-warning" strokeWidth={1.75} />
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">
                    Google sign-in is currently disabled.
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Enable it only after the app origin is registered in Google Cloud Console. Email
                    sign in and sign up below are ready to use.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-10 pl-9 pr-3 rounded-lg hairline bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
                />
              </div>
            )}
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full h-10 pl-9 pr-3 rounded-lg hairline bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
              />
            </div>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-10 pl-9 pr-10 rounded-lg hairline bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-10 flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                "bg-foreground text-background hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
              ) : (
                <>
                  {mode === "signup" ? "Create account" : "Sign in"}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-[12.5px] text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline underline-offset-2 font-medium transition-colors duration-150"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline underline-offset-2 font-medium transition-colors duration-150"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        {!isGuest ? (
          <button
            onClick={handleGuestContinue}
            className="mt-4 w-full h-10 flex items-center justify-center gap-2 rounded-lg text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-all duration-200"
          >
            Continue without an account
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </button>
        ) : null}

        <p className="mt-6 text-center mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
          Secured by Verity · Enterprise-grade encryption
        </p>
      </div>
    </div>
  );
}
