/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Monkeytype Serika Dark (themes.ts `serika_dark`).
        // EchoType Night: outer shell uses subAlt; passage/textarea uses bg (swapped vs MT default nesting).
        // Untyped body uses `sub` #646669 (MT upcoming text). `text` #d1d0c5 is kept for
        // chrome emphasis (outline CTA labels) — it reads as “already typed” if used on passage.
        // Annotation yellow = `main`. Typing correct/wrong stay EchoType emerald/red.
        serika: {
          /** Page / header outside the passage box */
          bg: '#2c2e31',
          /** Passage + textarea surface */
          surface: '#323437',
          /** Hover / secondary control face */
          raised: '#3c3e42',
          /** Session chrome text (Export, labels, Hide, …) */
          sub: '#646669',
          /** Passage / textarea untyped body */
          text: '#d1d0c5',
          /** Warm hairline borders (replaces cold slate-600) */
          border: '#45484a',
          /** Annotation accent */
          main: '#e2b714',
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Menlo',
          'Consolas',
          'Fira Code',
          'Courier New',
          'ui-monospace',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
