"use client";

import { ArrowClockwise, ArrowLeft, ArrowRight, Trash } from "@phosphor-icons/react/dist/ssr";
import { LoadStatus } from "@/components/LoadStatus";
import { smallButtonClass } from "@/components/form";
import { allPages, IconButton, PageGrid, type GridPage } from "@/components/pdf/PageGrid";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { stemOf } from "@/lib/file-kinds";
import { moveItem } from "@/lib/move";
import { runPdfOp } from "@/lib/pdf/client";
import { addTurn } from "@/lib/pdf/types";
import { defineTool, type OptionsProps } from "@/tools/types";
import { pdfOutput, readFile } from "@/tools/client/shared";

interface OrganizeOptions {
  pageCount: number | null;
  /** The output's pages in order; null until something changes. */
  pages: GridPage[] | null;
}

function OrganizeOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<OrganizeOptions>) {
  const { doc, error } = usePdfDocument(files[0].file, (pageCount) =>
    setOptions((o) => ({ ...o, pageCount })),
  );
  if (!doc || options.pageCount === null) return <LoadStatus error={error} loading="Reading pages…" />;

  const pageCount = options.pageCount;
  const pages = options.pages ?? allPages(pageCount);
  const update = (change: (pages: GridPage[]) => GridPage[]) =>
    setOptions((o) => ({ ...o, pages: change(o.pages ?? allPages(pageCount)) }));
  const move = (from: number, to: number) => update((list) => moveItem(list, from, to));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={smallButtonClass}
          disabled={disabled || options.pages === null}
          onClick={() => setOptions((o) => ({ ...o, pages: null }))}
        >
          Reset
        </button>
        <p className="text-sm text-text-muted" aria-live="polite">
          Keeping {pages.length} of {pageCount} page{pageCount === 1 ? "" : "s"}. Drag pages to reorder them.
        </p>
      </div>
      <PageGrid
        doc={doc}
        pages={pages}
        label="Pages"
        disabled={disabled}
        onMove={move}
        actions={(page, position) => {
          const name = `page ${page.index + 1}`;
          return (
            <>
              <IconButton
                label={`Move ${name} earlier`}
                disabled={disabled || position === 0}
                onClick={() => move(position, position - 1)}
              >
                <ArrowLeft size={15} />
              </IconButton>
              <IconButton
                label={`Move ${name} later`}
                disabled={disabled || position === pages.length - 1}
                onClick={() => move(position, position + 1)}
              >
                <ArrowRight size={15} />
              </IconButton>
              <IconButton
                label={`Turn ${name} right`}
                disabled={disabled}
                onClick={() =>
                  update((list) =>
                    list.map((p) => (p.key === page.key ? { ...p, rotate: addTurn(p.rotate, 90) } : p)),
                  )
                }
              >
                <ArrowClockwise size={15} />
              </IconButton>
              <IconButton
                label={`Delete ${name}`}
                disabled={disabled}
                onClick={() => update((list) => list.filter((p) => p.key !== page.key))}
              >
                <Trash size={15} />
              </IconButton>
            </>
          );
        }}
      />
    </div>
  );
}

export const organizePdf = defineTool<OrganizeOptions>({
  initialOptions: () => ({ pageCount: null, pages: null }),
  Options: OrganizeOptionsPanel,
  blocker: (_files, { pageCount, pages }) => {
    if (pageCount === null) return "Reading the PDF…";
    if (pages === null) return "Move, turn, or delete pages first.";
    if (pages.length === 0) return "Keep at least one page.";
    return null;
  },
  async process(files, options, { signal }) {
    const input = await readFile(files[0].file);
    const pages = (options.pages ?? []).map(({ index, rotate }) => ({ index, rotate }));
    const bytes = await runPdfOp("rebuildPdf", [input, pages], signal);
    return [pdfOutput(`${stemOf(input.name)}-organized.pdf`, bytes)];
  },
});
