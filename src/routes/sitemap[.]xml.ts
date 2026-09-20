import { createFileRoute } from "@tanstack/react-router";
import { TOOLS } from "@/lib/tools/registry";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const urls = [
          "/",
          "/tools",
          "/pricing",
          "/blog",
          "/page/privacy",
          "/page/terms",
          "/page/cookies",
          "/page/about",
          "/page/contact",
          "/blog/how-anvil-keeps-files-local",
          "/blog/a-quiet-guide-to-everyday-pdf-tasks",
          ...TOOLS.filter((t) => !t.seo).map((t) => `/tools/${t.slug}`),
        ];
        const xml =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join("\n") +
          `\n</urlset>\n`;
        return new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
