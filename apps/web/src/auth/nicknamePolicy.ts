import { NICKNAME_MAX } from '@echotype/shared';

export function validateNickname(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Nickname is required.';
  }
  if (trimmed.length > NICKNAME_MAX) {
    return `Nickname must be at most ${NICKNAME_MAX} characters.`;
  }
  return null;
}
