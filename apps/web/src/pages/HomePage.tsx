import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to EchoType</h1>
      <p className="text-slate-600">
        Repeat, type, and remember meaningful English texts. This walking skeleton ships the
        end-to-end loop: create a course, type it, persist the session.
      </p>
      <Link
        to="/courses"
        className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Go to courses
      </Link>
    </div>
  );
}
