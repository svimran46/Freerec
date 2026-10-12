"use client";

import { ArrowUpRight, Cloud, Laptop, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FILE_KINDS } from "@/lib/file-kinds";
import { CATEGORY_ICONS, ToolIcon } from "@/tools/icons";
import {
  CATEGORIES,
  isAvailable,
  type ToolCategory,
  type ToolDefinition,
  toolsByCategory,
} from "@/tools/registry";

/*
 * Bento layout: each category gets a cell sized to its content, with its own
 * surface so the grid has rhythm (tint, transparency checkerboard, plain,
 * compression rings).
 */
const CELLS: Record<ToolCategory, { span: string; surface: string; columns: string }> = {
  organize: {
    span: "lg:col-span-7",
    surface:
      "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_60%),var(--surface)]",
    columns: "sm:grid-cols-2",
  },
  image: {
    span: "lg:col-span-5",
    surface:
      "bg-[linear-gradient(var(--surface),color-mix(in_oklab,var(--surface)_82%,transparent)),repeating-conic-gradient(var(--surface-muted)_0_25%,var(--surface)_0_50%)] bg-[length:auto,22px_22px]",
    columns: "",
  },
  convert: {
    span: "lg:col-span-8",
    surface: "bg-surface",
    columns: "sm:grid-cols-2",
  },
  optimize: {
    span: "lg:col-span-4",
    surface:
      "bg-[repeating-radial-gradient(circle_at_92%_105%,transparent_0_22px,color-mix(in_oklab,var(--accent)_16%,transparent)_22px_23px),var(--surface)]",
    columns: "",
  },
};

function matches(tool: ToolDefinition, query: string): boolean {
  if (!query) return true;
  const haystack = [
    tool.title,
    tool.summary,
    CATEGORIES[tool.category].title,
    ...tool.accepts.map((kind) => FILE_KINDS[kind].label),
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function ToolRow({ tool }: { tool: ToolDefinition }) {
  const ready = isAvailable(tool);
  return (
    <li>
      <Link
        href={`/tools/${tool.slug}`}
        className="group flex h-full items-start gap-3.5 rounded-2xl p-3 transition-[background-color,transform] duration-500 ease-fluid hover:bg-shell active:scale-[0.99]"
      >
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] shadow-[inset_0_0_0_1px_var(--hairline)] transition-transform duration-500 ease-fluid group-hover:-rotate-3 group-hover:scale-105 ${
            ready ? "bg-accent-soft text-accent" : "bg-shell text-text-muted"
          }`}
        >
          <ToolIcon slug={tool.slug} size={22} weight="light" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 font-medium tracking-tight">
            {tool.title}
            {!ready && (
              <span className="rounded-full bg-shell px-2 py-px text-[11px] font-normal text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)]">
                Soon
              </span>
            )}
          </span>
          <span className="text-sm leading-snug text-text-muted">{tool.summary}</span>
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-2 text-text-muted">
          {tool.runtime === "client" ? (
            <Laptop size={15} role="img" aria-label="Runs on your device" />
          ) : (
            <Cloud size={15} role="img" aria-label="Runs on our servers" />
          )}
          <ArrowUpRight
            size={15}
            aria-hidden="true"
            className="transition-transform duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text"
          />
        </span>
      </Link>
    </li>
  );
}

export function ToolDirectory() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const groups = useMemo(
    () =>
      toolsByCategory().map(({ category, tools }) => ({
        category,
        tools: tools.filter((tool) => matches(tool, query.trim())),
      })),
    [query],
  );
  const total = groups.reduce((sum, group) => sum + group.tools.length, 0);

  // "/" jumps to the search field, as on most tool directories.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-md flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          Find a tool
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="compress, HEIC, Word"
            className="h-12 w-full rounded-full bg-surface pr-12 pl-11 text-[15px] text-text shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)] transition-shadow duration-300 ease-fluid placeholder:text-text-muted/80 focus-visible:shadow-[0_0_0_2px_var(--accent)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-shell hover:text-text"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md bg-shell px-2 py-0.5 font-mono text-xs text-text-muted shadow-[inset_0_0_0_1px_var(--hairline)] sm:block">
              /
            </kbd>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {query ? `${total} tool${total === 1 ? "" : "s"} found` : ""}
        </p>
      </div>

      {total === 0 ? (
        <div className="bezel">
          <div className="bezel-core flex flex-col items-start gap-3 px-6 py-12 md:px-10">
            <p className="text-lg font-medium tracking-tight">No tool matches “{query.trim()}”.</p>
            <p className="max-w-[52ch] text-sm text-text-muted">
              Try a format such as PDF or HEIC, or an action such as merge, resize or convert.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 rounded-full bg-shell px-4 py-2 text-sm shadow-[inset_0_0_0_1px_var(--hairline)] hover:bg-surface-muted"
            >
              Show all tools
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {groups.map(({ category, tools }) => {
            if (tools.length === 0) return null;
            const cell = CELLS[category];
            const CategoryGlyph = CATEGORY_ICONS[category];
            const ready = tools.filter(isAvailable).length;
            return (
              <section
                key={category}
                id={`cat-${category}`}
                aria-labelledby={`cat-${category}-title`}
                className={`bezel ${query ? "lg:col-span-12" : cell.span}`}
              >
                <div className={`bezel-core relative flex h-full flex-col gap-5 overflow-hidden p-3 sm:p-4 ${cell.surface}`}>
                  <header className="flex items-start justify-between gap-4 px-3 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <h3 id={`cat-${category}-title`} className="text-2xl font-semibold tracking-tight">
                        {CATEGORIES[category].title}
                      </h3>
                      <p className="max-w-[40ch] text-sm text-text-muted">{CATEGORIES[category].blurb}</p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline),0_10px_20px_-14px_rgb(var(--shadow-tint)/0.4)]"
                    >
                      <CategoryGlyph size={24} weight="light" />
                    </span>
                  </header>
                  <ul className={`grid grid-cols-1 gap-1 ${query ? "sm:grid-cols-2 lg:grid-cols-3" : cell.columns}`}>
                    {tools.map((tool) => (
                      <ToolRow key={tool.slug} tool={tool} />
                    ))}
                  </ul>
                  {category === "optimize" && ready === 0 && !query && (
                    <p className="mt-auto px-3 pb-2 text-sm text-text-muted">
                      PDF compression arrives with the server tools.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
