"use client";

import { useState } from "react";
import { ChoiceGroup, Field, inputClass, smallButtonClass } from "@/components/form";
import { allPages, PageGrid, PdfStatus } from "@/components/pdf/PageGrid";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { stemOf } from "@/lib/file-kinds";
import { runPdfOp } from "@/lib/pdf/client";
import { formatIndices, parseRanges, rangeIndices } from "@/lib/pdf/ranges";
import { defineTool, type OptionsProps } from "@/tools/types";
import { pdfOutput, readFile } from "@/tools/client/shared";

interface ExtractOptions {
  pageCount: number | null;
  /** Selected page indices, ascending. */
  selected: number[];
  output: "single" | "separate";
}

function ExtractOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<ExtractOptions>) {
  const { doc, error } = usePdfDocument(files[0].file, (pageCount) =>
    setOptions((o) => ({ ...o, pageCount })),
  );
  // What's typed in the ranges box; null shows the current selection instead.
  const [draft, setDraft] = useState<string | null>(null);
  if (!doc || options.pageCount === null) return <PdfStatus error={error} />;

  const pageCount = options.pageCount;
  const selected = new Set(options.selected);
  const select = (indices: Iterable<number>) =>
    setOptions((o) => ({ ...o, selected: [...new Set(indices)].sort((a, b) => a - b) }));

  let draftError: string | null = null;
  if (draft !== null && draft.trim() !== "") {
    try {
      parseRanges(draft, pageCount);
    } catch (problem) {
      draftError = (problem as Error).message;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Pages to extract"
        hint={draftError ?? "Type ranges like 1-3, 8, or click pages below."}
      >
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? formatIndices(options.selected)}
          disabled={disabled}
          aria-invalid={draftError !== null}
          placeholder="e.g. 1-3, 8"
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            try {
              select(text.trim() === "" ? [] : rangeIndices(parseRanges(text, pageCount)));
            } catch {
              // Keep the last valid selection while the ranges are incomplete.
            }
          }}
          onBlur={() => setDraft(null)}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={smallButtonClass}
          disabled={disabled}
          onClick={() => select(allPages(pageCount).map((page) => page.index))}
        >
          Select all
        </button>
        <button type="button" className={smallButtonClass} disabled={disabled} onClick={() => select([])}>
          Clear
        </button>
        <span className="text-sm text-text-muted" aria-live="polite">
          {selected.size} of {pageCount} selected
        </span>
      </div>
      <ChoiceGroup
        legend="Save as"
        name="extract-output"
        value={options.output}
        disabled={disabled}
        choices={[
          { value: "single", label: "One PDF" },
          { value: "separate", label: "A PDF per page" },
        ]}
        onChange={(output) => setOptions((o) => ({ ...o, output }))}
      />
      <PageGrid
        doc={doc}
        pages={allPages(pageCount)}
        label="Pages"
        disabled={disabled}
        selection={{
          isSelected: (page) => selected.has(page.index),
          onToggle: (page) => {
            setDraft(null);
            const next = new Set(selected);
            if (!next.delete(page.index)) next.add(page.index);
            select(next);
          },
        }}
      />
    </div>
  );
}

export const extractPages = defineTool<ExtractOptions>({
  initialOptions: () => ({ pageCount: null, selected: [], output: "single" }),
  Options: ExtractOptionsPanel,
  blocker: (_files, options) => {
    if (options.pageCount === null) return "Reading the PDF…";
    return options.selected.length === 0 ? "Select the pages to extract." : null;
  },
  async process(files, { selected, output }, { signal }) {
    const input = await readFile(files[0].file);
    const stem = stemOf(input.name);
    if (output === "separate") {
      const ranges = selected.map((index) => ({ start: index, end: index }));
      const outputs = await runPdfOp("splitPdf", [input, ranges], signal);
      return outputs.map((bytes, i) => pdfOutput(`${stem}-page-${selected[i] + 1}.pdf`, bytes));
    }
    const bytes = await runPdfOp("rebuildPdf", [input, selected.map((index) => ({ index }))], signal);
    return [pdfOutput(`${stem}-extracted.pdf`, bytes)];
  },
});
