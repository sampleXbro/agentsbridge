/**
 * Controller template — replace RESOURCE with the real resource name.
 * See .opencode/skills/api-generator/SKILL.md for usage.
 */

import type { Request, Response } from 'express';

export async function listResource(_req: Request, res: Response): Promise<void> {
  const data: unknown[] = [];
  res.json({ data, meta: { total: data.length } });
}

export async function createResource(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  res.status(201).json({ data: body, meta: {} });
}
