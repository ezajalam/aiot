import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { listBlog } from "@/lib/server/app";

export const Route = createFileRoute("/blog/")({
  loader: () => listBlog(),
  component: BlogIndex,
  head: () => ({ meta: [{ title: "Journal — Anvil" }] }),
});

function BlogIndex() {
  const posts = Route.useLoaderData();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl">Journal</h1>
        <p className="mt-2 text-muted-foreground">Notes on how the workshop actually works.</p>
        <ul className="mt-8 space-y-4">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="block rounded-xl border border-border bg-card p-5 hover:border-primary/35">
                <h2 className="font-serif text-2xl">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.meta_description}</p>
              </Link>
            </li>
          ))}
        </ul>
        {posts.length === 0 ? <p className="mt-8 text-muted-foreground">No data available yet.</p> : null}
      </main>
    </AppShell>
  );
}
