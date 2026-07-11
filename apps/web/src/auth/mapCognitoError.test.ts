import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUserNotConfirmed, isUserNotFound, mapChangePasswordError, mapCognitoError } from './mapCognitoError.js';

describe('mapCognitoError', () => {
  it('maps UserNotConfirmedException', () => {
    assert.match(mapCognitoError({ code: 'UserNotConfirmedException' }), /Confirm your email/);
  });

  it('maps NotAuthorizedException to generic login failure', () => {
    assert.match(mapCognitoError({ code: 'NotAuthorizedException' }), /Incorrect email or password/);
  });

  it('maps InvalidPasswordException to policy message', () => {
    assert.match(mapCognitoError({ code: 'InvalidPasswordException' }), /does not meet requirements/);
  });

  it('maps UserNotFoundException', () => {
    assert.match(mapCognitoError({ code: 'UserNotFoundException' }), /No account found/);
  });

  it('maps UsernameExistsException with Google hint', () => {
    assert.match(mapCognitoError({ code: 'UsernameExistsException' }), /already exists/);
    assert.match(mapCognitoError({ code: 'UsernameExistsException' }), /Google/);
  });

  it('maps CodeMismatchException', () => {
    assert.match(mapCognitoError({ code: 'CodeMismatchException' }), /Invalid verification code/);
  });

  it('maps ExpiredCodeException', () => {
    assert.match(mapCognitoError({ code: 'ExpiredCodeException' }), /expired/i);
  });
});

describe('isUserNotConfirmed', () => {
  it('detects unconfirmed user', () => {
    assert.equal(isUserNotConfirmed({ code: 'UserNotConfirmedException' }), true);
    assert.equal(isUserNotConfirmed({ code: 'NotAuthorizedException' }), false);
  });
});

describe('isUserNotFound', () => {
  it('detects missing user', () => {
    assert.equal(isUserNotFound({ code: 'UserNotFoundException' }), true);
    assert.equal(isUserNotFound({ code: 'NotAuthorizedException' }), false);
  });
});

describe('mapChangePasswordError', () => {
  it('maps NotAuthorizedException to current-password message', () => {
    assert.match(mapChangePasswordError({ code: 'NotAuthorizedException' }), /Current password/);
  });
});
