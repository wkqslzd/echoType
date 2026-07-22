import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-8 text-center" data-testid="not-found-page">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-serika-text">Page not found</h1>
      <p className="text-sm text-slate-600 dark:text-serika-sub">We could not find that page. Check the URL or go back home.</p>
      <Link to="/" className="inline-block text-sm text-amber-900 underline hover:text-amber-950 dark:text-serika-main dark:hover:text-serika-main">
        Back to home
      </Link>
    </div>
  );
}
