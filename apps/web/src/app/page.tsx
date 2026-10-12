import {
  ArrowDown,
  ArrowUpRight,
  Cloud,
  DownloadSimple,
  HandGrabbing,
  Laptop,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr";
import { HeroDrop } from "@/components/home/HeroDrop";
import { ToolDirectory } from "@/components/home/ToolDirectory";
import { Reveal } from "@/components/Reveal";
import { Eyebrow, PillLink } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import { isAvailable, TOOLS } from "@/tools/registry";

const FLOW = [
  {
    icon: HandGrabbing,
    word: "Drop",
    text: "Drag files in or browse for them. Each one is checked by its contents, not just its name.",
  },
  {
    icon: SlidersHorizontal,
    word: "Adjust",
    text: "Pick pages, quality or size. Image tools show a live before and after while you tune.",
  },
  {
    icon: DownloadSimple,
    word: "Download",
    text: "Save each result on its own, or everything at once as a single ZIP.",
  },
];

export default function HomePage() {
  const ready = TOOLS.filter(isAvailable);
  const onDevice = ready.filter((tool) => tool.runtime === "client").length;
  const soon = TOOLS.length - ready.length;

  return (
    <>
      {/* Hero: message on the left, a working drop target on the right. */}
      <section className="relative isolate overflow-hidden px-4 pt-28 pb-14 md:px-6 md:pt-36 md:pb-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_78%_38%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_70%),radial-gradient(40%_40%_at_10%_0%,color-mix(in_oklab,var(--accent)_6%,transparent),transparent_70%)]"
        />
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col items-start gap-7 lg:col-span-7 lg:pr-6">
            <div className="animate-rise">
              <Eyebrow>
                {ready.length} tools ready · {soon} on the way
              </Eyebrow>
            </div>
            <h1
              className="animate-rise text-[2.125rem] leading-[1.06] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.5rem]"
              style={{ animationDelay: "80ms" }}
            >
              PDF and image tools that <span className="text-accent">respect your files.</span>
            </h1>
            <p
              className="animate-rise max-w-[46ch] text-base leading-relaxed text-text-muted md:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              Merge, split, compress and convert. No account, no watermark, and most tools never upload a
              single byte.
            </p>
            <div className="animate-rise flex flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
              <PillLink href="#tools" icon={ArrowDown}>
                All tools
              </PillLink>
              <PillLink href="#privacy" tone="secondary" icon={ArrowUpRight}>
                How files are handled
              </PillLink>
            </div>
          </div>
          <div className="animate-rise lg:col-span-5" style={{ animationDelay: "200ms" }}>
            <HeroDrop />
          </div>
        </div>
      </section>

      {/* Directory: every tool, grouped in a bento grid. */}
      <section id="tools" aria-labelledby="tools-title" className="px-4 py-14 md:px-6 md:py-28">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10">
          <Reveal className="flex max-w-2xl flex-col gap-4">
            <h2 id="tools-title" className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.025em] md:text-[2.5rem]">
              Pick a tool, drop your files.
            </h2>
            <p className="max-w-[58ch] text-base leading-relaxed text-text-muted md:text-lg">
              Every tool works the same way, with the same limits: up to {formatBytes(LIMITS.maxFileBytes)} per
              file and {LIMITS.maxFiles} files at a time.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ToolDirectory />
          </Reveal>
        </div>
      </section>

      {/* Flow: three verbs set as large type. */}
      <section aria-label="How it works" className="px-4 py-14 md:px-6 md:py-28">
        <ol className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 md:grid-cols-[1.1fr_1fr_1fr]">
          {FLOW.map(({ icon: Glyph, word, text }, i) => (
            <Reveal
              as="li"
              key={word}
              delay={i * 0.12}
              className={`flex flex-col gap-5 border-t border-hairline pt-8 ${i === 1 ? "md:mt-16" : ""} ${
                i === 2 ? "md:mt-32" : ""
              }`}
            >
              <Glyph size={24} weight="light" aria-hidden="true" className="text-accent" />
              <span className="text-[2.5rem] leading-none font-semibold tracking-[-0.04em] md:text-6xl">{word}</span>
              <p className="max-w-[34ch] leading-relaxed text-text-muted">{text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Privacy: where processing happens, side by side. */}
      <section id="privacy" aria-labelledby="privacy-title" className="px-4 py-14 md:px-6 md:py-28">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10">
          <Reveal className="flex max-w-2xl flex-col gap-4">
            <h2
              id="privacy-title"
              className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.025em] md:text-[2.5rem]"
            >
              How your files are handled
            </h2>
            <p className="max-w-[58ch] text-base leading-relaxed text-text-muted md:text-lg">
              Every tool page says where it runs before you add anything. There are only two places.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="bezel">
            <div className="bezel-core grid grid-cols-1 overflow-hidden md:grid-cols-2">
              <div className="flex flex-col gap-6 p-7 md:p-10">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"
                >
                  <Laptop size={28} weight="light" />
                </span>
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">On your device</h3>
                  <p className="max-w-[44ch] leading-relaxed text-text-muted">
                    {onDevice === ready.length ? `All ${ready.length}` : `${onDevice} of the ${ready.length}`} tools
                    available today run entirely in your browser. Your files are read and written locally and never
                    leave the device.
                  </p>
                </div>
                <p className="mt-auto text-sm text-text-muted">
                  Look for the laptop icon next to a tool.
                </p>
              </div>
              <div className="flex flex-col gap-6 border-t border-hairline bg-[linear-gradient(180deg,var(--shell),transparent)] p-7 md:border-t-0 md:border-l md:p-10">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-2xl bg-surface text-text shadow-[inset_0_0_0_1px_var(--hairline)]"
                >
                  <Cloud size={28} weight="light" />
                </span>
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">On our servers</h3>
                  <p className="max-w-[44ch] leading-relaxed text-text-muted">
                    Conversions that need heavy software, such as Office to PDF, run as short-lived jobs. Uploads and
                    results are deleted automatically within {LIMITS.retentionMinutes} minutes.
                  </p>
                </div>
                <p className="mt-auto text-sm text-text-muted">Look for the cloud icon next to a tool.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
