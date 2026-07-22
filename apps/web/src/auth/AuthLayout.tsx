import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-serika-bg">
      <SiteHeader className="shrink-0" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-lg border bg-white p-6 shadow-sm dark:border-serika-border dark:bg-serika-surface dark:text-serika-text">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
