"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  CircleNotch,
  DotsSixVertical,
  DownloadSimple,
  FileZip,
  Hammer,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { IconWell, pillPrimary, pillSecondary, pillSizes } from "@/components/ui";
import { useDragReorder } from "@/components/useDragReorder";
import { downloadBlob, downloadOutputs, type OutputFile } from "@/lib/download";
import { acceptAttribute, FILE_KINDS } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import { takeHandoff } from "@/lib/handoff";
import { moveItem } from "@/lib/move";
import { validateFiles, type AcceptedFile, type RejectedFile } from "@/lib/validate-files";
import { ToolIcon } from "@/tools/icons";
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

const iconButton =
  "flex size-8 items-center justify-center rounded-full text-text-muted transition-[background-color,color,transform] " +
  "duration-300 ease-fluid hover:bg-shell hover:text-text active:scale-95 disabled:pointer-events-none disabled:opacity-30";

const panelHeading = "text-sm font-medium tracking-tight";

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

  // Files chosen on the homepage arrive here once, already picked.
  // The hand-off is taken exactly once, so the result is applied even if
  // development mode remounts the component in between.
  const receiveHandoff = useEffectEvent((handed: File[]) => addFiles(handed));
  useEffect(() => {
    const handed = takeHandoff(tool.slug);
    if (handed) void Promise.resolve(handed).then(receiveHandoff);
  }, [tool.slug]);

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
  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);
  const share = run.kind === "running" && run.progress && run.progress.total > 0
    ? Math.min(1, run.progress.done / run.progress.total)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <Dropzone
        accept={acceptAttribute(tool.accepts)}
        multiple={tool.multiple}
        disabled={busy}
        hint={hint}
        onFiles={addFiles}
        compact={files.length > 0}
      />

      {rejected.length > 0 && (
        <ul
          role="alert"
          className="animate-rise flex flex-col gap-1 rounded-[1.25rem] bg-danger-soft px-5 py-4 text-sm text-danger"
        >
          {rejected.map(({ file, reason }, i) => (
            <li key={`${file.name}-${i}`} className="flex items-start gap-2">
              <WarningCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{file.name}</span>: {reason}
              </span>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="bezel animate-rise">
          <div className="bezel-core flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between gap-4 px-4 pt-3 pb-1">
              <h2 className={panelHeading}>
                {files.length} file{files.length === 1 ? "" : "s"}{" "}
                <span className="font-normal text-text-muted">· {formatBytes(totalBytes)}</span>
              </h2>
              {tool.multiple && files.length > 1 && (
                <span className="hidden text-xs text-text-muted sm:block">Drag to change the order</span>
              )}
            </div>
            <ul aria-label="Selected files" className="flex flex-col gap-1">
              {files.map((item, position) => (
                <li
                  key={item.id}
                  {...itemProps(position)}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-[background-color,opacity] duration-300 ease-fluid ${
                    over === position ? "bg-accent-soft" : "hover:bg-shell"
                  } ${dragging === position ? "opacity-40" : ""} ${tool.multiple && !busy ? "cursor-grab" : ""}`}
                >
                  {tool.multiple && files.length > 1 && (
                    <DotsSixVertical
                      size={16}
                      aria-hidden="true"
                      className="-mr-1 shrink-0 text-text-muted opacity-50 transition-opacity group-hover:opacity-100"
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-shell text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)]"
                  >
                    <ToolIcon slug={tool.slug} size={17} weight="light" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                  <span className="flex shrink-0 items-center gap-0.5 text-sm text-text-muted">
                    <span className="mr-2 font-mono text-xs">{formatBytes(item.file.size)}</span>
                    {tool.multiple && files.length > 1 && (
                      <>
                        <button
                          type="button"
                          disabled={busy || position === 0}
                          onClick={() => moveFile(position, position - 1)}
                          className={iconButton}
                          aria-label={`Move ${item.file.name} up`}
                        >
                          <ArrowUp size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={busy || position === files.length - 1}
                          onClick={() => moveFile(position, position + 1)}
                          className={iconButton}
                          aria-label={`Move ${item.file.name} down`}
                        >
                          <ArrowDown size={15} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => changeFiles(files.filter((f) => f.id !== item.id))}
                      className={iconButton}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {Options && files.length > 0 && (
        <section aria-label="Settings" className="bezel animate-rise">
          <div className="bezel-core flex flex-col gap-5 p-5 sm:p-6">
            <h2 className={panelHeading}>Settings</h2>
            <Options
              key={files.map((f) => f.id).join()}
              files={files}
              options={options}
              setOptions={setOptions}
              disabled={busy}
            />
          </div>
        </section>
      )}

      {!implementation ? (
        <div className="bezel">
          <div className="bezel-core flex items-start gap-4 p-5 sm:p-6">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-shell text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)]"
            >
              <Hammer size={20} weight="light" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className={panelHeading}>Coming soon</h2>
              <p className="text-sm leading-relaxed text-text-muted">
                This tool is under construction and arrives in phase {tool.phase} of the roadmap.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button
              type="button"
              disabled={files.length === 0 || busy || blocker !== null}
              onClick={process}
              className={`${pillPrimary} h-14 pr-2 pl-7 text-base`}
            >
              {busy ? "Working…" : tool.title}
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full bg-on-accent/15 transition-transform duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105"
              >
                {busy ? (
                  <CircleNotch size={18} className="animate-spin" />
                ) : (
                  <ToolIcon slug={tool.slug} size={18} weight="regular" />
                )}
              </span>
            </button>
            {busy && (
              <>
                {run.progress && (
                  <span role="status" className="font-mono text-sm text-text-muted">
                    {run.progress.done} of {run.progress.total} {run.progress.unit}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className={`${pillSecondary} ${pillSizes.plain}`}
                >
                  Cancel
                </button>
              </>
            )}
            {!busy && blocker && <span className="text-sm text-text-muted">{blocker}</span>}
            {!busy && !blocker && files.length === 0 && (
              <span className="text-sm text-text-muted">Add {tool.multiple ? "files" : "a file"} to start.</span>
            )}
          </div>
          {busy && (
            <div aria-hidden="true" className="h-1 w-full max-w-md overflow-hidden rounded-full bg-hairline">
              <div
                className={`h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-fluid ${
                  share === null ? "animate-pulse" : ""
                }`}
                style={{ transform: `scaleX(${share ?? 0.15})` }}
              />
            </div>
          )}
        </div>
      )}

      {run.kind === "error" && (
        <p
          role="alert"
          className="animate-rise flex items-start gap-2.5 rounded-[1.25rem] bg-danger-soft px-5 py-4 text-sm text-danger"
        >
          <WarningCircle size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span>{run.message}</span>
        </p>
      )}

      {run.kind === "done" && (
        <section aria-label="Results" className="bezel animate-rise">
          <div className="bezel-core flex flex-col gap-2 p-2">
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
              <CheckCircle size={20} weight="fill" aria-hidden="true" className="text-accent" />
              <h2 className={panelHeading}>
                {run.outputs.length === 1 ? "Your file is ready" : `${run.outputs.length} files are ready`}
              </h2>
            </div>
            <ul className="flex flex-col gap-1">
              {run.outputs.map((output, i) => (
                <li
                  key={`${output.name}-${i}`}
                  className="animate-rise flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-shell"
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
                  >
                    <DownloadSimple size={17} weight="light" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{output.name}</span>
                    {output.detail && <span className="text-sm text-text-muted">{output.detail}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadBlob(output.data, output.name)}
                    className={`${pillSecondary} h-9 shrink-0 px-4 text-sm`}
                  >
                    Download
                    <span className="font-mono text-xs text-text-muted">{formatBytes(output.data.size)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {run.outputs.length > 1 && (
              <div className="px-2 pt-2 pb-2">
                <button
                  type="button"
                  onClick={() => downloadOutputs(run.outputs, `${tool.slug}.zip`)}
                  className={`${pillPrimary} ${pillSizes.md}`}
                >
                  Download all as ZIP
                  <IconWell icon={FileZip} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
