"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useEffectEvent, useState } from "react";
import { closePdf, openPdf } from "@/lib/pdf/render";

interface State {
  file: File;
  doc: PDFDocumentProxy | null;
  error: string | null;
}

/**
 * Opens a PDF with pdf.js for previews, and closes it when the file changes or
 * the component unmounts. `onLoad` receives the page count once it is known.
 */
export function usePdfDocument(file: File, onLoad?: (pageCount: number) => void) {
  const [state, setState] = useState<State | null>(null);
  const loaded = useEffectEvent((pageCount: number) => onLoad?.(pageCount));

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    openPdf(file).then(
      (doc) => {
        if (cancelled) {
          void closePdf(doc);
          return;
        }
        opened = doc;
        setState({ file, doc, error: null });
        loaded(doc.numPages);
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({ file, doc: null, error: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => {
      cancelled = true;
      if (opened) void closePdf(opened);
    };
  }, [file]);

  return state?.file === file ? state : { file, doc: null, error: null };
}
