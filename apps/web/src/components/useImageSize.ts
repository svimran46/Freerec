"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { probeImage } from "@/lib/image/client";
import type { Size } from "@/lib/image/geometry";
import type { AcceptedFile } from "@/lib/validate-files";

interface State {
  id: string;
  size: Size | null;
  error: string | null;
}

/** Reads an image's pixel size in a worker. `onLoad` receives it once known. */
export function useImageSize(item: AcceptedFile, onLoad?: (size: Size) => void) {
  const [state, setState] = useState<State | null>(null);
  const loaded = useEffectEvent((size: Size) => onLoad?.(size));

  useEffect(() => {
    const controller = new AbortController();
    probeImage(item, controller.signal).then(
      (size) => {
        setState({ id: item.id, size, error: null });
        loaded(size);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ id: item.id, size: null, error: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => controller.abort();
  }, [item]);

  return state?.id === item.id ? state : { id: item.id, size: null, error: null };
}
