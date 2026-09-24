import 'dotenv/config';
import { isSolanaWalletAddress } from '../auth/crypto.js';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const configuredAdminWallets = (process.env.ADMIN_WALLET_ADDRESSES ?? '').split(',').map((value) => value.trim()).filter(Boolean);
const invalidAdminWallets = configuredAdminWallets.filter((wallet) => !isSolanaWalletAddress(wallet));
const validAdminWallets = configuredAdminWallets.filter((wallet) => isSolanaWalletAddress(wallet));

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/uniticket',
  databaseSsl: parseBoolean(process.env.DATABASE_SSL, false),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  authDomain: process.env.AUTH_DOMAIN ?? 'localhost',
  authNonceTtlSeconds: parsePositiveInteger(process.env.AUTH_NONCE_TTL_SECONDS, 300),
  authSessionTtlSeconds: parsePositiveInteger(process.env.AUTH_SESSION_TTL_SECONDS, 28_800),
  reservationTtlSeconds: parsePositiveInteger(process.env.RESERVATION_TTL_SECONDS, 900),
  serviceFeeVnd: parsePositiveInteger(process.env.SERVICE_FEE_VND, 20_000),
  adminWalletAddresses: new Set(validAdminWallets),
};

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

if (configuredAdminWallets.length === 0) {
  console.warn('[UniTicket Auth] ADMIN_WALLET_ADDRESSES is empty. No wallet can bootstrap as admin.');
} else if (invalidAdminWallets.length > 0) {
  console.warn('[UniTicket Auth] ADMIN_WALLET_ADDRESSES contains invalid entries. They will not receive admin access.');
}
