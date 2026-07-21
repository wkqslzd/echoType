type InfoTooltipProps = {
  ariaLabel: string;
  /** `top` opens above the icon (e.g. stats bar near viewport bottom). */
  placement: 'top' | 'bottom';
  /** `end` right-aligns the panel to the icon (for icons near the right edge). */
  align?: 'center' | 'end';
  /** `sm` shrinks the trigger for inline use beside text links. */
  size?: 'default' | 'sm';
  panelClassName?: string;
  children: React.ReactNode;
};

function CircleInfoIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={className}>
      <circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <text
        x="6"
        y="6"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7"
        fontWeight="600"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        i
      </text>
    </svg>
  );
}

/** Hover/focus tooltip anchored to a circular ⓘ button. */
export function InfoTooltip({
  ariaLabel,
  placement,
  align = 'center',
  size = 'default',
  panelClassName = 'w-64',
  children,
}: InfoTooltipProps) {
  const placementClass = placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const alignClass = align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const triggerSizeClass =
    size === 'sm' ? 'h-3 w-3 min-h-0 min-w-0' : 'h-[1em] w-[1em] min-h-[14px] min-w-[14px]';
  const iconSizeClass =
    size === 'sm'
      ? 'h-2.5 w-2.5 shrink-0 text-slate-500 dark:text-serika-sub'
      : 'h-[0.85em] w-[0.85em] shrink-0 text-slate-500 dark:text-serika-sub';

  return (
    <span className="group/info-tooltip relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 ${triggerSizeClass}`}
      >
        <CircleInfoIcon className={iconSizeClass} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-20 hidden rounded-md border border-slate-200 bg-white p-2 text-xs font-normal leading-snug text-slate-500 shadow-md group-hover/info-tooltip:block group-focus-within/info-tooltip:block dark:border-serika-border dark:bg-serika-surface dark:text-serika-sub ${alignClass} ${placementClass} ${panelClassName}`}
      >
        {children}
      </span>
    </span>
  );
}
