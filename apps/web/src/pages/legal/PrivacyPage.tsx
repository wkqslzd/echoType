import { PRIVACY_POLICY } from '../../content/legal/privacy';
import type { PrivacyBlock } from '../../content/legal/privacy';

function PrivacyBlockView({ block }: { block: PrivacyBlock }) {
  if (block.type === 'labeled') {
    return (
      <p className="text-sm leading-relaxed text-slate-700 dark:text-serika-sub">
        <span className="font-medium text-slate-900 dark:text-serika-text">{block.label}</span> {block.text}
      </p>
    );
  }
  return <p className="text-sm leading-relaxed text-slate-700 dark:text-serika-sub">{block.text}</p>;
}

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-8" data-testid="privacy-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-serika-text">{PRIVACY_POLICY.title}</h1>
        <p className="text-sm text-slate-500 dark:text-serika-sub">Last updated: {PRIVACY_POLICY.lastUpdated}</p>
        {PRIVACY_POLICY.intro.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-slate-700 dark:text-serika-sub">
            {paragraph}
          </p>
        ))}
      </header>

      {PRIVACY_POLICY.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-serika-text">{section.heading}</h2>
          <div className="space-y-3">
            {section.blocks.map((block, index) => (
              <PrivacyBlockView key={`${section.heading}-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-2 border-t border-slate-200 pt-6 dark:border-serika-border">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-serika-text">Contact</h2>
        <p className="text-sm text-slate-700 dark:text-serika-sub">
          For questions about this privacy policy, contact:{' '}
          <a
            href={`mailto:${PRIVACY_POLICY.contactEmail}`}
            className="text-amber-900 underline hover:text-amber-950 dark:text-serika-main dark:hover:text-serika-main"
          >
            {PRIVACY_POLICY.contactEmail}
          </a>
        </p>
      </section>
    </article>
  );
}
