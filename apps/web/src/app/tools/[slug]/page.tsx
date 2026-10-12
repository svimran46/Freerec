import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { ToolWorkspace } from "@/components/ToolWorkspace";
import { formatBytes } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { ToolIcon } from "@/tools/icons";
import { CATEGORIES, getTool, isAvailable, TOOLS } from "@/tools/registry";

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata(props: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const tool = getTool((await props.params).slug);
  return tool ? { title: tool.title, description: tool.summary } : {};
}

export default async function ToolPage(props: PageProps<"/tools/[slug]">) {
  const tool = getTool((await props.params).slug);
  if (!tool) notFound();

  const related = TOOLS.filter((other) => other.category === tool.category && other.slug !== tool.slug);
  const facts = [
    { label: "Largest file", value: formatBytes(tool.maxFileBytes) },
    { label: "Files at once", value: tool.multiple ? String(tool.maxFiles) : "1" },
    {
      label: "Where it runs",
      value: tool.runtime === "client" ? "Your browser" : tool.runtime === "server" ? "Our servers" : "Either",
    },
    {
      label: "Kept for",
      value: tool.runtime === "client" ? "Never stored" : `${LIMITS.retentionMinutes} minutes`,
    },
  ];

  return (
    <div className="relative isolate px-4 pt-28 pb-12 md:px-6 md:pt-32">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(50%_60%_at_20%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)]"
      />
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-8">
          <nav aria-label="Breadcrumb" className="animate-rise">
            <ol className="flex items-center gap-2 text-sm text-text-muted">
              <li>
                <Link
                  href="/#tools"
                  className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-2 transition-colors hover:text-text"
                >
                  <ArrowLeft
                    size={14}
                    aria-hidden="true"
                    className="transition-transform duration-500 ease-fluid group-hover:-translate-x-0.5"
                  />
                  All tools
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/#cat-${tool.category}`} className="transition-colors hover:text-text">
                  {CATEGORIES[tool.category].title}
                </Link>
              </li>
            </ol>
          </nav>

          <header className="animate-rise flex flex-col gap-5" style={{ animationDelay: "60ms" }}>
            <span
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-[1.1rem] bg-surface text-accent shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline),0_14px_28px_-18px_rgb(var(--shadow-tint)/0.45)]"
            >
              <ToolIcon slug={tool.slug} size={28} weight="light" />
            </span>
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">{tool.title}</h1>
              <p className="max-w-[56ch] text-lg leading-relaxed text-text-muted">{tool.summary}</p>
            </div>
            <PrivacyBadge runtime={tool.runtime} />
          </header>

          <div className="animate-rise" style={{ animationDelay: "120ms" }}>
            <ToolWorkspace tool={tool} />
          </div>
        </div>

        <aside
          aria-label="About this tool"
          className="animate-rise flex flex-col gap-6 lg:sticky lg:top-28 lg:col-span-4 lg:self-start"
          style={{ animationDelay: "180ms" }}
        >
          <div className="bezel">
            <dl className="bezel-core grid grid-cols-2 gap-px overflow-hidden bg-hairline">
              {facts.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-1 bg-surface p-5">
                  <dt className="text-xs text-text-muted">{label}</dt>
                  <dd className="font-medium tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {related.length > 0 && (
            <nav aria-labelledby="related-title" className="flex flex-col gap-2 px-1">
              <h2 id="related-title" className="px-2 text-sm font-medium">
                More in {CATEGORIES[tool.category].title}
              </h2>
              <ul className="flex flex-col">
                {related.map((other) => {
                  return (
                    <li key={other.slug}>
                      <Link
                        href={`/tools/${other.slug}`}
                        className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors duration-300 ease-fluid hover:bg-shell"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex size-9 items-center justify-center rounded-xl ${
                            isAvailable(other) ? "bg-accent-soft text-accent" : "bg-shell text-text-muted"
                          }`}
                        >
                          <ToolIcon slug={other.slug} size={18} weight="light" />
                        </span>
                        <span className="flex-1 text-sm font-medium">{other.title}</span>
                        {!isAvailable(other) && <span className="text-xs text-text-muted">Soon</span>}
                        <ArrowUpRight
                          size={14}
                          aria-hidden="true"
                          className="text-text-muted transition-transform duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </aside>
      </div>
    </div>
  );
}
