import { useQuery } from '@tanstack/react-query';
import { formatPracticeSummaryLines } from '@echotype/shared';
import { useAuth } from '../auth/AuthProvider';
import { InfoTooltip } from './InfoTooltip';
import { api } from '../lib/api';

const SUMMARY_TEXT_CLASS = 'text-center text-lg font-semibold text-slate-900 dark:text-serika-text';

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

  const { line1, line2 } = formatPracticeSummaryLines({
    totalDurationSec: data.totalDurationSec,
    totalCompletedPasses: data.totalCompletedPasses,
    lastSavedAt: data.lastSavedAt!,
  });

  return (
    <div className={SUMMARY_TEXT_CLASS} data-testid="practice-summary-lines">
      <p>{line1}</p>
      <p className="mt-1 flex items-center justify-center gap-1">
        <span>{line2}</span>
        <InfoTooltip
          ariaLabel="About practice summary"
          placement="bottom"
        >
          <span className="block text-left">
            <span className="block">Based on saved sessions only.</span>
            <span className="mt-1.5 block">Unsaved practice is not recorded.</span>
          </span>
        </InfoTooltip>
      </p>
    </div>
  );
}
