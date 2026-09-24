import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { authenticatePhantomWallet } from '../../services/authApi';
import { WalletSession } from '../../services/authSession';
import { PhantomLogo } from './PhantomLogo';

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, display?: 'utf8') => Promise<{ signature: Uint8Array }>;
  on: (event: 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
  removeListener: (event: 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
}

declare global { interface Window { phantom?: { solana?: PhantomProvider }; } }

interface WalletModalProps {
  isOpen: boolean; onClose: () => void; onWalletChange?: (address: string | null) => void;
  onAuthenticated?: (session: WalletSession) => void; onConnectionCancelled?: () => void;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onWalletChange, onAuthenticated, onConnectionCancelled }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPhantomAvailable, setIsPhantomAvailable] = useState(false);
  const onWalletChangeRef = useRef(onWalletChange);
  const onConnectionCancelledRef = useRef(onConnectionCancelled);
  const onAuthenticatedRef = useRef(onAuthenticated);
  onWalletChangeRef.current = onWalletChange;
  onConnectionCancelledRef.current = onConnectionCancelled;
  onAuthenticatedRef.current = onAuthenticated;
  const updateWalletAddress = (address: string | null) => { setWalletAddress(address); onWalletChangeRef.current?.(address); };
  const getPhantomProvider = () => window.phantom?.solana;
  const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    let activeProvider: PhantomProvider | null = null;
    let removeListeners = () => {};
    const attachProvider = () => {
      const provider = getPhantomProvider();
      setIsPhantomAvailable(Boolean(provider?.isPhantom));
      if (!provider?.isPhantom || provider === activeProvider) return;
      removeListeners(); activeProvider = provider;
      const clearWallet = () => updateWalletAddress(null);
      provider.on('disconnect', clearWallet); provider.on('accountChanged', clearWallet);
      removeListeners = () => { provider.removeListener('disconnect', clearWallet); provider.removeListener('accountChanged', clearWallet); };
    };
    attachProvider();
    const providerCheck = window.setInterval(attachProvider, 250);
    return () => { window.clearInterval(providerCheck); removeListeners(); };
  }, []);

  const connectPhantom = async () => {
    const provider = getPhantomProvider(); setWalletError(null);
    if (!provider?.isPhantom) {
      setWalletError(isMobileDevice() ? 'Hãy mở UniTicket trong trình duyệt tích hợp của ứng dụng Phantom rồi thử lại.' : 'Chưa phát hiện extension Phantom. Vui lòng cài Phantom và tải lại trang.');
      onConnectionCancelledRef.current?.(); return;
    }
    setIsConnecting(true);
    try {
      const response = await provider.connect();
      const session = await authenticatePhantomWallet(response.publicKey.toString(), provider);
      updateWalletAddress(session.walletAddress); onAuthenticatedRef.current?.(session);
    } catch (error) {
      const isRejected = typeof error === 'object' && error !== null && 'code' in error && error.code === 4001;
      setWalletError(isRejected ? 'Bạn đã từ chối yêu cầu kết nối Phantom.' : 'Không thể kết nối Phantom. Vui lòng thử lại.');
      onConnectionCancelledRef.current?.();
    } finally { setIsConnecting(false); }
  };

  const disconnectPhantom = async () => {
    const provider = getPhantomProvider();
    try { if (provider?.isPhantom) await provider.disconnect(); updateWalletAddress(null); setWalletError(null); }
    catch { setWalletError('Không thể ngắt kết nối Phantom. Vui lòng thử lại.'); }
  };
  const copyAddress = async () => {
    if (!walletAddress) return;
    try { await navigator.clipboard.writeText(walletAddress); setIsCopied(true); window.setTimeout(() => setIsCopied(false), 1500); }
    catch { setWalletError('Không thể sao chép địa chỉ ví trên trình duyệt này.'); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <button type="button" aria-label="Đóng modal kết nối ví" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title" className="relative w-full max-w-md rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl shadow-purple-950/70 sm:p-6">
        <div className="flex items-start justify-between border-b border-white/10 pb-4"><div><h2 id="wallet-modal-title" className="text-lg font-bold text-white">Kết nối ví</h2><p className="mt-1 text-xs text-slate-300">Chỉ hỗ trợ Phantom trên Solana Devnet.</p></div><button type="button" onClick={onClose} aria-label="Đóng modal" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></div>
        {walletAddress ? (
          <div className="mt-5 rounded-2xl border border-solana-green/30 bg-solana-green/10 p-4"><div className="flex items-center gap-3"><PhantomLogo className="h-11 w-11" /><div><p className="font-semibold text-white">Phantom</p><p className="text-sm text-solana-green">{shortAddress(walletAddress)}</p></div><span className="ml-auto rounded-full border border-solana-green/30 px-2 py-1 text-[10px] font-bold text-solana-green">Đã kết nối</span></div><div className="mt-4 flex gap-3"><button type="button" onClick={() => void copyAddress()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5">{isCopied ? <Check className="h-4 w-4 text-solana-green" /> : <Copy className="h-4 w-4" />}{isCopied ? 'Đã sao chép' : 'Sao chép địa chỉ'}</button><button type="button" onClick={() => void disconnectPhantom()} className="min-h-11 flex-1 rounded-xl border border-neon-pink/40 px-3 text-xs font-bold text-neon-pink hover:bg-neon-pink/10">Ngắt kết nối</button></div></div>
        ) : (
          <div className="mt-5"><button type="button" onClick={() => void connectPhantom()} disabled={isConnecting} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#171038] p-4 text-left transition hover:border-solana-purple/60 hover:bg-[#21154a] disabled:cursor-wait disabled:opacity-60"><PhantomLogo className="h-12 w-12" /><span className="min-w-0 flex-1"><span className="block text-base font-bold text-white">Phantom</span><span className="mt-1 block text-xs text-slate-300">{isConnecting ? 'Đang kết nối Phantom…' : 'Kết nối ví Phantom'}</span></span><span className="rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2 py-1 text-[10px] font-bold text-solana-cyan">Devnet</span></button>{!isPhantomAvailable && <p className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-3 text-xs leading-relaxed text-yellow-100">Phantom chưa sẵn sàng. {isMobileDevice() ? 'Mở UniTicket trong ứng dụng Phantom.' : 'Cài extension Phantom rồi tải lại trang.'} <a href="https://phantom.com/download" target="_blank" rel="noopener noreferrer" className="font-semibold text-solana-cyan underline">Tải Phantom <ExternalLink className="inline h-3 w-3" /></a></p>}</div>
        )}
        {walletError && <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">{walletError}</p>}
        <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-solana-green" />UniTicket không yêu cầu seed phrase, private key hoặc giao dịch khi kết nối.</div>
      </section>
    </div>
  );
};
