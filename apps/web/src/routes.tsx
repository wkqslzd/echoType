import { Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RootLayout } from './RootLayout';
import { GuestOnly } from './auth/GuestOnly';
import { HomePage } from './pages/HomePage';
import { CourseListPage } from './pages/CourseListPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { TypingPage } from './pages/TypingPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { RequireAuth } from './auth/RequireAuth';
import { AccountPage } from './pages/AccountPage';
import { NotFoundPage } from './components/page-status/NotFoundPage';
import { SentryRouteError } from './components/SentryRouteError';
import { PrivacyPage } from './pages/legal/PrivacyPage';

export const router = [
  {
    element: <RootLayout />,
    errorElement: <SentryRouteError />,
    children: [
      {
        path: '/login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        path: '/register',
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
      },
      {
        path: '/verify-email',
        element: <VerifyEmailPage />,
      },
      {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
      },
      {
        path: '/forgot-password',
        element: (
          <GuestOnly>
            <ForgotPasswordPage />
          </GuestOnly>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <GuestOnly>
            <ResetPasswordPage />
          </GuestOnly>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/courses', element: <Navigate to="/" replace /> },
          {
            path: '/courses/short/collections/:collectionId',
            element: <CollectionDetailPage courseMode="SHORT" />,
          },
          {
            path: '/courses/article/collections/:collectionId',
            element: <CollectionDetailPage courseMode="ARTICLE" />,
          },
          { path: '/courses/short', element: <CourseListPage courseMode="SHORT" /> },
          { path: '/courses/article', element: <CourseListPage courseMode="ARTICLE" /> },
          { path: '/courses/:id/type', element: <TypingPage /> },
          {
            path: '/account',
            element: (
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            ),
          },
          { path: '/privacy', element: <PrivacyPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
