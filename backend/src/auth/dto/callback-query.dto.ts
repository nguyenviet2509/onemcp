import { z } from 'zod';

// Zod schema for GitLab OAuth callback query params.
// Validates both success (code + state) and GitLab error responses.
export const CallbackQuerySchema = z.object({
  code: z.string().min(1, 'Missing authorization code'),
  state: z.string().uuid('State must be UUID format'),
  // GitLab may append these on error; capture to provide better error messages.
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type CallbackQuery = z.infer<typeof CallbackQuerySchema>;
