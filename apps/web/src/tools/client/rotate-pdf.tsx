"use client";

import { ArrowClockwise, ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { LoadStatus } from "@/components/LoadStatus";
import { smallButtonClass } from "@/components/form";
import { allPages, IconButton, PageGrid } from "@/components/pdf/PageGrid";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { stemOf } from "@/lib/file-kinds";
import { runPdfOp } from "@/lib/pdf/client";
import { addTurn } from "@/lib/pdf/types";
import { defineTool, type OptionsProps } from "@/tools/types";
import { pdfOutput, readFile } from "@/tools/client/shared";

interface RotateOptions {
  pageCount: number | null;
  /** Clockwise turn per page index; missing means unturned. */
  turns: Record<number, number>;
}

function RotateOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<RotateOptions>) {
  const { doc, error } = usePdfDocument(files[0].file, (pageCount) =>
    setOptions((o) => ({ ...o, pageCount })),
  );
  if (!doc || options.pageCount === null) return <LoadStatus error={error} loading="Reading pages…" />;

  const pages = allPages(options.pageCount).map((page) => ({
    ...page,
    rotate: options.turns[page.index] ?? 0,
  }));
  const turnPage = (index: number, delta: number) =>
    setOptions((o) => ({ ...o, turns: { ...o.turns, [index]: addTurn(o.turns[index] ?? 0, delta) } }));
  const turnAll = (delta: number) =>
    setOptions((o) => ({
      ...o,
      turns: Object.fromEntries(pages.map(({ index }) => [index, addTurn(o.turns[index] ?? 0, delta)])),
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={smallButtonClass} disabled={disabled} onClick={() => turnAll(-90)}>
          <ArrowCounterClockwise size={15} aria-hidden="true" />
          Turn all left
        </button>
        <button type="button" className={smallButtonClass} disabled={disabled} onClick={() => turnAll(90)}>
          <ArrowClockwise size={15} aria-hidden="true" />
          Turn all right
        </button>
        <button
          type="button"
          className={smallButtonClass}
          disabled={disabled}
          onClick={() => setOptions((o) => ({ ...o, turns: {} }))}
        >
          Reset
        </button>
      </div>
      <PageGrid
        doc={doc}
        pages={pages}
        label="Pages"
        disabled={disabled}
        actions={(page) => (
          <>
            <IconButton
              label={`Turn page ${page.index + 1} left`}
              disabled={disabled}
              onClick={() => turnPage(page.index, -90)}
            >
              <ArrowCounterClockwise size={15} />
            </IconButton>
            <IconButton
              label={`Turn page ${page.index + 1} right`}
              disabled={disabled}
              onClick={() => turnPage(page.index, 90)}
            >
              <ArrowClockwise size={15} />
            </IconButton>
          </>
        )}
      />
    </div>
  );
}

export const rotatePdf = defineTool<RotateOptions>({
  initialOptions: () => ({ pageCount: null, turns: {} }),
  Options: RotateOptionsPanel,
  blocker: (_files, options) => {
    if (options.pageCount === null) return "Reading the PDF…";
    return Object.values(options.turns).some((turn) => turn !== 0) ? null : "Turn at least one page.";
  },
  async process(files, options, { signal }) {
    const input = await readFile(files[0].file);
    const pages = Array.from({ length: options.pageCount ?? 0 }, (_, index) => ({
      index,
      rotate: options.turns[index] ?? 0,
    }));
    const bytes = await runPdfOp("rebuildPdf", [input, pages], signal);
    return [pdfOutput(`${stemOf(input.name)}-rotated.pdf`, bytes)];
  },
});
