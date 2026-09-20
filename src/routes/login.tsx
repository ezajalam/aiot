import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnvilMark } from "@/components/mark";
import { AppShell } from "@/components/shell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({ email, password, name: name || email.split("@")[0]! });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/account";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-4 py-16">
        <div className="w-full rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <AnvilMark className="size-7 text-primary" />
            <h1 className="font-serif text-3xl">Sign in</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Accounts keep usage and plans. Guest tools still work without one.
          </p>
          {authEnabled ? (
            <div className="mt-6 space-y-3">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/account" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground">or email</p>
              <form className="space-y-3" onSubmit={onEmail}>
                {mode === "up" ? (
                  <div className="space-y-1">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "up" ? "Create account" : "Sign in with email"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "up" ? "in" : "up")}
              >
                {mode === "up" ? "Have an account? Sign in" : "Need an account? Register"}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">Sign-in is disabled.</p>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Password reset email requires SMTP, which is not configured on this preview. Use Google or X, or a
            password you can remember.{" "}
            <Link to="/" className="underline">
              Back home
            </Link>
          </p>
        </div>
      </main>
    </AppShell>
  );
}
