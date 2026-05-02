/**
 * Controller template scaffolded by the api-generator skill.
 * Copy and rename for new resources.
 */
import type { Request, Response } from 'express';

export async function listResource(_req: Request, res: Response): Promise<void> {
  res.json({ data: [], meta: { count: 0 } });
}

export async function createResource(_req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: null, meta: {} });
}
