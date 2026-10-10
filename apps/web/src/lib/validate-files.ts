import { detectKind, FILE_KINDS, SNIFF_BYTES, type FileKind } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import type { ToolDefinition } from "@/tools/registry";

export interface AcceptedFile {
  id: string;
  file: File;
  kind: FileKind;
}

export interface RejectedFile {
  file: File;
  reason: string;
}

export interface ValidationResult {
  accepted: AcceptedFile[];
  rejected: RejectedFile[];
}

let nextId = 0;

/**
 * Checks incoming files against a tool's accepted kinds and limits.
 * `existingCount` is how many files are already queued, so the per-tool file cap holds
 * across several drops.
 */
export async function validateFiles(
  tool: Pick<ToolDefinition, "accepts" | "maxFiles" | "maxFileBytes">,
  files: readonly File[],
  existingCount = 0,
): Promise<ValidationResult> {
  const result: ValidationResult = { accepted: [], rejected: [] };
  const allowed = tool.accepts.map((kind) => FILE_KINDS[kind].label).join(", ");

  for (const file of files) {
    if (existingCount + result.accepted.length >= tool.maxFiles) {
      result.rejected.push({ file, reason: `Only ${tool.maxFiles} file(s) at a time.` });
      continue;
    }
    if (file.size === 0) {
      result.rejected.push({ file, reason: "The file is empty." });
      continue;
    }
    if (file.size > tool.maxFileBytes) {
      result.rejected.push({
        file,
        reason: `Larger than the ${formatBytes(tool.maxFileBytes)} limit.`,
      });
      continue;
    }
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const kind = detectKind(head, file.name);
    if (!kind || !tool.accepts.includes(kind)) {
      result.rejected.push({ file, reason: `Not a supported file. This tool accepts ${allowed}.` });
      continue;
    }
    result.accepted.push({ id: `f${++nextId}`, file, kind });
  }
  return result;
}
