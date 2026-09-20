import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { CATEGORIES, type ToolCategoryId } from "@/lib/tools/types";
import { searchTools } from "@/lib/tools/registry";
import { getPublicState } from "@/lib/server/app";

type Search = { cat?: string; q?: string };

export const Route = createFileRoute("/tools/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cat: typeof s.cat === "string" ? s.cat : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  loader: () => getPublicState(),
  component: ToolsIndex,
});

function ToolsIndex() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const seoEnabled = data.settings.seo_tools_enabled !== false;
  const disabled = new Set(data.overrides.filter((o) => !o.enabled).map((o) => o.slug));
  const [q, setQ] = useState(search.q ?? "");
  const cat = (search.cat as ToolCategoryId | undefined) ?? undefined;
  const list = useMemo(() => {
    let tools = searchTools(q, seoEnabled).filter((t) => !disabled.has(t.slug));
    if (cat) tools = tools.filter((t) => t.category === cat);
    return tools;
  }, [q, cat, seoEnabled, disabled]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-4xl">All tools</h1>
        <p className="mt-2 text-muted-foreground">Filter by category or search by name.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tools" aria-label="Filter tools" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/tools"
            className={`rounded-full border px-3 py-1.5 text-sm ${!cat ? "border-primary bg-secondary" : "border-border"}`}
          >
            All
          </Link>
          {CATEGORIES.filter((c) => seoEnabled || c.id !== "seo").map((c) => (
            <Link
              key={c.id}
              to="/tools"
              search={{ cat: c.id }}
              className={`rounded-full border px-3 py-1.5 text-sm ${cat === c.id ? "border-primary bg-secondary" : "border-border"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <Link
              key={t.slug}
              to="/tools/$slug"
              params={{ slug: t.slug }}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/35"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.category}</p>
              <h2 className="mt-2 font-serif text-2xl">{t.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.summary}</p>
            </Link>
          ))}
        </div>
        {list.length === 0 ? <p className="mt-10 text-muted-foreground">No tools match that filter.</p> : null}
      </main>
    </AppShell>
  );
}
