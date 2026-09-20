import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { AdSlot } from "@/components/ads";
import { ToolWorkspace } from "@/components/tool-workspace";
import { getTool, categoryMeta } from "@/lib/tools/registry";
import { getPublicState } from "@/lib/server/app";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ensureMe } from "@/lib/server/app";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/tools/$slug")({
  loader: async ({ params }) => {
    const tool = getTool(params.slug);
    if (!tool) throw notFound();
    const state = await getPublicState();
    return { tool, state };
  },
  component: ToolPage,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.tool.name ?? "Tool"} — Anvil` },
      { name: "description", content: loaderData?.tool.summary ?? "" },
    ],
  }),
});

function ToolPage() {
  const { tool, state } = Route.useLoaderData();
  const seoEnabled = state.settings.seo_tools_enabled !== false;
  const ads = state.settings.ads_enabled === true;
  const disabled = state.overrides.find((o) => o.slug === tool.slug && o.enabled === false);
  const { user, isPending } = useCurrentUserState();
  const [adFree, setAdFree] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    ensureMe().then((me) => setAdFree(Boolean(me.plan.ad_free))).catch(() => undefined);
  }, [user, isPending]);

  if (tool.seo && !seoEnabled) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-serif text-4xl">SEO tools are switched off</h1>
          <p className="mt-3 text-muted-foreground">The operator has disabled this category. Content is preserved.</p>
          <Link to="/tools" className="mt-6 inline-block text-primary">
            Back to tools
          </Link>
        </main>
      </AppShell>
    );
  }

  if (disabled) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-serif text-4xl">{tool.name}</h1>
          <p className="mt-3 text-muted-foreground">This tool is disabled by the operator.</p>
        </main>
      </AppShell>
    );
  }

  const cat = categoryMeta(tool.category);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <nav className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="px-2">/</span>
          <Link to="/tools" search={{ cat: tool.category }} className="hover:text-foreground">
            {cat.name}
          </Link>
          <span className="px-2">/</span>
          <span className="text-foreground">{tool.name}</span>
        </nav>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">{tool.name}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{tool.description}</p>
        <AdSlot placement="Above tool" enabled={ads} adFree={adFree} />
        <div className="mt-8">
          <ToolWorkspace tool={tool} seoEnabled={seoEnabled} />
        </div>
        <AdSlot placement="Below result" enabled={ads} adFree={adFree} />
      </main>
    </AppShell>
  );
}
