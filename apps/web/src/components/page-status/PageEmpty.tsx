import type { ReactNode } from 'react';

type PageEmptyProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageEmpty({ title, description, action }: PageEmptyProps) {
  return (
    <div
      className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-serika-border dark:bg-serika-surface"
      data-testid="page-empty"
    >
      <h2 className="text-base font-medium text-slate-900 dark:text-serika-text">{title}</h2>
      {description && <p className="mt-2 text-sm text-slate-600 dark:text-serika-sub">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
