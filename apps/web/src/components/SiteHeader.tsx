import { Link } from 'react-router-dom';

type SiteHeaderProps = {
  trailing?: React.ReactNode;
  className?: string;
};

/** EchoType / Short / Article — shared across AppLayout and auth pages. */
export function SiteHeader({ trailing, className }: SiteHeaderProps) {
  return (
    <header className={`border-b bg-white${className ? ` ${className}` : ''}`}>
      <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-semibold">
          EchoType
        </Link>
        <Link to="/courses/short" className="text-sm text-slate-600 hover:text-slate-900">
          Short
        </Link>
        <Link to="/courses/article" className="text-sm text-slate-600 hover:text-slate-900">
          Article
        </Link>
        {trailing ? <div className="ml-auto flex items-center gap-3">{trailing}</div> : null}
      </nav>
    </header>
  );
}
