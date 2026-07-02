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
};
