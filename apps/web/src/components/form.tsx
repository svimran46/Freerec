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
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent-strong has-focus-visible:outline-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-60"
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
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-base text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60";

export const smallButtonClass =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";
