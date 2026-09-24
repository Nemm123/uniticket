import { WalletSession } from './authSession';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (runtimeEnv?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

interface ApiEnvelope<T> { data: T; error?: string; }

export class AuthApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export interface WalletMessageSigner {
  signMessage: (message: Uint8Array, display?: 'utf8') => Promise<{ signature: Uint8Array }>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
  } catch {
    throw new AuthApiError('Không thể kết nối máy chủ xác thực.');
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok) throw new AuthApiError(body?.error || 'Wallet authentication failed.');
  return (body as ApiEnvelope<T>).data;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

export async function authenticatePhantomWallet(walletAddress: string, signer: WalletMessageSigner): Promise<WalletSession> {
  const nonce = await request<{ nonceId: string; nonce: string; message: string }>('/api/auth/nonce', {
    method: 'POST', body: JSON.stringify({ walletAddress }),
  });
  const signed = await signer.signMessage(new TextEncoder().encode(nonce.message), 'utf8');
  return request<WalletSession>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, nonceId: nonce.nonceId, nonce: nonce.nonce, signature: toBase64(signed.signature) }),
  });
}

export async function logoutWalletSession(token: string): Promise<void> {
  await request<undefined>('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
}
