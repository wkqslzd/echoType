import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { api } from '../lib/api';

/** Authed users with unresolved onboarding hook POST /api/onboarding/seed once per mount. */
export function useOnboardingSeed() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const attemptedRef = useRef(false);

  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: () => api.getAccount(),
    enabled: status === 'authed',
    staleTime: 30_000,
  });

  useEffect(() => {
    if (status !== 'authed' || !account || account.onboardingSeededAt !== null) {
      return;
    }
    if (attemptedRef.current) {
      return;
    }
    attemptedRef.current = true;

    void (async () => {
      try {
        await api.seedOnboarding();
        await queryClient.invalidateQueries({ queryKey: ['account'] });
        await queryClient.invalidateQueries({ queryKey: ['courses'] });
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
      } catch {
        attemptedRef.current = false;
      }
    })();
  }, [status, account, queryClient]);
}
