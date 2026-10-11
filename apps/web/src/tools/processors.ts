import type { OutputFile } from "@/lib/download";
import type { AcceptedFile } from "@/lib/validate-files";

/**
 * Turns a tool's input files into output files. Client tools do the work in the
 * browser; server tools wrap {@link runServerJob} from "@/lib/api/jobs".
 */
export type Processor = (files: readonly AcceptedFile[], signal: AbortSignal) => Promise<OutputFile[]>;

/** Processors by tool slug. Tools without one show as "coming soon". Filled in from Phase 1. */
export const PROCESSORS: Readonly<Partial<Record<string, Processor>>> = {};
