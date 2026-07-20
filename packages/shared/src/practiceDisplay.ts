/** Rolling window for the course card "Recent" tag (ADR-0014). */
export const RECENT_PRACTICE_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecentPractice(lastPracticedAt: string | null, nowMs: number = Date.now()): boolean {
  if (lastPracticedAt == null) return false;
  const t = Date.parse(lastPracticedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t <= RECENT_PRACTICE_MS;
}

/** Card face duration: 0m, 45m, 2h, 2h 15m (ADR-0014 Phase 4). */
export function formatCardDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  if (sec === 0) return '0m';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatLoopCount(n: number): string {
  const count = Math.max(0, Math.floor(n));
  return `${count} loop${count === 1 ? '' : 's'}`;
}

export function formatCardStatsLine(totalDurationSec: number, totalCompletedPasses: number): string {
  return `${formatCardDuration(totalDurationSec)} · ${formatLoopCount(totalCompletedPasses)}`;
}

export function formatPracticeDateTime(iso: string | null): string {
  if (iso == null) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString();
}

export function formatAccuracyPercent(accuracy: number | null): string {
  if (accuracy == null) return '—';
  return `${(accuracy * 100).toFixed(1)}%`;
}

/** Home practice summary duration — ceil to minutes, min 1 min; not {@link formatCardDuration}. */
export function formatPracticeDuration(totalSec: number): string {
  const minutes = Math.max(1, Math.ceil(Math.max(0, totalSec) / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

/** Local calendar date as YYYY-MM-DD from an ISO timestamp. */
export function formatLocalYmd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatPracticeSummaryLine(opts: {
  totalDurationSec: number;
  totalCompletedPasses: number;
  lastSavedAt: string;
}): string {
  const duration = formatPracticeDuration(opts.totalDurationSec);
  const date = formatLocalYmd(opts.lastSavedAt);
  if (opts.totalCompletedPasses > 0) {
    return `${duration} across ${formatLoopCount(opts.totalCompletedPasses)} · Last saved ${date}`;
  }
  return `${duration} · Last saved ${date}`;
}
