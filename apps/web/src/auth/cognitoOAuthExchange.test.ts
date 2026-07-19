import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCognitoAuthorizeUrl } from '@echotype/shared';
import {
  clearConsumedStaleSessionRetry,
  consumeStaleSessionRetry,
  consumeStaleSessionRetryOnce,
  googleSignInInteractionParams,
  resetStaleSessionRetryOnceForTests,
  saveStaleSessionRetry,
  shouldRetryStaleCognitoSession,
} from './cognitoOAuthExchange.js';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('stale Cognito session retry', () => {
  it('retries only invalid_grant from the single allowed reauth leg', () => {
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 1), true);
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 0), false);
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 2), false);
    assert.equal(shouldRetryStaleCognitoSession('invalid_request', 1), false);
  });

  it('consumes a fresh retry marker exactly once', () => {
    const storage = new MemoryStorage();
    saveStaleSessionRetry(
      {
        nextPath: '/account',
        hintEmail: 'user@example.com',
        createdAt: 1_000,
      },
      storage,
    );

    assert.deepEqual(consumeStaleSessionRetry(storage, 2_000), {
      nextPath: '/account',
      hintEmail: 'user@example.com',
      createdAt: 1_000,
    });
    assert.equal(consumeStaleSessionRetry(storage, 2_000), null);
  });

  it('rejects expired and non-local retry markers', () => {
    const expired = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '/', createdAt: 1_000 }, expired);
    assert.equal(consumeStaleSessionRetry(expired, 122_001), null);

    const external = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '//example.com', createdAt: 1_000 }, external);
    assert.equal(consumeStaleSessionRetry(external, 2_000), null);
  });

  it('returns the same marker across Strict Mode double useState init', () => {
    resetStaleSessionRetryOnceForTests();
    const storage = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '/', hintEmail: 'user@example.com', createdAt: 1_000 }, storage);

    const first = consumeStaleSessionRetryOnce(storage, 2_000);
    const second = consumeStaleSessionRetryOnce(storage, 2_000);
    assert.deepEqual(first, { nextPath: '/', hintEmail: 'user@example.com', createdAt: 1_000 });
    assert.deepEqual(second, first);
    // The underlying sessionStorage key was still consumed exactly once.
    assert.equal(consumeStaleSessionRetry(storage, 2_000), null);
  });

  it('returns null after the retry has been acted on (SPA remount)', () => {
    resetStaleSessionRetryOnceForTests();
    const storage = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '/', createdAt: 1_000 }, storage);

    assert.notEqual(consumeStaleSessionRetryOnce(storage, 2_000), null);
    clearConsumedStaleSessionRetry();
    assert.equal(consumeStaleSessionRetryOnce(storage, 2_000), null);
  });

  it('memoizes null when no marker exists', () => {
    resetStaleSessionRetryOnceForTests();
    const storage = new MemoryStorage();
    assert.equal(consumeStaleSessionRetryOnce(storage, 2_000), null);
    assert.equal(consumeStaleSessionRetryOnce(storage, 2_000), null);
  });
});

describe('Google sign-in interaction mode', () => {
  function authorizeUrl(autoReuse?: boolean): URL {
    return new URL(
      buildCognitoAuthorizeUrl({
        domainPrefix: 'echotype-ink',
        region: 'ap-southeast-2',
        clientId: 'client',
        redirectUri: 'https://echotype.ink/auth/callback',
        identityProvider: 'Google',
        ...googleSignInInteractionParams({ autoReuse }),
      }),
    );
  }

  it('keeps forced account selection for a user-initiated sign-in', () => {
    const url = authorizeUrl();
    assert.equal(url.searchParams.get('prompt'), 'login select_account');
    assert.equal(url.searchParams.get('max_age'), '0');
  });

  it('omits prompt and max_age for automatic account reuse', () => {
    const url = authorizeUrl(true);
    assert.equal(url.searchParams.get('prompt'), null);
    assert.equal(url.searchParams.get('max_age'), null);
    assert.equal(url.searchParams.get('identity_provider'), 'Google');
  });
});
