import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
 * Pill buttons with a nested icon well ("button in button"). The well shifts
 * on hover and the whole pill dips on press, so actions feel physical.
 */

const pillBase =
  "group inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-full font-medium " +
  "transition-[transform,background-color,box-shadow,color] duration-500 ease-fluid " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

export const pillPrimary =
  `${pillBase} bg-accent text-on-accent hover:bg-accent-strong ` +
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-12px_rgb(var(--shadow-tint)/0.55)]";

export const pillSecondary =
  `${pillBase} bg-surface text-text hover:bg-surface-muted ` +
  "shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)]";

export const pillSizes = {
  md: "h-12 pl-6 pr-1.5 text-[15px]",
  sm: "h-10 pl-4 pr-1 text-sm",
  plain: "h-11 px-5 text-sm",
} as const;

const wellBase =
  "flex shrink-0 items-center justify-center rounded-full transition-transform duration-500 ease-fluid " +
  "group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105";

export function IconWell({
  icon: Glyph,
  tone = "primary",
  size = "md",
}: {
  icon: Icon;
  tone?: "primary" | "secondary";
  size?: "md" | "sm";
}) {
  return (
    <span
      aria-hidden="true"
      className={`${wellBase} ${size === "md" ? "size-9" : "size-8"} ${
        tone === "primary" ? "bg-on-accent/15" : "bg-shell shadow-[inset_0_0_0_1px_var(--hairline)]"
      }`}
    >
      <Glyph size={size === "md" ? 17 : 15} weight="regular" />
    </span>
  );
}

interface PillLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
  icon?: Icon;
  tone?: "primary" | "secondary";
  size?: "md" | "sm";
  children: ReactNode;
}

export function PillLink({ icon, tone = "primary", size = "md", children, ...props }: PillLinkProps) {
  return (
    <Link
      {...props}
      className={`${tone === "primary" ? pillPrimary : pillSecondary} ${icon ? pillSizes[size] : pillSizes.plain}`}
    >
      {children}
      {icon && <IconWell icon={icon} tone={tone} size={size} />}
    </Link>
  );
}

/** Small uppercase label above a heading. Used sparingly: at most one per three sections. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-shell px-3 py-1 text-[10.5px] font-medium tracking-[0.18em] text-text-muted uppercase shadow-[inset_0_0_0_1px_var(--hairline)]">
      {children}
    </span>
  );
}

/** The Freerec mark: two offset pages. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[9px] bg-accent text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none">
        <rect x="7.5" y="3.5" width="11" height="14" rx="2.5" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" />
        <rect x="4.5" y="6.5" width="11" height="14" rx="2.5" fill="currentColor" />
      </svg>
    </span>
  );
}
