import { Connection, Keypair } from '@solana/web3.js';
import 'dotenv/config';

const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

/**
 * Validates that an RPC URL strictly targets Solana Devnet.
 * FAIL CLOSED: If the URL cannot be verified as Devnet, or targets mainnet, throws an error.
 */
export function validateDevnetRpcUrl(url: string): string {
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('mainnet') || lower.includes('mainnet-beta')) {
    throw new Error('[Solana Safety] Mainnet connection strictly prohibited in this environment.');
  }

  // Allow official devnet or custom devnet RPC endpoints (e.g. helius-devnet, alchemy, quicknode)
  if (!lower.includes('devnet') && !lower.includes('127.0.0.1') && !lower.includes('localhost')) {
    throw new Error('[Solana Safety] Only Solana Devnet RPC is permitted. RPC URL must specify devnet.');
  }

  return trimmed;
}

const rpcUrl = process.env.SOLANA_RPC_URL ? validateDevnetRpcUrl(process.env.SOLANA_RPC_URL) : DEFAULT_DEVNET_RPC;

let connectionInstance: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
    });
  }
  return connectionInstance;
}

export function getSolanaRpcUrl(): string {
  return rpcUrl;
}

export function getSolanaCluster(): 'devnet' {
  return 'devnet';
}

/**
 * Parses minter keypair from environment variable SOLANA_MINTER_PRIVATE_KEY.
 * Supports:
 * - Base58 encoded private key
 * - JSON array of numbers (standard Solana CLI keypair format: [12,34,...])
 * Returns null if not configured or invalid (fails gracefully without crashing).
 */
export function getMinterKeypair(): Keypair | null {
  const rawKey = process.env.SOLANA_MINTER_PRIVATE_KEY?.trim();
  if (!rawKey) return null;

  try {
    if (rawKey.startsWith('[') && rawKey.endsWith(']')) {
      const parsed = JSON.parse(rawKey);
      if (Array.isArray(parsed) && parsed.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(parsed));
      }
    }

    // Try base58 decoding
    const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const decodeBase58 = (str: string): Uint8Array => {
      const bytes: number[] = [];
      for (const char of str) {
        const value = BASE58_ALPHABET.indexOf(char);
        if (value === -1) throw new Error('Invalid Base58 character');
        let carry = value;
        for (let i = 0; i < bytes.length; i++) {
          carry += bytes[i] * 58;
          bytes[i] = carry & 0xff;
          carry >>= 8;
        }
        while (carry > 0) {
          bytes.push(carry & 0xff);
          carry >>= 8;
        }
      }
      for (let i = 0; i < str.length && str[i] === '1'; i++) {
        bytes.push(0);
      }
      return new Uint8Array(bytes.reverse());
    };

    const secretKey = decodeBase58(rawKey);
    if (secretKey.length === 64) {
      return Keypair.fromSecretKey(secretKey);
    }
  } catch (err) {
    console.warn('[Solana Minter] Could not parse SOLANA_MINTER_PRIVATE_KEY:', (err as Error).message);
  }

  return null;
}

export function getMinterPublicKey(): string | null {
  const minter = getMinterKeypair();
  return minter ? minter.publicKey.toBase58() : null;
}
