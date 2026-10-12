"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  Cloud,
  FileDashed,
  Laptop,
  Plus,
  UploadSimple,
} from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type DragEvent } from "react";
import { IconWell, pillPrimary, pillSizes } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { acceptAttribute, detectKind, FILE_KINDS, type FileKind, SNIFF_BYTES } from "@/lib/file-kinds";
import { handOff } from "@/lib/handoff";
import { ToolIcon } from "@/tools/icons";
import { isAvailable, type ToolDefinition, TOOLS } from "@/tools/registry";

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "matched"; files: File[]; kinds: FileKind[]; tools: ToolDefinition[] }
  | { kind: "unknown"; name: string };

const ALL_KINDS = Object.keys(FILE_KINDS) as FileKind[];
const FORMAT_CHIPS = ["PDF", "JPG", "PNG", "WebP", "HEIC", "AVIF", "Word", "EPUB"];

async function sniff(file: File): Promise<FileKind | null> {
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  return detectKind(head, file.name);
}

/** Tools that take every detected kind, usable ones first. */
function matchTools(kinds: readonly FileKind[]): ToolDefinition[] {
  const fits = TOOLS.filter((tool) => kinds.every((kind) => tool.accepts.includes(kind)));
  return [...fits.filter(isAvailable), ...fits.filter((tool) => !isAvailable(tool))];
}

const unique = <T,>(items: T[]) => [...new Set(items)];

/**
 * The homepage drop target: works out what a file is from its bytes and
 * offers the tools that take it. Choosing one opens the tool with the files
 * already added. Nothing is uploaded here.
 */
export function HeroDrop() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function inspect(files: File[]) {
    if (files.length === 0) return;
    setState({ kind: "reading" });
    const detected = await Promise.all(files.map(sniff));
    let known = files.flatMap((file, i) => (detected[i] ? [{ file, kind: detected[i] }] : []));
    if (known.length === 0) {
      setState({ kind: "unknown", name: files[0].name });
      return;
    }
    let tools = matchTools(unique(known.map((k) => k.kind)));
    // Mixed batches (say a PDF and a photo) rarely share a tool; fall back to the first file.
    if (tools.length === 0) {
      known = known.slice(0, 1);
      tools = matchTools([known[0].kind]);
    }
    setState({
      kind: "matched",
      files: known.map((k) => k.file),
      kinds: unique(known.map((k) => k.kind)),
      tools,
    });
  }

  function open(tool: ToolDefinition, files: File[]) {
    if (isAvailable(tool)) handOff(tool.slug, tool.multiple ? files : files.slice(0, 1));
    router.push(`/tools/${tool.slug}`);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void inspect(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={`bezel transition-transform duration-700 ease-fluid ${dragging ? "scale-[1.015]" : ""}`}
    >
      <section
        aria-labelledby={titleId}
        aria-live="polite"
        className="bezel-core relative flex min-h-[420px] flex-col overflow-hidden p-5 sm:p-7"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={acceptAttribute(ALL_KINDS)}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void inspect(files);
          }}
        />

        {(state.kind === "idle" || state.kind === "reading") && (
          <div
            className={`flex flex-1 flex-col items-center justify-center gap-6 rounded-[1.125rem] border border-dashed px-4 py-10 text-center transition-colors duration-500 ease-fluid ${
              dragging ? "border-accent bg-accent-soft/60" : "border-border"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex size-16 items-center justify-center rounded-[1.25rem] bg-accent-soft text-accent transition-transform duration-700 ease-fluid ${
                dragging ? "-translate-y-1 scale-110" : ""
              }`}
            >
              <UploadSimple size={30} weight="light" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="text-xl font-medium tracking-tight">
                {state.kind === "reading" ? "Reading your file" : "Drop any file here"}
              </h2>
              <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-text-muted">
                We check what it is on your device and show the tools that take it.
              </p>
            </div>
            <button
              type="button"
              disabled={state.kind === "reading"}
              onClick={() => inputRef.current?.click()}
              className={`${pillPrimary} ${pillSizes.md}`}
            >
              Choose a file
              <IconWell icon={Plus} />
            </button>
            <ul aria-label="Supported formats include" className="flex max-w-sm flex-wrap justify-center gap-1.5">
              {FORMAT_CHIPS.map((label) => (
                <li
                  key={label}
                  className="rounded-full bg-shell px-2.5 py-1 font-mono text-[11px] text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)]"
                >
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.kind === "matched" && (
          <div className="animate-rise flex flex-1 flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 id={titleId} className="text-xl font-medium tracking-tight">
                  {state.tools.some(isAvailable) ? "Here is what you can do" : "These tools are on the way"}
                </h2>
                <p className="truncate text-sm text-text-muted">
                  {state.files.length === 1
                    ? `${state.files[0].name}, ${formatBytes(state.files[0].size)}`
                    : `${state.files.length} files, ${state.kinds.map((k) => FILE_KINDS[k].label).join(" and ")}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-shell px-3 py-1.5 text-xs text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)] transition-colors hover:text-text"
              >
                <ArrowCounterClockwise size={13} aria-hidden="true" />
                Start over
              </button>
            </div>
            <ul className="-mx-2 flex max-h-[312px] flex-col overflow-y-auto pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]">
              {state.tools.map((tool, i) => {
                const ready = isAvailable(tool);
                return (
                  <li key={tool.slug} className="animate-rise" style={{ animationDelay: `${60 + i * 45}ms` }}>
                    <button
                      type="button"
                      onClick={() => open(tool, state.files)}
                      className="group flex w-full items-center gap-3.5 rounded-2xl px-2 py-2.5 text-left transition-colors duration-300 ease-fluid hover:bg-shell"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                          ready ? "bg-accent-soft text-accent" : "bg-shell text-text-muted"
                        }`}
                      >
                        <ToolIcon slug={tool.slug} size={20} weight="light" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2 font-medium">
                          {tool.title}
                          {!ready && (
                            <span className="rounded-full bg-shell px-2 py-px text-[11px] font-normal text-text-muted">
                              Soon
                            </span>
                          )}
                        </span>
                        <span className="truncate text-sm text-text-muted">{tool.summary}</span>
                      </span>
                      {tool.runtime === "client" ? (
                        <Laptop size={16} aria-label="Runs on your device" className="shrink-0 text-text-muted" />
                      ) : (
                        <Cloud size={16} aria-label="Runs on our servers" className="shrink-0 text-text-muted" />
                      )}
                      <ArrowRight
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-text-muted transition-transform duration-500 ease-fluid group-hover:translate-x-1 group-hover:text-text"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {state.kind === "unknown" && (
          <div className="animate-rise flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-shell text-text-muted">
              <FileDashed size={26} weight="light" />
            </span>
            <h2 id={titleId} className="text-xl font-medium tracking-tight">
              No tool takes this file yet
            </h2>
            <p className="max-w-[36ch] text-sm text-text-muted">
              {state.name} is not a format we support. Try a PDF, an image, an Office document or an ebook.
            </p>
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="rounded-full bg-shell px-4 py-2 text-sm shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-surface-muted"
            >
              Try another file
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
