import { useQuery } from '@tanstack/react-query';
import { formatPracticeSummaryLine } from '@echotype/shared';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';

const SUMMARY_TEXT_CLASS = 'text-center text-sm text-slate-600';

export function PracticeSummary() {
  const { status } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ['stats', 'summary'],
    queryFn: () => api.getPracticeSummary(),
    enabled: status === 'authed',
    staleTime: 30_000,
  });

  if (status === 'loading') {
    return null;
  }

  if (status === 'guest') {
    return (
      <p className={SUMMARY_TEXT_CLASS} data-testid="practice-summary-guest">
        Sign in to track your practice.
      </p>
    );
  }

  if (isPending || isError) {
    return null;
  }

  if (!data.hasSessions) {
    return (
      <p className={SUMMARY_TEXT_CLASS} data-testid="practice-summary-empty">
        Your record starts with your first saved session.
      </p>
    );
  }

  return (
    <p className={SUMMARY_TEXT_CLASS} data-testid="practice-summary-line">
      {formatPracticeSummaryLine({
        totalDurationSec: data.totalDurationSec,
        totalCompletedPasses: data.totalCompletedPasses,
        lastSavedAt: data.lastSavedAt!,
      })}
    </p>
  );
}
