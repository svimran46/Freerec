"use client";

import { useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { downloadBlob, downloadOutputs, type OutputFile } from "@/lib/download";
import { acceptAttribute, FILE_KINDS } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import { validateFiles, type AcceptedFile, type RejectedFile } from "@/lib/validate-files";
import { PROCESSORS, type Processor } from "@/tools/processors";
import type { ToolDefinition } from "@/tools/registry";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; outputs: OutputFile[] }
  | { kind: "error"; message: string };

interface ToolWorkspaceProps {
  tool: ToolDefinition;
  /** Overrides the registered processor; used by tests. */
  processor?: Processor;
}

export function ToolWorkspace({ tool, processor = PROCESSORS[tool.slug] }: ToolWorkspaceProps) {
  const [files, setFiles] = useState<AcceptedFile[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const kinds = tool.accepts.map((kind) => FILE_KINDS[kind].label).join(", ");
  const hint = `${kinds} · up to ${formatBytes(tool.maxFileBytes)}${
    tool.multiple ? ` each, ${tool.maxFiles} files max` : ""
  }`;

  async function addFiles(incoming: File[]) {
    const base = tool.multiple ? files : [];
    const result = await validateFiles(tool, incoming, base.length);
    setFiles([...base, ...result.accepted]);
    setRejected(result.rejected);
    setRun({ kind: "idle" });
  }

  async function process() {
    if (!processor) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ kind: "running" });
    try {
      const outputs = await processor(files, controller.signal);
      setRun({ kind: "done", outputs });
    } catch (error) {
      if (controller.signal.aborted) setRun({ kind: "idle" });
      else setRun({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = run.kind === "running";

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
          {files.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0 truncate">{item.file.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-sm text-text-muted">
                {formatBytes(item.file.size)}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFiles(files.filter((f) => f.id !== item.id))}
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

      {!processor ? (
        <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          This tool is under construction and arrives in phase {tool.phase} of the roadmap.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={files.length === 0 || busy}
            onClick={process}
            className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-bg"
          >
            {busy ? "Working…" : tool.title}
          </button>
          {busy && (
            <button type="button" onClick={() => abortRef.current?.abort()} className="text-sm underline">
              Cancel
            </button>
          )}
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
                <span className="min-w-0 truncate">{output.name}</span>
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
