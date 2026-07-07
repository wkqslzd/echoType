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
    <p className="mt-1 text-right text-xs text-slate-400">
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
          className="group min-w-[1.25rem] text-sm text-slate-300 hover:text-slate-600"
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
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          Hide
        </button>
        <button
          type="button"
          data-testid="session-timer-set"
          onClick={onOpenConfig}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
          <p className="text-slate-600" aria-live="polite">
            <span aria-hidden>⏱ </span>
            <span className="font-mono">{formatCountdown(remainingSec)}</span> left
            {paused && (
              <>
                <span className="text-slate-400"> · </span>
                <span>Paused</span>
              </>
            )}
          </p>
          <ExitCountdownHint />
        </>
      )}

      {phase === 'armed' && armedMinutes != null && (
        <>
          <p className="text-slate-600">
            <span className="font-medium text-slate-800">{presetLabel(armedMinutes)}</span>
            <span className="text-slate-400"> · </span>
            Start typing to begin
          </p>
          <ExitCountdownHint />
        </>
      )}

      {phase === 'configuring' && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
            <span className="shrink-0 text-xs text-slate-500">Preset</span>
            {TIMER_PRESET_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPresetChange(m)}
                className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                  presetMinutes === m && !customMinutesInput.trim()
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {presetLabel(m)}
              </button>
            ))}
            <span className="shrink-0 text-xs text-slate-500">Custom (minutes, 10–120)</span>
            <input
              type="text"
              inputMode="numeric"
              value={customMinutesInput}
              onChange={(e) => onCustomChange(e.target.value)}
              placeholder="e.g. 25"
              aria-invalid={durationError != null}
              className="w-20 shrink-0 rounded-md border px-2 py-1 font-mono text-xs"
            />
          </div>
          {durationError && (
            <p className="mt-1 text-right text-xs text-red-600">{durationError}</p>
          )}
          <div className="mt-1 flex flex-col items-end gap-1">
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                data-testid="session-timer-confirm"
                onClick={onConfirm}
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={onCancelConfig}
                className="shrink-0 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
            <p className="max-w-md text-right text-xs leading-normal text-slate-400">{HELP_TEXT}</p>
          </div>
        </>
      )}
    </div>
  );
}
