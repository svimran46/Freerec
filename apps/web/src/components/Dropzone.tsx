"use client";

import { ArrowsClockwise, Plus, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { useId, useRef, useState, type DragEvent } from "react";
import { IconWell, pillPrimary, pillSecondary, pillSizes } from "@/components/ui";

interface DropzoneProps {
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  hint: string;
  onFiles: (files: File[]) => void;
  /** Files are already chosen: show a slim bar for adding or replacing. */
  compact?: boolean;
}

export function Dropzone({ accept, multiple, disabled, hint, onFiles, compact = false }: DropzoneProps) {
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

  const label = compact ? (multiple ? "Add more files" : "Replace file") : multiple ? "Choose files" : "Choose a file";

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={handleDrop}
      className={`bezel transition-[transform,opacity] duration-700 ease-fluid ${dragging ? "scale-[1.01]" : ""} ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="bezel-core p-2">
        <div
          className={`flex rounded-[1.0625rem] border border-dashed transition-colors duration-500 ease-fluid ${
            dragging ? "border-accent bg-accent-soft/60" : "border-border"
          } ${
            compact
              ? "flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center"
              : "flex-col items-center gap-5 px-6 py-12 text-center sm:py-16"
          }`}
        >
          {!compact && (
            <span
              aria-hidden="true"
              className={`flex size-16 items-center justify-center rounded-[1.25rem] bg-accent-soft text-accent transition-transform duration-700 ease-fluid ${
                dragging ? "-translate-y-1 scale-110" : ""
              }`}
            >
              <UploadSimple size={30} weight="light" />
            </span>
          )}
          <button
            type="button"
            disabled={disabled}
            aria-describedby={hintId}
            onClick={() => inputRef.current?.click()}
            className={compact ? `${pillSecondary} ${pillSizes.sm}` : `${pillPrimary} ${pillSizes.md}`}
          >
            {label}
            <IconWell
              icon={compact && !multiple ? ArrowsClockwise : Plus}
              tone={compact ? "secondary" : "primary"}
              size={compact ? "sm" : "md"}
            />
          </button>
          <p id={hintId} className={`text-sm text-text-muted ${compact ? "" : "max-w-[44ch]"}`}>
            or drop {multiple ? "them" : "it"} here · {hint}
          </p>
        </div>
      </div>
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
