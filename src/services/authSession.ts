export type ServerRole = 'customer' | 'organizer' | 'staff' | 'admin';

export interface WalletSession {
  token: string;
  walletAddress: string;
  role: ServerRole;
  expiresAt: string;
}

const SESSION_KEY = 'uniticket_wallet_session';
let activeSession: WalletSession | null = null;

export function getWalletSession(): WalletSession | null {
  if (activeSession) return activeSession;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletSession;
    if (parsed?.token && parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now()) {
      activeSession = parsed;
      return parsed;
    }
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage parse error
  }
  return null;
}

export function setWalletSession(session: WalletSession): void {
  activeSession = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota error
  }
}

export function clearWalletSession(): WalletSession | null {
  const previous = activeSession ?? getWalletSession();
  activeSession = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
  return previous;
}
