import {
  TIMER_PRESET_MINUTES,
  formatCountdown,
  presetLabel,
} from '../../lib/sessionTimer';

export type SessionTimerStripPhase = 'idle' | 'configuring' | 'armed' | 'running';

type SessionTimerStripProps = {
  phase: SessionTimerStripPhase;
  idleHidden: boolean;
  presetMinutes: number;
  customMinutesInput: string;
  durationError: string | null;
  armedMinutes: number | null;
  remainingSec: number | null;
  paused: boolean;
  onOpenConfig: () => void;
  onHideIdle: () => void;
  onShowIdle: () => void;
  onCancelConfig: () => void;
  onConfirm: () => void;
  onPresetChange: (minutes: number) => void;
  onCustomChange: (value: string) => void;
};

const HELP_TEXT =
  'Countdown starts when you resume typing. Custom value overrides preset when valid.';

function ExitCountdownHint() {
  return (
    <p className="mt-1 text-right text-xs text-slate-400 dark:text-serika-sub">
      Click Start over to cancel the countdown and clear your current session.
    </p>
  );
}

export function SessionTimerStrip({
  phase,
  idleHidden,
  presetMinutes,
  customMinutesInput,
  durationError,
  armedMinutes,
  remainingSec,
  paused,
  onOpenConfig,
  onHideIdle,
  onShowIdle,
  onCancelConfig,
  onConfirm,
  onPresetChange,
  onCustomChange,
}: SessionTimerStripProps) {
  if (phase === 'idle') {
    if (idleHidden) {
      return (
        <button
          type="button"
          data-testid="session-timer-show"
          aria-label="Show session timer"
          title="Show session timer"
          onClick={onShowIdle}
          className="group min-w-[1.25rem] text-sm text-slate-300 hover:text-slate-600 dark:text-serika-sub dark:hover:text-serika-text"
        >
          <span className="group-hover:hidden" aria-hidden>
            —
          </span>
          <span className="hidden group-hover:inline">Show session timer</span>
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="session-timer-hide"
          onClick={onHideIdle}
          className="text-sm text-slate-400 hover:text-slate-600 dark:text-serika-sub dark:hover:text-serika-text"
        >
          Hide
        </button>
        <button
          type="button"
          data-testid="session-timer-set"
          onClick={onOpenConfig}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-sub dark:hover:bg-serika-raised"
        >
          Set session timer
        </button>
      </div>
    );
  }

  return (
    <div data-testid="session-timer-strip" className="max-w-full px-1 py-1 text-right text-sm">
      {phase === 'running' && remainingSec != null && (
        <>
          <p className="text-slate-600 dark:text-serika-sub" aria-live="polite">
            <span aria-hidden>⏱ </span>
            <span className="font-mono">{formatCountdown(remainingSec)}</span> left
            {paused && (
              <>
                <span className="text-slate-400 dark:text-serika-sub"> · </span>
                <span>Paused</span>
              </>
            )}
          </p>
          <ExitCountdownHint />
        </>
      )}

      {phase === 'armed' && armedMinutes != null && (
        <>
          <p className="text-slate-600 dark:text-serika-sub">
            <span className="font-medium text-slate-800 dark:text-serika-sub">
              {presetLabel(armedMinutes)}
            </span>
            <span className="text-slate-400 dark:text-serika-sub"> · </span>
            Start typing to begin
          </p>
          <ExitCountdownHint />
        </>
      )}

      {phase === 'configuring' && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
            <span className="shrink-0 text-xs text-slate-500 dark:text-serika-sub">Preset</span>
            {TIMER_PRESET_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPresetChange(m)}
                className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                  presetMinutes === m && !customMinutesInput.trim()
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-serika-sub dark:bg-transparent dark:text-serika-text'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-serika-border dark:bg-serika-surface dark:text-serika-sub dark:hover:bg-serika-raised'
                }`}
              >
                {presetLabel(m)}
              </button>
            ))}
            <span className="shrink-0 text-xs text-slate-500 dark:text-serika-sub">
              Custom (minutes, 10–120)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={customMinutesInput}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="e.g. 25"
              aria-invalid={durationError != null}
              className="w-20 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-serika-border dark:bg-serika-surface dark:text-serika-sub"
            />
          </div>
          {durationError && (
            <p className="mt-1 text-right text-xs text-red-600 dark:text-red-400">{durationError}</p>
          )}
          <div className="mt-1 flex flex-col items-end gap-1">
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                data-testid="session-timer-confirm"
                onClick={onConfirm}
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:border dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text dark:hover:bg-[#4a4d50]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={onCancelConfig}
                className="shrink-0 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-serika-border dark:text-serika-sub dark:hover:bg-serika-raised"
              >
                Cancel
              </button>
            </div>
            <p className="max-w-md text-right text-xs leading-normal text-slate-400 dark:text-serika-sub">
              {HELP_TEXT}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
