import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { getCmsPage } from "@/lib/server/app";

export const Route = createFileRoute("/page/$slug")({
  loader: async ({ params }) => {
    const page = await getCmsPage({ data: params.slug });
    if (!page) throw notFound();
    return page;
  },
  component: CmsPage,
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.meta_title ?? loaderData?.title ?? "Anvil" },
      { name: "description", content: loaderData?.meta_description ?? "" },
      ...(loaderData?.noindex ? [{ name: "robots", content: "noindex" }] : []),
    ],
  }),
});

function CmsPage() {
  const page = Route.useLoaderData();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-4xl">{page.title}</h1>
        <article className="mt-6 space-y-4 whitespace-pre-wrap text-base leading-relaxed">
          {page.body}
        </article>
      </main>
    </AppShell>
  );
}
