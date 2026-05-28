import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CoursesPage } from './pages/CoursesPage';
import { TypingPage } from './pages/TypingPage';

export function App() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            EchoType
          </Link>
          <Link to="/courses" className="text-sm text-slate-600 hover:text-slate-900">
            Courses
          </Link>
          <span className="ml-auto text-xs text-slate-400">walking skeleton</span>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id/type" element={<TypingPage />} />
        </Routes>
      </main>
    </div>
  );
}
