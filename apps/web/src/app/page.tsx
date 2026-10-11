import Link from "next/link";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { SITE } from "@/lib/site";
import { CATEGORIES, toolsByCategory } from "@/tools/registry";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12">
      <section className="flex flex-col gap-4">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          {SITE.tagline}
        </h1>
        <p className="max-w-2xl text-lg text-text-muted">
          Merge, split, convert, and compress PDFs. Compress, resize, convert, and upscale images.
          No account, no trial, no watermark. Most tools run entirely in your browser.
        </p>
      </section>

      <div id="tools" className="flex flex-col gap-10">
        {toolsByCategory().map(({ category, tools }) => (
          <section key={category} aria-labelledby={`cat-${category}`} className="flex flex-col gap-4">
            <div>
              <h2 id={`cat-${category}`} className="text-xl font-semibold">
                {CATEGORIES[category].title}
              </h2>
              <p className="text-sm text-text-muted">{CATEGORIES[category].blurb}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-4 hover:border-accent"
                  >
                    <span className="font-medium">{tool.title}</span>
                    <span className="text-sm text-text-muted">{tool.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-6">
        <h2 className="text-lg font-semibold">How your files are handled</h2>
        <PrivacyBadge runtime="client" />
        <PrivacyBadge runtime="server" />
      </section>
    </div>
  );
}
