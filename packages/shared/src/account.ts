import { z } from 'zod';

export const NICKNAME_MAX = 64;

export const UpdateAccountInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(NICKNAME_MAX),
});

export type UpdateAccountInput = z.infer<typeof UpdateAccountInput>;

export type AccountDTO = {
  id: string;
  email: string;
  name: string;
  /** True when Google-only signup has not set a nickname yet (name is empty). */
  needsNicknameSetup: boolean;
  /** null = onboarding hook not yet handled; see User.onboardingSeededAt / ADR-0015 §20. */
  onboardingSeededAt: string | null;
};

export function needsNicknameSetup(name: string): boolean {
  return name.trim() === '';
}

/** Register blocked when Cognito/Postgres already has this email (Google or native). */
export const EMAIL_ALREADY_EXISTS_MESSAGE =
  'An account with this email already exists.\nTry signing in with Google instead.';

export const DELETE_CONFIRMATION_TEXT = 'DELETE' as const;

export function isDeleteConfirmationValid(input: string): boolean {
  return input.trim() === DELETE_CONFIRMATION_TEXT;
}
