"use client";

import { Check } from "@phosphor-icons/react/dist/ssr";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReactNode } from "react";
import { useDragReorder } from "@/components/useDragReorder";
import { PageThumbnail } from "@/components/pdf/PageThumbnail";

/** A page in an output document: which source page it is and how far it is turned. */
export interface GridPage {
  /** Stable identity for React and drag-and-drop. */
  key: string;
  /** 0-based index in the source PDF. */
  index: number;
  /** Clockwise turn in degrees. */
  rotate: number;
}

export function allPages(pageCount: number): GridPage[] {
  return Array.from({ length: pageCount }, (_, index) => ({ key: `p${index}`, index, rotate: 0 }));
}

interface PageGridProps {
  doc: PDFDocumentProxy;
  pages: readonly GridPage[];
  label: string;
  disabled?: boolean;
  /** Makes each page a toggle button. */
  selection?: { isSelected: (page: GridPage) => boolean; onToggle: (page: GridPage) => void };
  /** Enables drag-and-drop reordering. */
  onMove?: (from: number, to: number) => void;
  /** Buttons shown under each page. */
  actions?: (page: GridPage, position: number) => ReactNode;
}

export function PageGrid({ doc, pages, label, disabled, selection, onMove, actions }: PageGridProps) {
  const { itemProps, dragging, over } = useDragReorder(disabled ? undefined : onMove);

  return (
    <ol aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
      {pages.map((page, position) => {
        const selected = selection?.isSelected(page) ?? false;
        const thumbnail = <PageThumbnail doc={doc} index={page.index} rotate={page.rotate} />;
        return (
          <li
            key={page.key}
            {...itemProps(position)}
            className={`flex flex-col items-center gap-2 rounded-[1.25rem] p-2.5 transition-[background-color,box-shadow,opacity,transform] duration-300 ease-fluid ${
              selected || over === position
                ? "bg-accent-soft shadow-[0_0_0_2px_var(--accent)]"
                : "bg-shell shadow-[inset_0_0_0_1px_var(--hairline)]"
            } ${over === position && !selected ? "scale-[1.02]" : ""} ${dragging === position ? "opacity-40" : ""} ${
              onMove && !disabled ? "cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {selection ? (
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Page ${page.index + 1}`}
                disabled={disabled}
                onClick={() => selection.onToggle(page)}
                className="relative rounded-xl focus-visible:outline-2 focus-visible:outline-accent"
              >
                {thumbnail}
                <span
                  aria-hidden="true"
                  className={`absolute top-1 right-1 flex size-6 items-center justify-center rounded-full transition-[background-color,transform] duration-300 ease-fluid ${
                    selected
                      ? "scale-100 bg-accent text-on-accent"
                      : "scale-90 bg-surface shadow-[inset_0_0_0_1px_var(--border)]"
                  }`}
                >
                  {selected && <Check size={13} weight="bold" />}
                </span>
              </button>
            ) : (
              thumbnail
            )}
            <span className="font-mono text-[11px] text-text-muted">Page {page.index + 1}</span>
            {actions && <div className="flex flex-wrap justify-center gap-1">{actions(page, position)}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full bg-surface text-text-muted shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)] transition-[background-color,color,transform] duration-300 ease-fluid hover:bg-surface-muted hover:text-text active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
