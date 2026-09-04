import { z } from 'zod';
import { insertOrder, listOrders } from '../db/orders';

const createOrderBody = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

export interface RouteResult {
  status: number;
  body: unknown;
}

export async function postOrder(rawBody: unknown): Promise<RouteResult> {
  const parsed = createOrderBody.safeParse(rawBody);
  if (!parsed.success) {
    return { status: 400, body: { code: 'invalid_order', issues: parsed.error.issues } };
  }
  return { status: 201, body: await insertOrder(parsed.data) };
}

export async function getOrders(customerId: string): Promise<RouteResult> {
  return { status: 200, body: await listOrders(customerId) };
}
