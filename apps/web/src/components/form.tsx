import type { ReactNode } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** A row of mutually exclusive options shown as pills. */
export function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  choices,
  onChange,
  disabled,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="mb-2.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="cursor-pointer rounded-full bg-surface px-4 py-2 text-sm shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)] transition-[background-color,color,box-shadow,transform] duration-300 ease-fluid select-none hover:bg-surface-muted active:scale-[0.97] has-checked:bg-accent has-checked:text-on-accent has-checked:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_6px_16px_-8px_rgb(var(--shadow-tint)/0.5)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="leading-relaxed text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 rounded-[14px] bg-surface px-4 text-base text-text shadow-[inset_0_1px_2px_rgb(var(--shadow-tint)/0.06),0_0_0_1px_var(--border)] " +
  "transition-shadow duration-300 ease-fluid placeholder:text-text-muted/80 " +
  "focus-visible:shadow-[0_0_0_2px_var(--accent)] focus-visible:outline-none disabled:opacity-60";

export const smallButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-sm shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline)] " +
  "transition-[background-color,transform] duration-300 ease-fluid hover:bg-surface-muted active:scale-[0.97] " +
  "disabled:cursor-not-allowed disabled:opacity-50";
