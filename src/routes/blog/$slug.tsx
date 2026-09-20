import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { getCmsPage } from "@/lib/server/app";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const page = await getCmsPage({ data: params.slug });
    if (!page || page.kind !== "blog") throw notFound();
    return page;
  },
  component: BlogPost,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta_title ?? loaderData?.title ?? "Journal" },
      { name: "description", content: loaderData?.meta_description ?? "" },
    ],
  }),
});

function BlogPost() {
  const page = Route.useLoaderData();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
          Journal
        </Link>
        <h1 className="mt-3 font-serif text-4xl">{page.title}</h1>
        <article className="mt-6 space-y-4 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {page.body}
        </article>
      </main>
    </AppShell>
  );
}
