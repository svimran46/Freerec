import { ChoiceGroup, Field } from "@/components/form";
import type { OutputFile } from "@/lib/download";
import { formatBytes } from "@/lib/format";
import { OUTPUT_FORMATS, type FormatChoice, type OutputFormat } from "@/lib/image/formats";
import type { ProcessResult } from "@/lib/image/types";

export function imageOutput(name: string, format: OutputFormat, result: ProcessResult, original: File): OutputFile {
  const data = new Blob([result.bytes], { type: OUTPUT_FORMATS[format].mime });
  return { name, data, detail: `${result.size.width} × ${result.size.height} · ${sizeChange(original.size, data.size)}` };
}

/** "120 KB, 64% smaller" or "1.2 MB, 30% larger". */
export function sizeChange(before: number, after: number): string {
  const change = Math.round((1 - after / before) * 100);
  if (change === 0) return `${formatBytes(after)}, about the same size`;
  return `${formatBytes(after)}, ${Math.abs(change)}% ${change > 0 ? "smaller" : "larger"}`;
}

const FORMAT_CHOICES = (Object.keys(OUTPUT_FORMATS) as OutputFormat[]).map((value) => ({
  value,
  label: OUTPUT_FORMATS[value].label,
}));

export function FormatPicker<T extends FormatChoice>({
  value,
  onChange,
  disabled,
  allowKeep,
  name = "output-format",
}: {
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  allowKeep: boolean;
  name?: string;
}) {
  const choices = [...(allowKeep ? [{ value: "keep", label: "Same as original" }] : []), ...FORMAT_CHOICES];
  return (
    <ChoiceGroup
      legend="Format"
      name={name}
      value={value}
      disabled={disabled}
      choices={choices as { value: T; label: string }[]}
      onChange={onChange}
    />
  );
}

export function QualitySlider({
  value,
  onChange,
  disabled,
  hint = "Lower quality makes smaller files.",
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <Field label={`Quality: ${value}`} hint={hint}>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="max-w-sm accent-accent"
      />
    </Field>
  );
}
