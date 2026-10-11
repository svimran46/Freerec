"use client";

import { useId, useRef, useState, type DragEvent } from "react";

interface DropzoneProps {
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  hint: string;
  onFiles: (files: File[]) => void;
}

export function Dropzone({ accept, multiple, disabled, hint, onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
        dragging ? "border-accent bg-accent-soft" : "border-border bg-surface"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed dark:text-bg"
      >
        {multiple ? "Choose files" : "Choose a file"}
      </button>
      <p id={hintId} className="text-sm text-text-muted">
        or drop {multiple ? "them" : "it"} here · {hint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        data-testid="file-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}
