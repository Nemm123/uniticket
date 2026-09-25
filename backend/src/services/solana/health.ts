import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getSolanaConnection,
  getSolanaCluster,
  getSolanaRpcUrl,
  getMinterKeypair,
} from './connection.js';

export interface SolanaHealthStatus {
  status: 'ok' | 'degraded' | 'error';
  cluster: 'devnet';
  rpcConnected: boolean;
  rpcEndpoint: string;
  slot: number | null;
  blockHeight: number | null;
  minterConfigured: boolean;
  minterPublicKey: string | null;
  balanceSol: number | null;
  error?: string;
}

export async function checkSolanaHealth(): Promise<SolanaHealthStatus> {
  const cluster = getSolanaCluster();
  const rpcEndpoint = getSolanaRpcUrl();
  const minter = getMinterKeypair();
  const minterPublicKey = minter ? minter.publicKey.toBase58() : null;

  try {
    const connection = getSolanaConnection();

    // Query slot & block height with timeout protection
    const [slot, blockHeight] = await Promise.all([
      connection.getSlot('confirmed'),
      connection.getBlockHeight('confirmed'),
    ]);

    let balanceSol: number | null = null;
    if (minter) {
      try {
        const lamports = await connection.getBalance(minter.publicKey, 'confirmed');
        balanceSol = Number((lamports / LAMPORTS_PER_SOL).toFixed(4));
      } catch (balErr) {
        console.warn('[Solana Health] Could not query minter balance:', (balErr as Error).message);
      }
    }

    return {
      status: 'ok',
      cluster,
      rpcConnected: true,
      rpcEndpoint,
      slot,
      blockHeight,
      minterConfigured: Boolean(minter),
      minterPublicKey,
      balanceSol,
    };
  } catch (rpcErr) {
    const message = (rpcErr as Error).message || 'Solana RPC connection failed';
    console.error('[Solana Health Check Failed]:', message);

    return {
      status: 'error',
      cluster,
      rpcConnected: false,
      rpcEndpoint,
      slot: null,
      blockHeight: null,
      minterConfigured: Boolean(minter),
      minterPublicKey,
      balanceSol: null,
      error: message,
    };
  }
}
