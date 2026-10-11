"use client";

import { ChoiceGroup, Field, inputClass } from "@/components/form";
import { PdfStatus } from "@/components/pdf/PageGrid";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { stemOf } from "@/lib/file-kinds";
import { runPdfOp } from "@/lib/pdf/client";
import { chunkPages, parseRanges, rangeLabel, type PageRange } from "@/lib/pdf/ranges";
import { defineTool, type OptionsProps } from "@/tools/types";
import { pdfOutput, readFile } from "@/tools/client/shared";

interface SplitOptions {
  pageCount: number | null;
  mode: "ranges" | "every";
  ranges: string;
  every: number;
}

function splitRanges(options: SplitOptions, pageCount: number): PageRange[] {
  return options.mode === "ranges"
    ? parseRanges(options.ranges, pageCount)
    : chunkPages(pageCount, options.every);
}

/** The ranges to split into, or why they aren't usable. */
function plan(options: SplitOptions): { ranges: PageRange[] } | { problem: string } {
  if (options.pageCount === null) return { problem: "Reading the PDF…" };
  let ranges: PageRange[];
  try {
    ranges = splitRanges(options, options.pageCount);
  } catch (error) {
    return { problem: (error as Error).message };
  }
  if (ranges.length === 1 && ranges[0].start === 0 && ranges[0].end === options.pageCount - 1) {
    return { problem: "That keeps every page together. Choose where to split." };
  }
  return { ranges };
}

/** A starting suggestion that splits the PDF in two: "1-5, 6-". */
function halves(pageCount: number): string {
  if (pageCount < 2) return "1";
  const half = Math.ceil(pageCount / 2);
  return `${half === 1 ? "1" : `1-${half}`}, ${half + 1}-`;
}

function SplitOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<SplitOptions>) {
  const { error } = usePdfDocument(files[0].file, (pageCount) =>
    setOptions((o) => ({ ...o, pageCount, ranges: o.ranges || halves(pageCount) })),
  );
  if (error || options.pageCount === null) return <PdfStatus error={error} />;
  const result = plan(options);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        This PDF has {options.pageCount} page{options.pageCount === 1 ? "" : "s"}.
      </p>
      <ChoiceGroup
        legend="Split"
        name="split-mode"
        value={options.mode}
        disabled={disabled}
        choices={[
          { value: "ranges", label: "By page ranges" },
          { value: "every", label: "Every few pages" },
        ]}
        onChange={(mode) => setOptions((o) => ({ ...o, mode }))}
      />
      {options.mode === "ranges" ? (
        <Field label="Page ranges" hint="Each range becomes its own PDF. Example: 1-3, 4-8, 9-">
          <input
            type="text"
            inputMode="numeric"
            value={options.ranges}
            disabled={disabled}
            onChange={(event) => setOptions((o) => ({ ...o, ranges: event.target.value }))}
            className={inputClass}
          />
        </Field>
      ) : (
        <Field label="Pages per PDF" hint="Use 1 to put every page in its own PDF.">
          <input
            type="number"
            min={1}
            max={options.pageCount}
            value={options.every}
            disabled={disabled}
            onChange={(event) => setOptions((o) => ({ ...o, every: event.target.valueAsNumber }))}
            className={`${inputClass} w-32`}
          />
        </Field>
      )}
      {"ranges" in result && (
        <p className="text-sm text-text-muted" aria-live="polite">
          Makes {result.ranges.length} PDF{result.ranges.length === 1 ? "" : "s"}:{" "}
          {result.ranges
            .slice(0, 6)
            .map(({ start, end }) => (start === end ? `${start + 1}` : `${start + 1}-${end + 1}`))
            .join(", ")}
          {result.ranges.length > 6 ? ", …" : ""}
        </p>
      )}
    </div>
  );
}

export const splitPdf = defineTool<SplitOptions>({
  initialOptions: () => ({ pageCount: null, mode: "ranges", ranges: "", every: 1 }),
  Options: SplitOptionsPanel,
  blocker: (_files, options) => {
    const result = plan(options);
    return "problem" in result ? result.problem : null;
  },
  async process(files, options, { signal }) {
    const result = plan(options);
    if ("problem" in result) throw new Error(result.problem);
    const input = await readFile(files[0].file);
    const stem = stemOf(input.name);
    const outputs = await runPdfOp("splitPdf", [input, result.ranges], signal);
    return outputs.map((bytes, i) => pdfOutput(`${stem}-${rangeLabel(result.ranges[i])}.pdf`, bytes));
  },
});
