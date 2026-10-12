"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { releaseCanvas } from "@/lib/canvas";
import { renderPage } from "@/lib/pdf/render";

/** Thumbnails are drawn to fit a square of this many CSS pixels. */
export const THUMBNAIL_SIZE = 128;

const MAX_PARALLEL_RENDERS = 3;
let active = 0;
const waiting: (() => void)[] = [];

/** Limits how many thumbnails render at once so a long PDF doesn't swamp the browser. */
async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL_RENDERS) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

interface PageThumbnailProps {
  doc: PDFDocumentProxy;
  /** 0-based page index. */
  index: number;
  /** Clockwise turn to show, in degrees. */
  rotate?: number;
}

/** A page preview that renders once it scrolls into view. */
export function PageThumbnail({ doc, index, rotate = 0 }: PageThumbnailProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"waiting" | "ready" | "failed">("waiting");

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const controller = new AbortController();
    let canvas: HTMLCanvasElement | null = null;

    const draw = () =>
      inTurn(async () => {
        if (controller.signal.aborted) return;
        const page = await doc.getPage(index + 1);
        const base = page.getViewport({ scale: 1 });
        const ratio = window.devicePixelRatio || 1;
        const scale = (THUMBNAIL_SIZE * ratio) / Math.max(base.width, base.height);
        canvas = await renderPage(page, { scale, signal: controller.signal });
        if (controller.signal.aborted) return;
        canvas.style.width = `${canvas.width / ratio}px`;
        canvas.style.height = `${canvas.height / ratio}px`;
        canvas.className = "rounded-[3px] bg-white shadow-[0_6px_14px_-8px_rgb(var(--shadow-tint)/0.45),0_0_0_1px_var(--hairline)]";
        element.append(canvas);
        setState("ready");
      }).catch(() => {
        if (!controller.signal.aborted) setState("failed");
      });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      void draw();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            void draw();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(element);
    }

    return () => {
      controller.abort();
      observer?.disconnect();
      if (canvas) {
        canvas.remove();
        releaseCanvas(canvas);
      }
    };
  }, [doc, index]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
    >
      <div
        ref={holder}
        className="flex items-center justify-center transition-transform duration-500 ease-fluid"
        style={{ transform: `rotate(${rotate}deg)` }}
      />
      {state !== "ready" && (
        <span
          aria-hidden="true"
          className={`absolute inset-3 flex items-center justify-center rounded-md bg-surface-muted text-xs text-text-muted ${
            state === "waiting" ? "animate-pulse" : ""
          }`}
        >
          {state === "failed" ? "No preview" : ""}
        </span>
      )}
    </div>
  );
}
