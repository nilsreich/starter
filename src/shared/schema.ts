import { z } from "zod";

export const itemSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
  deleted: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
});
export type Item = z.infer<typeof itemSchema>;

export const loginSchema = z.object({ password: z.string().min(1).max(200) });

/** Antwort von GET /api/items?since=<cursor>: alle Änderungen (inkl. gelöschter) seit dem Cursor. */
export const pullSchema = z.object({ items: z.array(itemSchema), cursor: z.number().int() });
export type Pull = z.infer<typeof pullSchema>;
