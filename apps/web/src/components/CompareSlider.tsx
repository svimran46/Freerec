"use client";

import { useState } from "react";

interface CompareSliderProps {
  before: string;
  after: string;
  /** Width / height of the image, so the frame keeps its shape before it loads. */
  aspect: number;
}

/** Shows two versions of an image on top of each other with a draggable divider. */
export function CompareSlider({ before, after, aspect }: CompareSliderProps) {
  const [position, setPosition] = useState(50);
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-border bg-[repeating-conic-gradient(var(--surface-muted)_0_25%,var(--surface)_0_50%)] bg-[length:16px_16px]"
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
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${position}%` }} />
        <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Before</span>
        <span className="absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">After</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Compare before and after"
        onChange={(event) => setPosition(event.target.valueAsNumber)}
        className="mx-auto w-full max-w-xl accent-accent"
      />
    </div>
  );
}
