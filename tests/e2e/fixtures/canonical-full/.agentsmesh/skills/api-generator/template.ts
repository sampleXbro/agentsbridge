import { z } from 'zod';

export const createRouteSchema = z.object({
  name: z.string(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
