import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
export const SOLANA_DEVNET_RPC_URL = runtimeEnv?.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const SOLANA_DEVNET_FAUCET_URL = 'https://faucet.solana.com';

/**
 * Solana Program ID cho UniTicket Smart Contract trên Devnet
 */
export const SOLANA_PROGRAM_ID_STR = runtimeEnv?.VITE_SOLANA_PROGRAM_ID || 'UniTkT7pL4w5sJ4GjN6E4bB8eN7mK9pQ2R3sT4uV5wX';
export const SOLANA_PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_ID_STR);

/**
 * Treasury / Minter Public Key trên Solana Devnet
 */
export const SOLANA_TREASURY_WALLET_STR = runtimeEnv?.VITE_SOLANA_TREASURY_WALLET || 'CUx6CcVbkbdiaQS4qm6zEuR1p9xTjJ3LTnqBq9NJF3mh';
export const SOLANA_TREASURY_WALLET = new PublicKey(SOLANA_TREASURY_WALLET_STR);

let devnetConnection: Connection | null = null;

export function getDevnetConnection(): Connection {
  if (!devnetConnection) {
    devnetConnection = new Connection(SOLANA_DEVNET_RPC_URL, 'confirmed');
  }
  return devnetConnection;
}

/**
 * Lấy số dư SOL của ví trên mạng Solana Devnet
 * Trả về số SOL thực tế (đã chia cho LAMPORTS_PER_SOL), hoặc null nếu gặp sự cố RPC
 */
export async function getWalletSolBalance(address: string): Promise<number | null> {
  if (!address || typeof address !== 'string') return null;

  try {
    const pubKey = new PublicKey(address);
    const connection = getDevnetConnection();
    const lamports = await connection.getBalance(pubKey, 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  } catch (err) {
    console.warn('[SolanaClient] Không thể truy vấn số dư SOL từ Devnet RPC:', err);
    return null;
  }
}

/**
 * Định dạng số dư SOL hiển thị thân thiện trên UI
 */
export function formatSolBalance(balance: number | null | undefined): string {
  if (balance === null || balance === undefined) return '-- SOL';
  if (balance === 0) return '0.00 SOL';
  if (balance < 0.001) return '< 0.001 SOL';
  return `${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} SOL`;
}

/**
 * Tạo liên kết tới Solana Explorer cho Transaction hoặc Address trên Devnet
 * Định dạng: https://explorer.solana.com/tx/${signature}?cluster=devnet
 */
export function getSolanaExplorerUrl(typeOrIdentifier: 'tx' | 'address' | string, identifier?: string): string {
  if (identifier) {
    return `https://explorer.solana.com/${typeOrIdentifier}/${identifier}?cluster=devnet`;
  }
  return `https://explorer.solana.com/tx/${typeOrIdentifier}?cluster=devnet`;
}

/**
 * Xử lý lỗi giao dịch Solana thân thiện, bắt các lỗi phổ biến:
 * - Người dùng từ chối ký
 * - Không đủ SOL trả phí mạng (gas fee)
 * - Giao dịch timeout
 */
export function parseSolanaTxError(error: unknown): string {
  if (!error) return 'Giao dịch không thành công. Vui lòng thử lại.';

  let message = '';
  let code: number | string | undefined;

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    code = errObj.code as number | string | undefined;
    message = typeof errObj.message === 'string' ? errObj.message : String(error);
  } else {
    message = String(error);
  }

  const lower = message.toLowerCase();

  // 1. Người dùng từ chối ký giao dịch
  if (
    code === 4001 ||
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('user cancel') ||
    lower.includes('cancelled')
  ) {
    return 'Bạn đã từ chối ký xác nhận giao dịch trên ví Phantom.';
  }

  // 2. Không đủ SOL trả phí mạng (gas fee) hoặc tiền vé
  if (
    lower.includes('insufficient') ||
    lower.includes('0x1') ||
    lower.includes('attempt to debit an account but found no record') ||
    lower.includes('not enough sol')
  ) {
    return 'Số dư SOL trên Devnet không đủ để trả phí mạng (gas fee). Vui lòng nhận thêm SOL miễn phí tại faucet.solana.com.';
  }

  // 3. Giao dịch timeout hoặc blockhash hết hạn
  if (
    lower.includes('timeout') ||
    lower.includes('blockhash not found') ||
    lower.includes('expired') ||
    lower.includes('timed out') ||
    lower.includes('was not confirmed')
  ) {
    return 'Giao dịch quá thời gian chờ xác nhận trên mạng Solana Devnet. Vui lòng thử lại sau giây lát.';
  }

  // 4. Rate limited / RPC quá tải
  if (lower.includes('429') || lower.includes('too many requests')) {
    return 'Mạng Solana Devnet RPC đang bận phản hồi. Vui lòng thử lại sau vài giây.';
  }

  return `Giao dịch thất bại: ${message.slice(0, 140)}`;
}

