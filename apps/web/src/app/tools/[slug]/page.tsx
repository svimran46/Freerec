import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { ToolWorkspace } from "@/components/ToolWorkspace";
import { getTool, TOOLS } from "@/tools/registry";

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{tool.title}</h1>
        <p className="text-text-muted">{tool.summary}</p>
        <PrivacyBadge runtime={tool.runtime} />
      </header>
      <ToolWorkspace tool={tool} />
    </div>
  );
}
