import type { ComponentType } from "react";
import { deleteJob, fetchOutputs, runServerJob, type JobPhase } from "@/lib/api/jobs";
import type { OutputFile } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { LIMITS } from "@/lib/limits";
import type { AcceptedFile } from "@/lib/validate-files";
import { defineTool, type AnyToolImplementation, type OptionsProps } from "@/tools/types";

function phaseLabel(phase: JobPhase): string {
  switch (phase.phase) {
    case "uploading":
      return `Uploading… ${phase.total ? Math.floor((phase.sent / phase.total) * 100) : 0}%`;
    case "queued":
      return "Waiting for a free converter…";
    case "running":
      return "Converting…";
  }
}

interface ServerToolSpec<O> {
  slug: string;
  initialOptions: (files: readonly AcceptedFile[]) => O;
  Options?: ComponentType<OptionsProps<O>>;
  blocker?: (files: readonly AcceptedFile[], options: O) => string | null;
  /** The options to send to the job API. */
  apiOptions?: (options: O) => Record<string, unknown>;
  /** A note for each result; the default gives its size. */
  describe?: (output: OutputFile, inputs: readonly AcceptedFile[]) => string;
}

/**
 * A tool that runs on the processing backend: upload, convert, and download the
 * results into the browser, then delete the job so no copy stays on our servers.
 */
export function serverTool<O>({ slug, apiOptions, describe, ...rest }: ServerToolSpec<O>): AnyToolImplementation {
  return defineTool<O>({
    ...rest,
    async process(files, options, { signal, onProgress }) {
      const job = await runServerJob(slug, files.map((item) => item.file), apiOptions?.(options) ?? {}, {
        signal,
        onPhase: (phase) => onProgress({ label: phaseLabel(phase) }),
      });
      let outputs: OutputFile[];
      let deleted = false;
      try {
        onProgress({ label: "Downloading the result…" });
        outputs = await fetchOutputs(job, signal);
      } finally {
        deleted = await deleteJob(job.id);
      }
      const retention = deleted
        ? "deleted from our servers"
        : `deleted from our servers within ${LIMITS.retentionMinutes} minutes`;
      return outputs.map((output) => ({
        ...output,
        detail: `${describe ? describe(output, files) : formatBytes(output.data.size)} · ${retention}`,
      }));
    },
  });
}

/** A settings panel that only explains what to expect. */
export function Note({ children }: { children: string }) {
  function NoteOptions() {
    return <p className="text-sm text-text-muted">{children}</p>;
  }
  return NoteOptions;
}