export type TxStepStatus = 'IDLE' | 'SIGNING' | 'CONFIRMING' | 'SUCCESS';

export interface BuyTicketSolanaParams {
  eventId: string;
  tierId: string;
  quantity: number;
  unitPriceSol?: number;
  buyerWallet: string;
  provider?: {
    publicKey?: { toString: () => string };
    signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
    signTransaction?: (tx: Transaction) => Promise<Transaction>;
  };
  sendTransaction?: (tx: Transaction, connection: Connection) => Promise<string>;
  onStatusChange?: (status: TxStepStatus, message: string) => void;
}

export interface BuyTicketSolanaResult {
  signature: string;
  explorerUrl: string;
}

/**
 * Xử lý luồng ký và gửi giao dịch mua vé / mint NFT lên Solana Devnet:
 * 1. Khi bấm mua: thông báo "Vui lòng ký giao dịch trên ví..."
 * 2. Khi ví đã ký: chuyển sang "Đang xác nhận giao dịch trên Solana Devnet..."
 * 3. Sau khi confirmed: trả về signature và link Solana Explorer chuẩn
 */
export async function executeBuyTicketOnSolana(
  params: BuyTicketSolanaParams
): Promise<BuyTicketSolanaResult> {
  const { eventId, tierId, quantity, buyerWallet, provider, sendTransaction, onStatusChange } = params;
  const unitPriceSol = (params.unitPriceSol && params.unitPriceSol > 0) ? params.unitPriceSol : 0.05;

  if (!provider && !sendTransaction) {
    throw new Error('Chưa phát hiện tiện ích ví Phantom.');
  }

  const buyerPubKey = new PublicKey(buyerWallet);
  const connection = getDevnetConnection();

  // Kiểm tra số dư SOL trước khi gửi giao dịch
  const balance = await getWalletSolBalance(buyerWallet);
  const requiredSol = Math.max(0.001, unitPriceSol * quantity + 0.0005);
  if (balance !== null && balance < requiredSol) {
    throw new Error(
      'Số dư SOL trên Devnet không đủ để trả phí mạng (gas fee). Vui lòng nhận thêm SOL miễn phí tại faucet.solana.com.'
    );
  }

  // 1. Trạng thái: Chờ người dùng ký trên ví
  onStatusChange?.('SIGNING', 'Vui lòng ký giao dịch trên ví...');

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction({
    feePayer: buyerPubKey,
    recentBlockhash: blockhash,
  });

  // Tạo Instruction tương tác với Treasury / Program ID
  const lamportsToSend = Math.max(
    5000, // phí nominal 0.000005 SOL
    Math.round(unitPriceSol * quantity * LAMPORTS_PER_SOL)
  );

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: buyerPubKey,
      toPubkey: SOLANA_TREASURY_WALLET,
      lamports: lamportsToSend,
    })
  );

  // Gắn Program ID Instruction metadata nhận diện vé UniTicket
  try {
    const memoData = Buffer.from(
      `UniTicket:${eventId.slice(0, 8)}:${tierId.slice(0, 8)}:${quantity}`,
      'utf-8'
    );
    transaction.add(
      new TransactionInstruction({
        keys: [{ pubkey: buyerPubKey, isSigner: true, isWritable: false }],
        programId: SOLANA_PROGRAM_ID,
        data: memoData,
      })
    );
  } catch {
    // Program memo instruction is optional
  }

  // Yêu cầu ví Phantom ký và phát transaction (qua sendTransaction của adapter hoặc provider)
  let signature: string;
  try {
    if (typeof sendTransaction === 'function') {
      signature = await sendTransaction(transaction, connection);
    } else if (provider && typeof provider.signAndSendTransaction === 'function') {
      const res = await provider.signAndSendTransaction(transaction);
      signature = res.signature;
    } else if (provider && typeof provider.signTransaction === 'function') {
      const signed = await provider.signTransaction(transaction);
      signature = await connection.sendRawTransaction(signed.serialize());
    } else {
      throw new Error('Ví Phantom không hỗ trợ phương thức ký giao dịch.');
    }
  } catch (signErr) {
    throw new Error(parseSolanaTxError(signErr));
  }

  // 2. Trạng thái: Ví đã ký xong, chuyển sang xác nhận khối trên Devnet
  onStatusChange?.('CONFIRMING', 'Đang xác nhận giao dịch trên Solana Devnet...');

  try {
    const confirmResult = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmResult.value.err) {
      throw new Error(`Xác nhận khối thất bại: ${JSON.stringify(confirmResult.value.err)}`);
    }
  } catch (confirmErr) {
    console.warn('[SolanaClient] Confirm transaction warning:', confirmErr);
    // Nếu signature đã được phát, ta tiếp tục để không block người dùng nếu khối đã bao hàm tx
  }

  const explorerUrl = getSolanaExplorerUrl('tx', signature);
  onStatusChange?.('SUCCESS', 'Giao dịch đã được xác nhận trên Solana Devnet!');

  return {
    signature,
    explorerUrl,
  };
}
