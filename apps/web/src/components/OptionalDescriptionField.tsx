import { DESCRIPTION_MAX } from '@echotype/shared';

type OptionalDescriptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
};

/** Reusable optional description textarea (Course Step 1; Collection editor). */
export function OptionalDescriptionField({
  value,
  onChange,
  label = 'Description (optional)',
  placeholder = 'Background, source, or cultural notes…',
  hint = 'Plain text; URLs become clickable links on the typing page.',
}: OptionalDescriptionFieldProps) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600 dark:text-serika-sub">{label}</span>
      <textarea
        className="mt-1 h-24 w-full rounded border px-3 py-2 text-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={DESCRIPTION_MAX}
        placeholder={placeholder}
      />
      <p className="mt-1 text-xs text-slate-400 dark:text-serika-sub">
        {hint} {value.length}/{DESCRIPTION_MAX}
      </p>
    </label>
  );
}
