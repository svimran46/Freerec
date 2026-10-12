import Link from "next/link";
import { BrandMark } from "@/components/ui";
import { LIMITS } from "@/lib/limits";
import { SITE } from "@/lib/site";
import { CATEGORIES, isAvailable, toolsByCategory } from "@/tools/registry";

export function SiteFooter() {
  return (
    <footer className="px-4 pt-24 pb-8 md:px-6">
      <div className="bezel mx-auto max-w-[1240px]">
        <div className="bezel-core grid gap-12 px-6 py-10 md:grid-cols-12 md:gap-8 md:px-10 md:py-14">
          <div className="flex flex-col gap-4 md:col-span-4">
            <Link href="/" className="flex w-fit items-center gap-2.5 text-xl font-semibold tracking-tight">
              <BrandMark className="size-8" />
              {SITE.name}
            </Link>
            <p className="max-w-[34ch] text-sm leading-relaxed text-text-muted">
              Free, no account. Server-processed files are deleted automatically within{" "}
              {LIMITS.retentionMinutes} minutes.
            </p>
          </div>

          <nav aria-label="All tools" className="grid grid-cols-2 gap-x-6 gap-y-10 md:col-span-8 md:grid-cols-4">
            {toolsByCategory().map(({ category, tools }) => (
              <div key={category} className="flex flex-col gap-3">
                <h2 className="text-sm font-medium">{CATEGORIES[category].title}</h2>
                <ul className="flex flex-col gap-2">
                  {tools.map((tool) => (
                    <li key={tool.slug}>
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="text-sm text-text-muted transition-colors duration-300 ease-fluid hover:text-text"
                      >
                        {tool.title}
                        {!isAvailable(tool) && <span className="sr-only"> (coming soon)</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1240px] px-2 text-xs text-text-muted">
        {SITE.name} has no ads, no trial and no watermark.
      </p>
    </footer>
  );
}
