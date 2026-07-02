/** DB row removed but Cognito deleteUser failed — user may retry the full flow. */
export class AccountDeleteCognitoError extends Error {
  constructor() {
    super('cognito_delete_failed');
    this.name = 'AccountDeleteCognitoError';
  }
}

export const ACCOUNT_DELETED_FLASH =
  'Account deleted. Browse or sign up anytime.' as const;

export const ACCOUNT_DELETE_COGNITO_FAILED_MESSAGE =
  'Your data was deleted, but we could not remove your sign-in. Try again or contact support.';
