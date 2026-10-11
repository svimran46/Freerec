import { LIMITS } from "@/lib/limits";
import type { ToolRuntime } from "@/tools/registry";

const LABELS: Record<ToolRuntime, string> = {
  client: "Processed on your device — files never leave it",
  server: `Processed on our servers — deleted once you have the result, or within ${LIMITS.retentionMinutes} minutes`,
  hybrid: `Classic mode runs on your device; AI mode runs on our servers and deletes files within ${LIMITS.retentionMinutes} minutes`,
};

export function PrivacyBadge({ runtime }: { runtime: ToolRuntime }) {
  return (
    <p className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${runtime === "client" ? "bg-accent" : "border border-accent"}`}
      />
      {LABELS[runtime]}
    </p>
  );
}
