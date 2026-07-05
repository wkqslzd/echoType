export type OnboardingSeedDecision =
  | 'already_resolved'
  | 'empty_catalog'
  | 'waive'
  | 'materialize';

/**
 * Pure decision tree for POST /api/onboarding/seed (ADR-0015 §20).
 * Order: resolved → empty catalog → waive (courseCount > 0) → materialize.
 */
export function decideOnboardingSeed(params: {
  onboardingSeededAt: Date | string | null;
  catalogEmpty: boolean;
  courseCount: number;
}): OnboardingSeedDecision {
  if (params.onboardingSeededAt !== null) {
    return 'already_resolved';
  }
  if (params.catalogEmpty) {
    return 'empty_catalog';
  }
  if (params.courseCount > 0) {
    return 'waive';
  }
  return 'materialize';
}
