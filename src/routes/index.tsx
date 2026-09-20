import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/tools/types";
import { searchTools, TOOLS, visibleTools } from "@/lib/tools/registry";
import { formatInr } from "@/lib/utils";
import { DEFAULT_PLANS } from "@/lib/billing/limits";
import { getPublicState } from "@/lib/server/app";

export const Route = createFileRoute("/")({
  loader: () => getPublicState(),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const seoEnabled = data.settings.seo_tools_enabled !== false;
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchTools(q, seoEnabled).slice(0, 8), [q, seoEnabled]);
  const featured = visibleTools(seoEnabled).filter((t) => t.featured || t.homepage);
  const paid = DEFAULT_PLANS.filter((p) => p.id !== "guest");

  return (
    <AppShell>
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pt-20">
          <p className="text-sm font-medium tracking-wide text-primary">Online workshop</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.1] tracking-tight sm:text-6xl">
            Tools that stay on your desk.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            PDF, images, text, developer helpers, calculators, and SEO snippets. Processed in the browser so
            files are not uploaded.
          </p>
          <form
            className="relative mt-8 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              const first = hits[0];
              if (first) window.location.href = `/tools/${first.slug}`;
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merge PDF, JSON, QR, age…"
              className="h-14 rounded-lg pl-11 text-base"
              aria-label="Search tools"
            />
            {q && hits.length ? (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                {hits.map((t) => (
                  <li key={t.slug}>
                    <Link to="/tools/$slug" params={{ slug: t.slug }} className="block px-4 py-2.5 hover:bg-secondary">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{t.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => seoEnabled || c.id !== "seo").map((c) => (
              <Link
                key={c.id}
                to="/tools"
                search={{ cat: c.id }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/40"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl">Featured</h2>
            <Link to="/tools" className="inline-flex items-center gap-1 text-sm hover:text-primary">
              All tools <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <Link
                key={t.slug}
                to="/tools/$slug"
                params={{ slug: t.slug }}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/35"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.category}</p>
                <h3 className="mt-2 font-serif text-2xl">{t.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
            {[
              { n: "01", t: "Pick a tool", d: "Fifty-plus utilities, grouped by the job — not by marketing keywords." },
              { n: "02", t: "Work locally", d: "PDF and image jobs run in the browser. Nothing is uploaded for those tools." },
              { n: "03", t: "Download and leave", d: "Results are files or text you copy. Usage is counted for fairness." },
            ].map((s) => (
              <div key={s.n}>
                <p className="font-mono text-sm text-primary">{s.n}</p>
                <h3 className="mt-2 font-serif text-2xl">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-serif text-3xl">Plans</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Guests get 10 uses a day. Accounts raise the ceiling. Paid plans start only after payment is verified.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {paid.map((p) => (
              <div key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{p.name}</p>
                <p className="mt-2 font-serif text-4xl">{formatInr(p.pricePaise)}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {p.monthlyLimit ? `${p.monthlyLimit} uses / month` : null}
                  {p.dailyLimit ? `${p.dailyLimit} / day` : null}
                  {p.periodLimit ? ` · ${p.periodLimit.toLocaleString("en-IN")} / period` : null}
                </p>
                {p.adFree ? <p className="mt-2 text-sm">Advertisements off</p> : null}
                <Button asChild className="mt-6" variant={p.id === "premium" ? "default" : "outline"}>
                  <Link to="/pricing">{p.pricePaise ? "Upgrade" : "Create account"}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="font-serif text-3xl">Questions</h2>
          <dl className="mt-6 grid gap-6 md:grid-cols-2">
            {(data.faqs.length ? data.faqs : []).map((f) => (
              <div key={f.id}>
                <dt className="font-medium">{f.question}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{f.answer}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
            {TOOLS.length} tools in the catalogue. SEO tools can be switched off globally without deleting content.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
