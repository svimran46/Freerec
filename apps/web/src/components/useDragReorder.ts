"use client";

import { useState, type DragEvent } from "react";

const DRAG_TYPE = "application/x-freerec-position";

/**
 * Drag-and-drop reordering for list items. Spread `itemProps(position)` on each
 * item. Pair it with move buttons: dragging needs a pointer, buttons don't.
 */
export function useDragReorder(onMove: ((from: number, to: number) => void) | undefined) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function reset() {
    setFrom(null);
    setOver(null);
  }

  function itemProps(position: number) {
    if (!onMove) return {};
    return {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(DRAG_TYPE, String(position));
        setFrom(position);
      },
      onDragOver: (event: DragEvent) => {
        if (from === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(position);
      },
      onDrop: (event: DragEvent) => {
        if (from === null) return;
        event.preventDefault();
        // Keep the drop from reaching an enclosing file dropzone.
        event.stopPropagation();
        if (from !== position) onMove(from, position);
        reset();
      },
      onDragEnd: reset,
    };
  }

  return { itemProps, dragging: from, over };
}
