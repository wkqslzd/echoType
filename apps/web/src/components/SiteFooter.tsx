import { Link } from 'react-router-dom';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto shrink-0 border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500 dark:border-serika-border dark:bg-serika-bg dark:text-serika-sub"
      data-testid="site-footer"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/privacy" className="underline hover:text-slate-800 dark:hover:text-serika-text">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/dennycgan/echoType"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-800 dark:hover:text-serika-text"
        >
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <span>© {year} echoType</span>
      </div>
    </footer>
  );
}
