import type { ComponentType } from "react";
import type { OutputFile } from "@/lib/download";
import type { AcceptedFile } from "@/lib/validate-files";

export interface Progress {
  done: number;
  total: number;
  /** What `done` counts, such as "pages" or "images". */
  unit: string;
}

export interface RunContext {
  signal: AbortSignal;
  onProgress: (progress: Progress) => void;
}

export interface OptionsProps<O> {
  files: readonly AcceptedFile[];
  options: O;
  setOptions: (update: (options: O) => O) => void;
  disabled: boolean;
}

/**
 * How a tool works: its settings and how it turns input files into output
 * files. Client tools do the work in the browser; server tools wrap
 * `runServerJob` from "@/lib/api/jobs".
 */
export interface ToolImplementation<O> {
  /** Settings to start from; called again whenever the selected files change. */
  initialOptions: (files: readonly AcceptedFile[]) => O;
  /** Settings shown under the file list once files are chosen. */
  Options?: ComponentType<OptionsProps<O>>;
  /** Why the tool can't run yet, shown next to the run button; null when ready. */
  blocker?: (files: readonly AcceptedFile[], options: O) => string | null;
  process: (files: readonly AcceptedFile[], options: O, context: RunContext) => Promise<OutputFile[]>;
}

/** A tool implementation with its settings type erased, so tools can share one registry. */
export type AnyToolImplementation = ToolImplementation<unknown>;

export function defineTool<O>(implementation: ToolImplementation<O>): AnyToolImplementation {
  return implementation as unknown as AnyToolImplementation;
}
