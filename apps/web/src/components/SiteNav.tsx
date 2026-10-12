"use client";

import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BrandMark, IconWell, pillPrimary, pillSizes } from "@/components/ui";
import { SITE } from "@/lib/site";
import { ToolIcon } from "@/tools/icons";
import { CATEGORIES, isAvailable, type ToolCategory, toolsByCategory } from "@/tools/registry";

const SECTION_LINKS: { category: ToolCategory; label: string }[] = [
  { category: "organize", label: "PDF" },
  { category: "image", label: "Images" },
  { category: "convert", label: "Convert" },
  { category: "optimize", label: "Optimize" },
];

/** Floating island navigation with a full-screen menu on small screens. */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 md:pt-5">
        <nav
          aria-label="Main"
          className="glass pointer-events-auto flex h-14 w-full max-w-[1100px] items-center justify-between gap-6 rounded-full py-1.5 pr-1.5 pl-4 md:w-max md:min-w-[760px]"
        >
          <Link href="/" onClick={close} className="flex items-center gap-2.5 rounded-full text-[17px] font-semibold tracking-tight">
            <BrandMark />
            {SITE.name}
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {SECTION_LINKS.map(({ category, label }) => (
              <li key={category}>
                <Link
                  href={`/#cat-${category}`}
                  className="rounded-full px-3.5 py-2 text-sm text-text-muted transition-colors duration-300 ease-fluid hover:bg-shell hover:text-text"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <Link href="/#tools" className={`${pillPrimary} ${pillSizes.sm}`}>
                All tools
                <IconWell icon={ArrowUpRight} size="sm" />
              </Link>
            </div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
              className="relative flex size-11 items-center justify-center rounded-full bg-shell shadow-[inset_0_0_0_1px_var(--hairline)] md:hidden"
            >
              <span
                aria-hidden="true"
                className={`absolute h-[1.5px] w-[18px] rounded-full bg-text transition-transform duration-500 ease-fluid ${
                  open ? "rotate-45" : "-translate-y-[4px]"
                }`}
              />
              <span
                aria-hidden="true"
                className={`absolute h-[1.5px] w-[18px] rounded-full bg-text transition-transform duration-500 ease-fluid ${
                  open ? "-rotate-45" : "translate-y-[4px]"
                }`}
              />
            </button>
          </div>
        </nav>
      </header>

      <div
        id={menuId}
        hidden={!open}
        className="fixed inset-0 z-30 overflow-y-auto bg-bg/95 px-4 pt-24 pb-12 backdrop-blur-2xl md:hidden"
      >
        <div className="flex flex-col gap-10">
          {toolsByCategory().map(({ category, tools }, groupIndex) => (
            <section key={category} aria-label={CATEGORIES[category].title}>
              <h2
                className="animate-rise mb-3 text-xs font-medium tracking-[0.16em] text-text-muted uppercase"
                style={{ animationDelay: `${80 + groupIndex * 70}ms` }}
              >
                {CATEGORIES[category].title}
              </h2>
              <ul className="flex flex-col">
                {tools.map((tool, i) => {
                  return (
                    <li
                      key={tool.slug}
                      className="animate-rise"
                      style={{ animationDelay: `${120 + groupIndex * 70 + i * 35}ms` }}
                    >
                      <Link
                        href={`/tools/${tool.slug}`}
                        onClick={close}
                        className="flex items-center gap-3 py-2 text-xl font-medium tracking-tight"
                      >
                        <ToolIcon slug={tool.slug} size={22} weight="light" className="text-accent" aria-hidden="true" />
                        {tool.title}
                        {!isAvailable(tool) && (
                          <span className="ml-auto rounded-full bg-shell px-2.5 py-0.5 text-xs font-normal tracking-normal text-text-muted">
                            Soon
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
