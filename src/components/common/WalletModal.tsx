import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, X, Loader2, Coins } from 'lucide-react';
import { WalletSession } from '../../services/authSession';
import { PhantomLogo } from './PhantomLogo';
import { useTranslation } from '../../i18n';
import { formatSolBalance, SOLANA_DEVNET_FAUCET_URL, getWalletSolBalance } from '../../services/solanaClient';

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  isConnected?: boolean;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, display?: 'utf8') => Promise<{ signature: Uint8Array }>;
  on: (event: 'connect' | 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
  removeListener: (event: 'connect' | 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  }
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
  solBalance?: number | null;
  onWalletChange?: (address: string | null) => void;
  onAuthenticated?: (session: WalletSession) => void;
  onConnectionCancelled?: () => void;
  onDisconnect?: () => void;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

export function logPhantomDebug(step: string, data?: Record<string, unknown>): void {
  const elapsed = typeof performance !== 'undefined' ? `${performance.now().toFixed(1)}ms` : `${Date.now()}`;
  if (data) {
    console.log(`[PHANTOM_DEBUG][+${elapsed}] ${step}`, data);
  } else {
    console.log(`[PHANTOM_DEBUG][+${elapsed}] ${step}`);
  }
}

export const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window === 'undefined') return null;
  if ('phantom' in window && window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }
  if ('solana' in window && window.solana?.isPhantom) {
    return window.solana;
  }
  return null;
};

let activeConnectPromise: Promise<{ publicKey: { toString: () => string } }> | null = null;

export async function safeConnectPhantom(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString: () => string } }> {
  const isOnlyIfTrusted = Boolean(options?.onlyIfTrusted);
  logPhantomDebug(`safeConnectPhantom START (onlyIfTrusted=${isOnlyIfTrusted})`, {
    hadActivePromise: Boolean(activeConnectPromise),
  });

  if (activeConnectPromise) {
    logPhantomDebug('safeConnectPhantom: awaiting existing in-flight connect promise');
    return activeConnectPromise;
  }

  const provider = getPhantomProvider();
  if (!provider) {
    logPhantomDebug('safeConnectPhantom: provider not found');
    throw new Error('Chưa phát hiện tiện ích Phantom.');
  }

  logPhantomDebug('safeConnectPhantom: invoking provider.connect()', {
    onlyIfTrusted: isOnlyIfTrusted,
    providerIsConnected: Boolean(provider.isConnected),
    providerHasPublicKey: Boolean(provider.publicKey),
    isPhantomNamespace: provider === window.phantom?.solana,
  });

  activeConnectPromise = provider.connect(options)
    .then((result) => {
      logPhantomDebug(`safeConnectPhantom RESOLVED (onlyIfTrusted=${isOnlyIfTrusted})`, {
        hasPublicKey: Boolean(result?.publicKey || provider.publicKey),
      });
      return result;
    })
    .catch((err: unknown) => {
      const errObj = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : null;
      logPhantomDebug(`safeConnectPhantom REJECTED (onlyIfTrusted=${isOnlyIfTrusted})`, {
        code: errObj?.code,
        message: errObj?.message || (err instanceof Error ? err.message : String(err)),
        name: errObj?.name || (err instanceof Error ? err.name : undefined),
        data: errObj?.data,
        isErrorInstance: err instanceof Error,
      });
      throw err;
    })
    .finally(() => {
      activeConnectPromise = null;
      logPhantomDebug(`safeConnectPhantom FINALLY (onlyIfTrusted=${isOnlyIfTrusted}) cleared active promise`);
    });

  return activeConnectPromise;
}

