"use client";

import { useCallback, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { useDragReorder } from "@/components/useDragReorder";
import { downloadBlob, downloadOutputs, type OutputFile } from "@/lib/download";
import { acceptAttribute, FILE_KINDS } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import { moveItem } from "@/lib/move";
import { validateFiles, type AcceptedFile, type RejectedFile } from "@/lib/validate-files";
import { IMPLEMENTATIONS } from "@/tools/implementations";
import type { ToolDefinition } from "@/tools/registry";
import type { AnyToolImplementation, Progress } from "@/tools/types";

type RunState =
  | { kind: "idle" }
  | { kind: "running"; progress: Progress | null }
  | { kind: "done"; outputs: OutputFile[] }
  | { kind: "error"; message: string };

interface ToolWorkspaceProps {
  tool: ToolDefinition;
  /** Overrides the registered implementation; used by tests. */
  implementation?: AnyToolImplementation;
}

export function ToolWorkspace({ tool, implementation = IMPLEMENTATIONS[tool.slug] }: ToolWorkspaceProps) {
  const [files, setFiles] = useState<AcceptedFile[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [options, setOptionsState] = useState<unknown>(() => implementation?.initialOptions([]));
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Results no longer match once the settings change.
  const setOptions = useCallback((update: (options: unknown) => unknown) => {
    setOptionsState(update);
    setRun((current) => (current.kind === "done" || current.kind === "error" ? { kind: "idle" } : current));
  }, []);

  function changeFiles(next: AcceptedFile[], { keepOptions = false } = {}) {
    setFiles(next);
    if (!keepOptions) setOptionsState(implementation?.initialOptions(next));
    setRun({ kind: "idle" });
  }

  function moveFile(from: number, to: number) {
    changeFiles(moveItem(files, from, to), { keepOptions: true });
  }

  const kinds = tool.accepts.map((kind) => FILE_KINDS[kind].label).join(", ");
  const hint = `${kinds} · up to ${formatBytes(tool.maxFileBytes)}${
    tool.multiple ? ` each, ${tool.maxFiles} files max` : ""
  }`;

  async function addFiles(incoming: File[]) {
    const base = tool.multiple ? files : [];
    const result = await validateFiles(tool, incoming, base.length);
    setRejected(result.rejected);
    if (result.accepted.length > 0) changeFiles([...base, ...result.accepted]);
  }

  async function process() {
    if (!implementation) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ kind: "running", progress: null });
    try {
      const outputs = await implementation.process(files, options, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) setRun({ kind: "running", progress });
        },
      });
      controller.signal.throwIfAborted();
      setRun({ kind: "done", outputs });
    } catch (error) {
      if (controller.signal.aborted) setRun({ kind: "idle" });
      else setRun({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = run.kind === "running";
  const blocker = files.length > 0 && implementation?.blocker ? implementation.blocker(files, options) : null;
  const { itemProps, dragging, over } = useDragReorder(tool.multiple && !busy ? moveFile : undefined);
  const Options = implementation?.Options;

  return (
    <div className="flex flex-col gap-6">
      <Dropzone
        accept={acceptAttribute(tool.accepts)}
        multiple={tool.multiple}
        disabled={busy}
        hint={hint}
        onFiles={addFiles}
      />

      {rejected.length > 0 && (
        <ul role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {rejected.map(({ file, reason }, i) => (
            <li key={`${file.name}-${i}`}>
              <span className="font-medium">{file.name}</span>: {reason}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul aria-label="Selected files" className="divide-y divide-border rounded-xl border border-border bg-surface">
          {files.map((item, position) => (
            <li
              key={item.id}
              {...itemProps(position)}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                over === position ? "bg-accent-soft" : ""
              } ${dragging === position ? "opacity-40" : ""} ${tool.multiple && !busy ? "cursor-grab" : ""}`}
            >
              <span className="min-w-0 truncate">{item.file.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-sm text-text-muted">
                <span className="mr-2">{formatBytes(item.file.size)}</span>
                {tool.multiple && files.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={busy || position === 0}
                      onClick={() => moveFile(position, position - 1)}
                      className="rounded px-2 py-1 hover:bg-surface-muted disabled:opacity-30"
                      aria-label={`Move ${item.file.name} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || position === files.length - 1}
                      onClick={() => moveFile(position, position + 1)}
                      className="rounded px-2 py-1 hover:bg-surface-muted disabled:opacity-30"
                      aria-label={`Move ${item.file.name} down`}
                    >
                      ↓
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeFiles(files.filter((f) => f.id !== item.id))}
                  className="rounded px-2 py-1 hover:bg-surface-muted"
                  aria-label={`Remove ${item.file.name}`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {Options && files.length > 0 && (
        <section aria-label="Settings" className="rounded-xl border border-border bg-surface p-4">
          <Options
            key={files.map((f) => f.id).join()}
            files={files}
            options={options}
            setOptions={setOptions}
            disabled={busy}
          />
        </section>
      )}

      {!implementation ? (
        <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          {tool.runtime === "server"
            ? "This tool runs on our servers, which aren't switched on for this site yet. Check back soon."
            : `This tool is under construction and arrives in phase ${tool.phase} of the roadmap.`}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={files.length === 0 || busy || blocker !== null}
            onClick={process}
            className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-bg"
          >
            {busy ? "Working…" : tool.title}
          </button>
          {busy && (
            <>
              {run.progress && (
                <span role="status" className="text-sm text-text-muted">
                  {"label" in run.progress
                    ? run.progress.label
                    : `${run.progress.done} of ${run.progress.total} ${run.progress.unit}`}
                </span>
              )}
              <button type="button" onClick={() => abortRef.current?.abort()} className="text-sm underline">
                Cancel
              </button>
            </>
          )}
          {!busy && blocker && <span className="text-sm text-text-muted">{blocker}</span>}
        </div>
      )}

      {run.kind === "error" && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {run.message}
        </p>
      )}

      {run.kind === "done" && (
        <section aria-label="Results" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <ul className="flex flex-col gap-2">
            {run.outputs.map((output, i) => (
              <li key={`${output.name}-${i}`} className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{output.name}</span>
                  {output.detail && <span className="text-sm text-text-muted">{output.detail}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => downloadBlob(output.data, output.name)}
                  className="shrink-0 text-sm font-medium text-accent underline"
                >
                  Download · {formatBytes(output.data.size)}
                </button>
              </li>
            ))}
          </ul>
          {run.outputs.length > 1 && (
            <button
              type="button"
              onClick={() => downloadOutputs(run.outputs, `${tool.slug}.zip`)}
              className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white dark:text-bg"
            >
              Download all as ZIP
            </button>
          )}
        </section>
      )}
    </div>
  );
}
