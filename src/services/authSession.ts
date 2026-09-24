export type ServerRole = 'customer' | 'organizer' | 'staff' | 'admin';

export interface WalletSession {
  token: string;
  walletAddress: string;
  role: ServerRole;
  expiresAt: string;
}

let activeSession: WalletSession | null = null;

export function getWalletSession(): WalletSession | null {
  return activeSession;
}

export function setWalletSession(session: WalletSession): void {
  activeSession = session;
}

export function clearWalletSession(): WalletSession | null {
  const previous = activeSession;
  activeSession = null;
  return previous;
}
