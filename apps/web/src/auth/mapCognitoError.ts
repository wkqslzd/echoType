type CognitoLikeError = {
  code?: string;
  message?: string;
  name?: string;
};

function errorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const e = err as CognitoLikeError;
  return (e.code ?? e.name ?? '').toString();
}

export function mapCognitoError(err: unknown): string {
  switch (errorCode(err)) {
    case 'UserNotConfirmedException':
      return 'Confirm your email before signing in.';
    case 'UserNotFoundException':
      return 'No account found for this email.';
    case 'NotAuthorizedException':
      return 'Incorrect email or password.';
    case 'InvalidPasswordException':
      return 'Password does not meet requirements.';
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'CodeMismatchException':
      return 'Invalid verification code.';
    case 'ExpiredCodeException':
      return 'Verification code expired. Request a new one.';
    case 'InvalidParameterException':
      return 'Check your input and try again.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait and try again.';
    case 'NEW_PASSWORD_REQUIRED':
      return 'Password change is required. Contact support.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function isUserNotConfirmed(err: unknown): boolean {
  return errorCode(err) === 'UserNotConfirmedException';
}

export function isUserNotFound(err: unknown): boolean {
  return errorCode(err) === 'UserNotFoundException';
}

/** changePassword uses NotAuthorizedException for a wrong current password. */
export function mapChangePasswordError(err: unknown): string {
  if (errorCode(err) === 'NotAuthorizedException') {
    return 'Current password is incorrect.';
  }
  return mapCognitoError(err);
}
