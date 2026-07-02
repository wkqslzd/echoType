import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCOUNT_DELETED_FLASH } from '../auth/accountDelete';

export function HomePage() {
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const message = sessionStorage.getItem('echotype.auth.flash');
    if (!message) return;
    sessionStorage.removeItem('echotype.auth.flash');
    setFlash(message);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to EchoType</h1>
        <p className="mt-2 text-slate-600">
          Repeat, type, and remember meaningful texts with your own annotated notes.
        </p>
        {flash && (
          <p className="mt-3 text-sm text-green-700" data-testid="home-auth-flash">
            {flash}
          </p>
        )}
        {flash === ACCOUNT_DELETED_FLASH && (
          <p className="mt-2 text-sm text-slate-600">
            <Link to="/register" className="text-slate-900 underline">
              Create a new account
            </Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/courses/short"
          className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-slate-900">Short mode</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quotes, short poems, and self-contained passages you want to repeat quickly.
          </p>
        </Link>
        <Link
          to="/courses/article"
          className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-slate-900">Article mode</h2>
          <p className="mt-2 text-sm text-slate-600">
            Full speeches, essays, and longer passages for sustained practice.
          </p>
        </Link>
      </div>
    </div>
  );
}
