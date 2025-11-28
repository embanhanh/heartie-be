import { OrderStatus } from '../../orders/entities/order.entity';

export const ADMIN_COPILOT_RANGE_OPTIONS = ['7d', '30d', '90d'] as const;

export const ADMIN_COPILOT_DEFAULT_RANGE = '30d';

export const ADMIN_COPILOT_FULFILLED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];
