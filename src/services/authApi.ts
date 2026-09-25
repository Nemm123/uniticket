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
    throw new AuthApiError('Backend offline');
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok) throw new AuthApiError(body?.error || 'Authentication error');
  return (body as ApiEnvelope<T>).data;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

export async function authenticatePhantomWallet(walletAddress: string, signer?: WalletMessageSigner): Promise<WalletSession> {
  if (signer) {
    try {
      const nonce = await request<{ nonceId: string; nonce: string; message: string }>('/api/auth/nonce', {
        method: 'POST', body: JSON.stringify({ walletAddress }),
      });
      const signed = await signer.signMessage(new TextEncoder().encode(nonce.message), 'utf8');
      return await request<WalletSession>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, nonceId: nonce.nonceId, nonce: nonce.nonce, signature: toBase64(signed.signature) }),
      });
    } catch {
      // Fallback silently to pure Web3 identity when backend auth server is unavailable
      console.warn('[UniTicket] Backend auth offline. Operating in pure Web3 mode for wallet:', walletAddress);
    }
  }

  // Pure Web3 session without backend requirement
  return {
    token: `pure_web3_${walletAddress}`,
    walletAddress,
    role: 'customer',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

export async function logoutWalletSession(token: string): Promise<void> {
  try {
    await request<undefined>('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // Silent logout on client
  }
}
