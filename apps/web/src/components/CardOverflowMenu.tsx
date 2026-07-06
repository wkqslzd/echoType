import { useEffect, useId, useRef, useState } from 'react';

export type OverflowMenuTrigger = HTMLButtonElement;

export type OverflowMenuItem = {
  label: string;
  onClick: (ctx?: { trigger: OverflowMenuTrigger }) => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
};

type CardOverflowMenuProps = {
  items: OverflowMenuItem[];
  ariaLabel: string;
  onOpenChange?: (open: boolean) => void;
};

export function CardOverflowMenu({ items, ariaLabel, onOpenChange }: CardOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-44 rounded-md border bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                const trigger = triggerRef.current;
                setOpen(false);
                item.onClick(trigger ? { trigger } : undefined);
              }}
              className={`block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                item.variant === 'danger'
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
