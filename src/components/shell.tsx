import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CATEGORIES } from "@/lib/tools/types";
import { searchTools } from "@/lib/tools/registry";
import { AnvilMark } from "@/components/mark";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <AnvilMark className="size-7 text-primary" />
            <span className="font-serif text-2xl tracking-tight">Anvil</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link to="/tools" className="hover:text-foreground">
              Tools
            </Link>
            <Link to="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link to="/blog" className="hover:text-foreground">
              Journal
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <HeaderSearch />
            <ThemeToggle />
            <AuthSlot />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 bg-background/95 p-6 md:hidden">
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>
          <nav className="mt-8 flex flex-col gap-4 text-lg">
            <Link to="/tools">Tools</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/blog">Journal</Link>
            <Link to="/account">Account</Link>
            <Link to="/login">Sign in</Link>
          </nav>
        </div>
      ) : null}
      <div id="content">{children}</div>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <AnvilMark className="size-6 text-primary" />
              <span className="font-serif text-xl">Anvil</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Everyday utilities that run on your device. Files stay with you.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Tools</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {CATEGORIES.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to="/tools" search={{ cat: c.id }} className="hover:text-foreground">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Site</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/page/$slug" params={{ slug: "about" }} className="hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-foreground">
                  Journal
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-foreground">
                  Account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/page/$slug" params={{ slug: "privacy" }} className="hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/page/$slug" params={{ slug: "terms" }} className="hover:text-foreground">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/page/$slug" params={{ slug: "cookies" }} className="hover:text-foreground">
                  Cookies
                </Link>
              </li>
              <li>
                <Link to="/page/$slug" params={{ slug: "contact" }} className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Anvil does not upload browser-processed files. Paid plans activate only after payment is verified.
        </p>
      </footer>
    </div>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />;
  }
  return (
    <>
      <SignedOut>
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link to="/login">Sign in</Link>
        </Button>
      </SignedOut>
      <SignedIn>
        <div className="hidden items-center gap-2 sm:flex">
          {user?.primaryEmail?.includes("admin") || user ? (
            <Link to="/account" className="text-sm text-muted-foreground hover:text-foreground">
              Account
            </Link>
          ) : null}
          <UserButton />
        </div>
      </SignedIn>
    </>
  );
}

function HeaderSearch() {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const hits = useMemo(() => (q.trim() ? searchTools(q, true).slice(0, 7) : []), [q]);
  return (
    <div className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => window.setTimeout(() => setFocus(false), 150)}
        placeholder="Search tools"
        className="h-10 w-56 pl-9 lg:w-72"
        aria-label="Search tools"
      />
      {focus && hits.length ? (
        <ul className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-sm">
          {hits.map((t) => (
            <li key={t.slug}>
              <Link
                to="/tools/$slug"
                params={{ slug: t.slug }}
                className={cn("block px-3 py-2 text-sm hover:bg-secondary")}
              >
                <span className="font-medium">{t.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
