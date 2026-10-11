/** The loading or error state shown while a tool reads its input. */
export function LoadStatus({ error, loading }: { error: string | null; loading: string }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {error}
    </p>
  ) : (
    <p className="text-sm text-text-muted" role="status">
      {loading}
    </p>
  );
}