export function extractWalletErrorMessage(error: unknown): string {
  if (!error) return 'Đã xảy ra lỗi không xác định khi kết nối ví.';

  let code: number | string | undefined;
  let message: string | undefined;
  let data: unknown;

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    code = (errObj.code as number | string | undefined) ?? (errObj.statusCode as number | string | undefined);
    message = typeof errObj.message === 'string' ? errObj.message : undefined;
    data = errObj.data;
  } else if (typeof error === 'string') {
    message = error;
  }

  const lowerMsg = (message || '').toLowerCase();
  const isUserRejected =
    code === 4001 ||
    (code === -32603 && lowerMsg.includes('rejected')) ||
    lowerMsg.includes('user rejected') ||
    lowerMsg.includes('rejected the request');

  if (isUserRejected) {
    return 'Bạn đã từ chối yêu cầu kết nối ví Phantom.';
  }

  if (error instanceof Error && error.name === 'AuthApiError') {
    return 'Lỗi kết nối ví Phantom.';
  }

  const parts: string[] = [];
  if (code !== undefined) {
    parts.push(`Mã [${code}]`);
  }
  if (message) {
    parts.push(message);
  }
  if (data && typeof data === 'object') {
    try {
      const dataStr = JSON.stringify(data);
      if (dataStr.length < 120) {
        parts.push(`Chi tiết: ${dataStr}`);
      }
    } catch {
      // ignore serialization error
    }
  }

  if (parts.length > 0) {
    return `Lỗi kết nối Phantom: ${parts.join(' - ')}`;
  }

  if (error instanceof Error && error.message) {
    return `Lỗi kết nối Phantom: ${error.message}`;
  }

  return 'Không thể kết nối ví Phantom. Vui lòng kiểm tra lại tiện ích và thử lại.';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  walletAddress: currentWalletAddress,
  solBalance,
  onWalletChange,
  onAuthenticated,
  onConnectionCancelled,
  onDisconnect,
}) => {
  const { t } = useTranslation();
  const [walletAddress, setWalletAddress] = useState<string | null>(currentWalletAddress ?? null);
  const [localBalance, setLocalBalance] = useState<number | null>(solBalance ?? null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPhantomAvailable, setIsPhantomAvailable] = useState(false);

  const isConnectingRef = useRef(false);
  const onWalletChangeRef = useRef(onWalletChange);
  const onConnectionCancelledRef = useRef(onConnectionCancelled);
  const onAuthenticatedRef = useRef(onAuthenticated);

  onWalletChangeRef.current = onWalletChange;
  onConnectionCancelledRef.current = onConnectionCancelled;
  onAuthenticatedRef.current = onAuthenticated;

  // Đồng bộ địa chỉ ví từ parent
  useEffect(() => {
    setWalletAddress(currentWalletAddress ?? null);
  }, [currentWalletAddress]);

  // Cập nhật số dư SOL khi mở modal hoặc đổi ví
  useEffect(() => {
    if (solBalance !== undefined && solBalance !== null) {
      setLocalBalance(solBalance);
    } else if (walletAddress) {
      void getWalletSolBalance(walletAddress).then((b) => setLocalBalance(b));
    } else {
      setLocalBalance(null);
    }
  }, [solBalance, walletAddress, isOpen]);

  const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Kiểm tra tiện ích Phantom và đăng ký event listeners đúng chuẩn
  useEffect(() => {
    let removeListeners: (() => void) | null = null;

    const setupProvider = async () => {
      const provider = getPhantomProvider();
      const available = Boolean(provider?.isPhantom);
      setIsPhantomAvailable(available);

      if (provider && !removeListeners) {
        const handleDisconnect = () => {
          setWalletAddress(null);
          onWalletChangeRef.current?.(null);
        };

        const handleAccountChanged = (publicKey?: { toString: () => string } | null) => {
          if (publicKey) {
            const nextAddress = publicKey.toString();
            setWalletAddress((prev) => {
              if (prev && prev !== nextAddress) {
                // Ví đổi sang account khác trong extension: cập nhật địa chỉ, không xóa session ngay
                onWalletChangeRef.current?.(nextAddress);
                return nextAddress;
              }
              return prev ?? nextAddress;
            });
          } else {
            // Khi publicKey === null: extension thực sự ngắt kết nối
            handleDisconnect();
          }
        };

        provider.on('disconnect', handleDisconnect);
        provider.on('accountChanged', handleAccountChanged);

        removeListeners = () => {
          provider.removeListener('disconnect', handleDisconnect);
          provider.removeListener('accountChanged', handleAccountChanged);
        };
      }
    };

    void setupProvider();

    // Hỗ trợ extension inject bất đồng bộ
    window.addEventListener('load', setupProvider);
    const timer = window.setTimeout(setupProvider, 300);

    return () => {
      window.removeEventListener('load', setupProvider);
      window.clearTimeout(timer);
      removeListeners?.();
    };
  }, []);

  const connectPhantom = async () => {
    logPhantomDebug('connectPhantom: CLICKED BY USER', {
      isConnectingRef: isConnectingRef.current,
      walletAddressState: walletAddress,
    });

    if (isConnectingRef.current) {
      logPhantomDebug('connectPhantom: BLOCKED by isConnectingRef guard');
      return;
    }
    isConnectingRef.current = true;
    setIsConnecting(true);
    setWalletError(null);

    const provider = getPhantomProvider();
    if (!provider?.isPhantom) {
      logPhantomDebug('connectPhantom: provider missing');
      setWalletError(
        isMobileDevice()
          ? t('walletModal.mobilePrompt')
          : t('walletModal.installPrompt')
      );
      isConnectingRef.current = false;
      setIsConnecting(false);
      onConnectionCancelledRef.current?.();
      return;
    }

    try {
      // 1. Kết nối với Phantom để lấy publicKey
      let pubKey = provider.publicKey;
      logPhantomDebug('connectPhantom: checking current provider state', {
        hasPubKey: Boolean(pubKey),
        isConnected: Boolean(provider.isConnected),
      });

      if (!pubKey || !provider.isConnected) {
        try {
          logPhantomDebug('connectPhantom: step 1 - try eager onlyIfTrusted');
          const eagerResp = await safeConnectPhantom({ onlyIfTrusted: true });
          pubKey = eagerResp?.publicKey || provider.publicKey;
          logPhantomDebug('connectPhantom: step 1 eager SUCCEEDED', {
            hasPubKey: Boolean(pubKey),
          });
        } catch (eagerErr) {
          const eagerErrObj = (typeof eagerErr === 'object' && eagerErr !== null) ? (eagerErr as Record<string, unknown>) : null;
          logPhantomDebug('connectPhantom: step 1 eager FAILED, falling back to manual connect', {
            code: eagerErrObj?.code,
            message: eagerErrObj?.message || (eagerErr instanceof Error ? eagerErr.message : String(eagerErr)),
            name: eagerErrObj?.name || (eagerErr instanceof Error ? eagerErr.name : undefined),
          });

          logPhantomDebug('connectPhantom: step 2 - starting manual connect');
          const response = await safeConnectPhantom();
          pubKey = response?.publicKey || provider.publicKey;
          logPhantomDebug('connectPhantom: step 2 manual connect SUCCEEDED', {
            hasPubKey: Boolean(pubKey),
          });
        }
      }

      if (!pubKey) {
        logPhantomDebug('connectPhantom: pubKey is missing after connect calls');
        throw new Error('Không nhận được địa chỉ ví công khai từ Phantom.');
      }

      const address = pubKey.toString();
      logPhantomDebug('connectPhantom: step 3 - got address, starting authentication', {
        addressPrefix: address.slice(0, 4),
      });

      // 2. Định danh Web3 trực tiếp từ địa chỉ ví Phantom (không phụ thuộc backend)
      logPhantomDebug('connectPhantom: step 4 - pure Web3 session generation');
      const session: WalletSession = {
        token: `pure_web3_${address}`,
        walletAddress: address,
        role: 'customer',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      logPhantomDebug('connectPhantom: step 4 - session ready', {
        role: session.role,
      });

      // 3. Cập nhật trạng thái thành công
      setWalletAddress(session.walletAddress);
      onWalletChangeRef.current?.(session.walletAddress);
      onAuthenticatedRef.current?.(session);

      // Tự động đóng modal sau khi kết nối thành công
      onClose();
    } catch (error) {
      const errObj = (typeof error === 'object' && error !== null) ? (error as Record<string, unknown>) : null;
      logPhantomDebug('connectPhantom: ERROR CAUGHT', {
        code: errObj?.code,
        message: errObj?.message || (error instanceof Error ? error.message : String(error)),
        name: errObj?.name || (error instanceof Error ? error.name : undefined),
        data: errObj?.data,
      });

      const errorMsg = extractWalletErrorMessage(error);
      setWalletError(errorMsg);
      onConnectionCancelledRef.current?.();
    } finally {
      isConnectingRef.current = false;
      setIsConnecting(false);
      logPhantomDebug('connectPhantom: FINALLY block completed');
    }
  };

  const disconnectPhantom = async () => {
    const provider = getPhantomProvider();
    try {
      if (provider?.isPhantom && provider.disconnect) {
        await provider.disconnect();
      }
    } catch (error) {
      console.warn('Disconnect error in modal:', error);
    } finally {
      setWalletAddress(null);
      setLocalBalance(null);
      onWalletChangeRef.current?.(null);
      onDisconnect?.();
      onClose();
    }
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setWalletError('Không thể sao chép địa chỉ ví trên trình duyệt này.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Đóng modal kết nối ví"
        className="absolute inset-0 cursor-default"
        onClick={isConnecting ? undefined : onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        className="relative w-full max-w-md rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl shadow-purple-950/70 sm:p-6 text-left"
      >
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <h2 id="wallet-modal-title" className="text-lg font-bold text-white">
              {t('walletModal.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {t('walletModal.subtitle')}
            </p>
          </div>
          {!isConnecting && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {walletAddress ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-solana-green/30 bg-solana-green/10 p-4">
              <div className="flex items-center gap-3">
                <PhantomLogo className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">Phantom Wallet</p>
                    <span className="rounded-full border border-solana-green/30 px-2 py-0.5 text-[10px] font-bold text-solana-green">
                      {t('walletModal.connectedBadge')}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-solana-green truncate">{shortAddress(walletAddress)}</p>
                </div>
              </div>

              {/* Devnet Network & SOL Balance */}
              <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse" />
                  <span className="font-semibold text-solana-cyan">Solana Devnet</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono font-bold text-white bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                  <Coins className="w-3.5 h-3.5 text-solana-cyan" />
                  <span>{formatSolBalance(localBalance)}</span>
                </span>
              </div>

              {/* Low Balance & Faucet Prompt */}
              {localBalance !== null && localBalance < 0.01 && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1.5 animate-pulse">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-300">Số dư SOL Devnet thấp (&lt; 0.01 SOL)</span>
                    <a
                      href={SOLANA_DEVNET_FAUCET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-amber-300 transition-colors shadow-sm"
                    >
                      <span>Nhận SOL test (Faucet)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Bạn cần một lượng nhỏ SOL Devnet để trả phí mạng (gas fee) khi mua vé NFT.
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5 active:scale-95 transition-all"
                >
                  {isCopied ? <Check className="h-4 w-4 text-solana-green" /> : <Copy className="h-4 w-4" />}
                  {isCopied ? t('common.copied') : t('walletModal.copyAddress')}
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectPhantom()}
                  className="min-h-11 flex-1 rounded-xl border border-neon-pink/40 px-3 text-xs font-bold text-neon-pink hover:bg-neon-pink/10 active:scale-95 transition-all"
                >
                  {t('walletModal.disconnect')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => void connectPhantom()}
              disabled={isConnecting}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#171038] p-4 text-left transition hover:border-solana-purple/60 hover:bg-[#21154a] disabled:cursor-wait disabled:opacity-60 active:scale-98"
            >
              {isConnecting ? (
                <Loader2 className="h-12 w-12 text-solana-cyan animate-spin" />
              ) : (
                <PhantomLogo className="h-12 w-12" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-white">Phantom</span>
                <span className="mt-1 block text-xs text-slate-300">
                  {isConnecting ? t('walletModal.connecting') : t('walletModal.connectNow')}
                </span>
              </span>
              <span className="rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2 py-1 text-[10px] font-bold text-solana-cyan">
                Devnet
              </span>
            </button>

            {!isPhantomAvailable && (
              <p className="rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-3 text-xs leading-relaxed text-yellow-100">
                {t('walletModal.notInstalled')}{' '}
                {isMobileDevice() ? t('walletModal.mobilePrompt') : t('walletModal.installPrompt')}{' '}
                <a
                  href="https://phantom.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-solana-cyan underline inline-flex items-center gap-1"
                >
                  {t('walletModal.downloadPhantom')} <ExternalLink className="inline h-3 w-3" />
                </a>
              </p>
            )}
          </div>
        )}

        {walletError && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {walletError}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-solana-green" />
          {t('walletModal.safetyNotice')}
        </div>
      </section>
    </div>
  );
};
