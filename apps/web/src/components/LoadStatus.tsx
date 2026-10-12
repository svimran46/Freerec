import { CircleNotch, WarningCircle } from "@phosphor-icons/react/dist/ssr";

/** The loading or error state shown while a tool reads its input. */
export function LoadStatus({ error, loading }: { error: string | null; loading: string }) {
  return error ? (
    <p role="alert" className="flex items-start gap-2.5 rounded-[1.25rem] bg-danger-soft px-5 py-4 text-sm text-danger">
      <WarningCircle size={18} aria-hidden="true" className="mt-px shrink-0" />
      <span>{error}</span>
    </p>
  ) : (
    <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
      <CircleNotch size={16} aria-hidden="true" className="animate-spin text-accent" />
      <span>{loading}</span>
    </p>
  );
}
