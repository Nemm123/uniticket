import { getWalletSession } from './authSession';
import { TicketsApiError } from './ticketsApi';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (runtimeEnv?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export interface OrderItem {
  id: string;
  tierId: string;
  tierName: string;
  quantity: number;
  unitPriceVnd: number;
  totalPriceVnd: number;
}

export interface OrderSummary {
  id: string;
  orderCode: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  status: 'PAYMENT_PENDING' | 'PAID' | 'TICKET_ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'FAILED' | 'REFUNDED';
  currency: 'VND';
  subtotalVnd: number;
  serviceFeeVnd: number;
  totalVnd: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentProviderReference: string | null;
  paymentVerifiedAt: string | null;
  expiresAt: string;
  createdAt: string;
  guestAccessToken?: string;
  items: OrderItem[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getWalletSession();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(options.headers || {}) } });
  } catch { throw new TicketsApiError('Không thể kết nối máy chủ đặt vé.', 0); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new TicketsApiError(body?.error || `Yêu cầu đặt vé thất bại (${response.status}).`, response.status);
  return body.data as T;
}

function newIdempotencyKey(): string { return crypto.randomUUID(); }

export function createOrder(eventId: string, tierId: string, quantity: number, customerName: string, customerEmail: string, key = newIdempotencyKey()): Promise<OrderSummary> {
  return request<OrderSummary>('/api/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ eventId, items: [{ tierId, quantity }], customerName, customerEmail }) });
}

export function demoPayOrder(orderId: string, guestAccessToken?: string): Promise<OrderSummary> {
  return request<OrderSummary>(`/api/orders/${encodeURIComponent(orderId)}/demo-pay`, {
    method: 'POST',
    headers: guestAccessToken ? { 'x-order-access-token': guestAccessToken } : {},
  });
}
