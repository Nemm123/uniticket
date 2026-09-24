import { CheckInResult, PurchasedTicket } from '../types';
import { getWalletSession } from './authSession';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (runtimeEnv?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

interface ApiEnvelope<T> {
  data: T;
  error?: string;
  status?: 'valid' | 'used' | 'invalid' | 'error';
  message?: string;
  ticket?: PurchasedTicket;
}

export class TicketsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TicketsApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const session = getWalletSession();
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(options?.headers || {}),
      },
    });
  } catch {
    throw new TicketsApiError('Không thể kết nối đến máy chủ vé. Vui lòng kiểm tra kết nối mạng Internet.', 0);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new TicketsApiError(body?.error || body?.message || `Lỗi máy chủ (${response.status}).`, response.status);
  }
  return body as T;
}

/**
 * Bulk or single ticket creation after checkout
 */
export async function createTicketsApi(tickets: Array<Partial<PurchasedTicket>>): Promise<PurchasedTicket[]> {
  const result = await request<ApiEnvelope<PurchasedTicket[]>>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ tickets }),
  });
  return result.data;
}

/**
 * List tickets filtered by wallet, eventId, or ticketCode
 */
export async function listTicketsApi(params?: { wallet?: string; eventId?: string; ticketCode?: string }): Promise<PurchasedTicket[]> {
  const query = new URLSearchParams();
  if (params?.wallet) query.set('wallet', params.wallet);
  if (params?.eventId) query.set('eventId', params.eventId);
  if (params?.ticketCode) query.set('ticketCode', params.ticketCode);

  const qs = query.toString();
  const path = qs ? `/api/tickets?${qs}` : '/api/tickets';
  const result = await request<ApiEnvelope<PurchasedTicket[]>>(path);
  return result.data;
}

/**
 * List tickets for a specific order using guest access token.
 * Returns only tickets belonging to that order.
 * Excludes sensitive fields (qr_token_hash, nft_*, owner_wallet, checkedInBy).
 */
export async function listGuestTicketsApi(orderId: string, guestAccessToken: string): Promise<PurchasedTicket[]> {
  const result = await request<ApiEnvelope<PurchasedTicket[]>>(`/api/tickets/guest?orderId=${encodeURIComponent(orderId)}&guestAccessToken=${encodeURIComponent(guestAccessToken)}`);
  return result.data;
}

/**
 * Verify a ticket by QR payload or ticket code without checking in
 */
export async function verifyTicketApi(input: string): Promise<CheckInResult> {
  try {
    const result = await request<{
      status: 'valid' | 'used' | 'invalid' | 'error';
      message: string;
      ticket?: PurchasedTicket;
    }>('/api/tickets/verify', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });

    return {
      status: result.status || 'invalid',
      message: result.message || 'Xác thực vé thất bại.',
      ticket: result.ticket,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ khi xác thực vé.',
    };
  }
}

/**
 * Atomic check-in transition with organizer verification
 */
export async function checkInTicketApi(code: string): Promise<CheckInResult> {
  try {
    const result = await request<{
      status: 'valid' | 'used' | 'invalid' | 'error';
      message: string;
      ticket?: PurchasedTicket;
    }>('/api/tickets/check-in', {
      method: 'POST',
      body: JSON.stringify({
        input: code,
      }),
    });

    return {
      status: result.status || 'invalid',
      message: result.message || 'Check-in thất bại.',
      ticket: result.ticket,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ khi thực hiện check-in.',
    };
  }
}
