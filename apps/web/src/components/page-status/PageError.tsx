type PageErrorProps = {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  homeHref?: string;
};

export function PageError({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  homeHref = '/',
}: PageErrorProps) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 px-4 py-6 dark:border-red-900 dark:bg-red-950/40"
      data-testid="page-error"
      role="alert"
    >
      <h2 className="text-base font-medium text-red-900 dark:text-red-200">{title}</h2>
      <p className="mt-2 text-sm text-red-800 dark:text-red-300">{description}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {retryLabel}
          </button>
        )}
        <a href={homeHref} className="text-sm text-red-900 underline hover:text-red-950 dark:text-red-200 dark:hover:text-red-100">
          Back to home
        </a>
      </div>
    </div>
  );
}
