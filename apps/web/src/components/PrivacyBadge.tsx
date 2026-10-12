import { Cloud, Laptop, SplitHorizontal } from "@phosphor-icons/react/dist/ssr";
import { LIMITS } from "@/lib/limits";
import type { ToolRuntime } from "@/tools/registry";

const LABELS: Record<ToolRuntime, string> = {
  client: "Processed on your device. Files never leave it.",
  server: `Processed on our servers. Deleted within ${LIMITS.retentionMinutes} minutes.`,
  hybrid: `Classic mode runs on your device; AI mode runs on our servers and deletes files within ${LIMITS.retentionMinutes} minutes.`,
};

const ICONS = { client: Laptop, server: Cloud, hybrid: SplitHorizontal } as const;

export function PrivacyBadge({ runtime }: { runtime: ToolRuntime }) {
  const Glyph = ICONS[runtime];
  return (
    <p
      className={`inline-flex w-fit items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-[13px] font-medium ${
        runtime === "client"
          ? "bg-accent-soft text-accent-strong"
          : "bg-shell text-text shadow-[inset_0_0_0_1px_var(--hairline)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 items-center justify-center rounded-full ${
          runtime === "client" ? "bg-accent text-on-accent" : "bg-surface text-text-muted"
        }`}
      >
        <Glyph size={14} weight="regular" />
      </span>
      {LABELS[runtime]}
    </p>
  );
}
