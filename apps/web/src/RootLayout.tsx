import { Outlet } from 'react-router-dom';
import { DocumentDarkProvider } from './lib/DocumentDarkProvider';

/** Pathless root: single DocumentDark writer for AppLayout + Auth routes. */
export function RootLayout() {
  return (
    <DocumentDarkProvider>
      <Outlet />
    </DocumentDarkProvider>
  );
}
