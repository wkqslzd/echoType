import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorizationCodeExchangeBody,
  buildCognitoAuthorizeUrl,
  buildCognitoHostedUiBaseUrl,
  buildCognitoTokenUrl,
  buildGoogleIdpRedirectUri,
  codeChallengeS256,
  encodeOAuthState,
  generatePkcePair,
  parseOAuthState,
  randomUrlSafeString,
} from './cognitoOAuth.js';
import {
  googleSubFromIdentities,
  parseFederatedTokenClaims,
  parseIdentitiesClaim,
} from './federatedClaims.js';

describe('buildCognitoHostedUiBaseUrl', () => {
  it('uses the regional Cognito auth domain', () => {
    assert.equal(
      buildCognitoHostedUiBaseUrl('echotype-ink', 'ap-southeast-2'),
      'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com',
    );
  });
});

describe('buildCognitoTokenUrl', () => {
  it('points at oauth2/token', () => {
    assert.equal(
      buildCognitoTokenUrl('echotype-ink', 'ap-southeast-2'),
      'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com/oauth2/token',
    );
  });
});

describe('buildGoogleIdpRedirectUri', () => {
  it('points at Cognito oauth2/idpresponse', () => {
    assert.equal(
      buildGoogleIdpRedirectUri('echotype-ink', 'ap-southeast-2'),
      'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com/oauth2/idpresponse',
    );
  });
});

describe('PKCE + OAuth state', () => {
  it('generates verifier and S256 challenge', async () => {
    const { codeVerifier, codeChallenge } = await generatePkcePair();
    assert.ok(codeVerifier.length >= 43);
    assert.equal(codeChallenge, await codeChallengeS256(codeVerifier));
  });

  it('round-trips OAuth state', () => {
    const raw = encodeOAuthState({ next: '/courses/short', nonce: randomUrlSafeString(16) });
    assert.deepEqual(parseOAuthState(raw), {
      next: '/courses/short',
      nonce: parseOAuthState(raw)!.nonce,
    });
  });

  it('rejects invalid state', () => {
    assert.equal(parseOAuthState('not-valid'), null);
    assert.equal(parseOAuthState(encodeOAuthState({ next: 'http://evil', nonce: 'x' })), null);
  });
});

describe('buildCognitoAuthorizeUrl', () => {
  it('builds an authorization code URL with required params', () => {
    const url = buildCognitoAuthorizeUrl({
      domainPrefix: 'echotype-ink',
      region: 'ap-southeast-2',
      clientId: 'abc123',
      redirectUri: 'https://echotype.ink/auth/callback',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, 'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com/oauth2/authorize');
    assert.equal(parsed.searchParams.get('client_id'), 'abc123');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'openid email profile');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'https://echotype.ink/auth/callback');
    assert.equal(parsed.searchParams.get('identity_provider'), null);
  });

  it('supports identity_provider=Google for direct federated sign-in', () => {
    const url = buildCognitoAuthorizeUrl({
      domainPrefix: 'echotype-ink',
      region: 'ap-southeast-2',
      clientId: 'abc123',
      redirectUri: 'http://localhost:5173/auth/callback',
      identityProvider: 'Google',
      codeChallenge: 'challenge123',
      state: 'state123',
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('identity_provider'), 'Google');
    assert.equal(parsed.searchParams.get('code_challenge'), 'challenge123');
    assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(parsed.searchParams.get('state'), 'state123');
  });

  it('supports prompt=select_account for Google account picker', () => {
    const url = buildCognitoAuthorizeUrl({
      domainPrefix: 'echotype-ink',
      region: 'ap-southeast-2',
      clientId: 'abc123',
      redirectUri: 'http://localhost:5173/auth/callback',
      identityProvider: 'Google',
      prompt: 'select_account',
    });
    assert.equal(new URL(url).searchParams.get('prompt'), 'select_account');
  });
});

describe('buildAuthorizationCodeExchangeBody', () => {
  it('includes PKCE verifier fields', () => {
    assert.deepEqual(
      buildAuthorizationCodeExchangeBody({
        clientId: 'abc',
        code: 'code1',
        redirectUri: 'https://echotype.ink/auth/callback',
        codeVerifier: 'verifier',
      }),
      {
        grant_type: 'authorization_code',
        client_id: 'abc',
        code: 'code1',
        redirect_uri: 'https://echotype.ink/auth/callback',
        code_verifier: 'verifier',
      },
    );
  });
});

describe('parseFederatedTokenClaims', () => {
  const identities = [
    {
      userId: '107121059094644779940',
      providerName: 'Google',
      providerType: 'Google',
      primary: true,
    },
  ];

  it('detects linked Google user via cognito:username email', () => {
    const claims = parseFederatedTokenClaims(
      { sub: 'uuid-native', email: 'user@example.com' },
      {
        sub: 'uuid-native',
        email: 'user@example.com',
        'cognito:username': 'user@example.com',
        identities,
      },
    );
    assert.deepEqual(claims, {
      sub: 'uuid-native',
      email: 'user@example.com',
      cognitoUsername: 'user@example.com',
      googleSub: '107121059094644779940',
      isGoogleLinked: true,
      isOrphanGoogleSession: false,
    });
  });

  it('detects orphan Google session via Google_ username prefix', () => {
    const claims = parseFederatedTokenClaims(
      {
        sub: 'federated-uuid',
        email: 'user@example.com',
        'cognito:username': 'Google_107121059094644779940',
      },
      {
        sub: 'federated-uuid',
        email: 'user@example.com',
        'cognito:username': 'Google_107121059094644779940',
        identities,
      },
    );
    assert.equal(claims?.isOrphanGoogleSession, true);
    assert.equal(claims?.isGoogleLinked, false);
    assert.equal(claims?.googleSub, '107121059094644779940');
  });
});

describe('parseIdentitiesClaim', () => {
  it('parses JSON string identities from Cognito tokens', () => {
    const parsed = parseIdentitiesClaim(JSON.stringify([{ userId: '1', providerName: 'Google' }]));
    assert.equal(googleSubFromIdentities(parsed), '1');
  });
});
