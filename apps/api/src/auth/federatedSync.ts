import { adminUpdateUserAttributes } from './cognitoAdmin.js';
import { loadCognitoConfig } from './cognitoConfig.js';

/** Restore native nickname and email_verified after Google link or federated sign-in (G1A/G2A). */
export async function syncNativeLinkedAttributes(
  nativeUsername: string,
  preservedName: string,
): Promise<void> {
  const { userPoolId } = loadCognitoConfig();
  await adminUpdateUserAttributes({
    userPoolId,
    username: nativeUsername,
    attributes: {
      name: preservedName,
      email_verified: 'true',
    },
  });
}
