"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

interface CompareSliderProps {
  before: string;
  after: string;
  /** Width / height of the image, so the frame keeps its shape before it loads. */
  aspect: number;
}

const tag = "absolute top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white";

/** Shows two versions of an image on top of each other with a draggable divider. */
export function CompareSlider({ before, after, aspect }: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  return (
    <div className="flex flex-col gap-3">
      <div className="bezel mx-auto w-full max-w-xl">
        <div
          className="relative overflow-hidden rounded-[var(--radius-core)] bg-[repeating-conic-gradient(var(--surface-muted)_0_25%,var(--surface)_0_50%)] bg-[length:16px_16px] shadow-[0_0_0_1px_var(--hairline)]"
          style={{ aspectRatio: aspect }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
          <img src={after} alt="After" className="absolute inset-0 size-full object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
          <img
            src={before}
            alt="Before"
            className="absolute inset-0 size-full object-contain"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          />
          <div aria-hidden="true" className="absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" style={{ left: `${position}%` }}>
            <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-700 shadow-[0_6px_18px_-6px_rgb(0_0_0/0.5)]">
              <CaretLeft size={12} weight="bold" />
              <CaretRight size={12} weight="bold" />
            </span>
          </div>
          <span aria-hidden="true" className={`${tag} left-3`}>
            Before
          </span>
          <span aria-hidden="true" className={`${tag} right-3`}>
            After
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Compare before and after"
        onChange={(event) => setPosition(event.target.valueAsNumber)}
        className="mx-auto w-full max-w-xl"
      />
    </div>
  );
}
