import { ArrowLeft, FileDashed } from "@phosphor-icons/react/dist/ssr";
import { PillLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] items-center px-4 pt-28 pb-12 md:px-6">
      <div className="mx-auto flex max-w-[1240px] flex-1 flex-col items-start gap-6">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-[1.25rem] bg-surface text-text-muted shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)]"
        >
          <FileDashed size={30} weight="light" />
        </span>
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl">Page not found</h1>
        <p className="max-w-[44ch] text-lg text-text-muted">
          The link may be old, or the tool may have moved. Every tool is listed on the homepage.
        </p>
        <PillLink href="/#tools" icon={ArrowLeft}>
          See all tools
        </PillLink>
      </div>
    </div>
  );
}
