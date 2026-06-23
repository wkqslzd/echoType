import { DESCRIPTION_MAX } from '@echotype/shared';

type OptionalDescriptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Reusable optional description textarea (Course Step 1; Phase 5 album). */
export function OptionalDescriptionField({ value, onChange }: OptionalDescriptionFieldProps) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">Description (optional)</span>
      <textarea
        className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={DESCRIPTION_MAX}
        placeholder="Background, source, or cultural notes…"
      />
      <p className="mt-1 text-xs text-slate-400">
        Plain text; URLs become clickable links on the typing page. {value.length}/{DESCRIPTION_MAX}
      </p>
    </label>
  );
}
