import { OrderStatus } from '../orders/entities/order.entity';

export const EXCLUDED_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.RETURNED];
