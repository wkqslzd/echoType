import { Link, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
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
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
