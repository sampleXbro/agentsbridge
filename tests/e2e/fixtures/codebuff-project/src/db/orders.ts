export interface OrderItem {
  sku: string;
  quantity: number;
}

export interface NewOrder {
  customerId: string;
  items: OrderItem[];
}

export interface Order extends NewOrder {
  id: string;
  createdAt: string;
}

const orders: Order[] = [];

export async function insertOrder(order: NewOrder): Promise<Order> {
  const created: Order = {
    ...order,
    id: `ord_${orders.length + 1}`,
    createdAt: new Date(0).toISOString(),
  };
  orders.push(created);
  return Promise.resolve(created);
}

export async function listOrders(customerId: string): Promise<Order[]> {
  return Promise.resolve(orders.filter((order) => order.customerId === customerId));
}
