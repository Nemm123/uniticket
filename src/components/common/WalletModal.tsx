import React, { useEffect, useRef, useState } from 'react';
import { X, Wallet, ShieldCheck, Sparkles, ExternalLink, HelpCircle, Copy, Check } from 'lucide-react';
import { clusterApiUrl } from '@solana/web3.js';

interface PhantomProvider {
  isPhantom?: boolean;
  isConnected: boolean;
  publicKey: { toString: () => string } | null;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: 'connect' | 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
  removeListener: (event: 'connect' | 'disconnect' | 'accountChanged', callback: (publicKey?: { toString: () => string } | null) => void) => void;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
  }
}

const DEVNET_RPC_URL = clusterApiUrl('devnet');

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletChange?: (address: string | null) => void;
  onConnectionCancelled?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onWalletChange, onConnectionCancelled }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPhantomAvailable, setIsPhantomAvailable] = useState(false);
  const onWalletChangeRef = useRef(onWalletChange);
  const onConnectionCancelledRef = useRef(onConnectionCancelled);

  onWalletChangeRef.current = onWalletChange;
  onConnectionCancelledRef.current = onConnectionCancelled;

  const updateWalletAddress = (address: string | null) => {
    setWalletAddress(address);
    onWalletChangeRef.current?.(address);
  };

  // Use Phantom's namespaced provider only. `window.solana` is a shared legacy
  // namespace and can belong to a different wallet when multiple extensions exist.
  const getPhantomProvider = () => window.phantom?.solana;
  const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    let activeProvider: PhantomProvider | null = null;
    let removeListeners = () => {};

    const attachProvider = () => {
      const provider = getPhantomProvider();
      const isAvailable = Boolean(provider?.isPhantom);
      setIsPhantomAvailable(isAvailable);
      if (!isAvailable || !provider || provider === activeProvider) return;

      removeListeners();
      activeProvider = provider;
      const handleConnect = (publicKey?: { toString: () => string } | null) => {
        updateWalletAddress(publicKey?.toString() ?? provider.publicKey?.toString() ?? null);
      };
      const handleDisconnect = () => updateWalletAddress(null);
      const handleAccountChanged = (publicKey?: { toString: () => string } | null) => {
        updateWalletAddress(publicKey?.toString() ?? null);
      };

      if (provider.isConnected && provider.publicKey) {
        handleConnect(provider.publicKey);
      }
      provider.on('connect', handleConnect);
      provider.on('disconnect', handleDisconnect);
      provider.on('accountChanged', handleAccountChanged);
      removeListeners = () => {
        provider.removeListener('connect', handleConnect);
        provider.removeListener('disconnect', handleDisconnect);
        provider.removeListener('accountChanged', handleAccountChanged);
      };
    };

    attachProvider();
    const providerCheck = window.setInterval(attachProvider, 250);
    return () => {
      window.clearInterval(providerCheck);
      removeListeners();
    };
  }, []);

  const connectPhantom = async () => {
    const provider = getPhantomProvider();
    setWalletError(null);

    if (!provider?.isPhantom) {
      setWalletError(
        isMobileDevice()
          ? 'Phiên bản này kết nối Phantom trên điện thoại qua Phantom Browser. Hãy mở UniTicket trong ứng dụng Phantom rồi thử lại.'
          : 'Chưa phát hiện extension Phantom. Vui lòng cài Phantom và tải lại trang.',
      );
      onConnectionCancelledRef.current?.();
      return;
    }

    setIsConnecting(true);
    try {
      const response = await provider.connect();
      updateWalletAddress(response.publicKey.toString());
    } catch (error) {
      const isRejected = typeof error === 'object' && error !== null && 'code' in error && error.code === 4001;
      setWalletError(isRejected ? 'Bạn đã từ chối yêu cầu kết nối Phantom.' : 'Không thể kết nối Phantom. Vui lòng thử lại.');
      onConnectionCancelledRef.current?.();
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectPhantom = async () => {
    const provider = getPhantomProvider();
    if (!provider) return;

    try {
      await provider.disconnect();
      updateWalletAddress(null);
      setWalletError(null);
    } catch {
      setWalletError('Không thể ngắt kết nối Phantom. Vui lòng thử lại.');
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

  const walletProviders = [
    {
      name: 'Phantom Wallet',
      description: 'Ví phổ biến nhất trên hệ sinh thái Solana',
      iconEmoji: '👻',
      badge: 'Khuyên Dùng',
      isPopular: true,
      url: 'https://phantom.app/',
    },
    {
      name: 'Solflare',
      description: 'Ví bảo mật cao hỗ trợ đầy đủ NFT & Staking',
      iconEmoji: '🔥',
      badge: 'Solana Native',
      isPopular: false,
      url: 'https://solflare.com/',
    },
    {
      name: 'Backpack',
      description: 'Ví Web3 thế hệ mới tích hợp chuẩn xNFT',
      iconEmoji: '🎒',
      badge: 'xNFT Ready',
      isPopular: false,
      url: 'https://backpack.app/',
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-md transition-all sm:items-center">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Content with Entrance Animation */}
      <div className="relative my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-[#0F0A28] border border-solana-purple/40 p-5 sm:p-6 shadow-2xl shadow-purple-950/70 z-10 transform transition-all animate-scaleUp">
        {/* Neon decorative glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-solana-purple/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-solana-green/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-solana-purple to-neon-pink text-white shadow-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Kết Nối Ví Web3
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-solana-purple/30 border border-solana-purple/50 text-purple-200">
                  Solana
                </span>
              </h3>
              <p className="text-xs text-slate-300">Chọn ví Solana để quản lý vé NFT</p>
            </div>
          </div>
          {/* Nút đóng kích thước touch-target tối thiểu 44px */}
          <button
            onClick={onClose}
            aria-label="Đóng modal"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet status */}
        <div className="my-4 p-3 rounded-xl bg-purple-950/50 border border-solana-purple/40 text-xs text-purple-200 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-solana-green shrink-0 mt-0.5 animate-pulse" />
          <div>
            <p className="font-semibold text-white">
              {walletAddress ? 'Connected' : 'Disconnected'} · Solana Devnet
            </p>
            <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px] sm:text-xs">
              Chọn mạng Devnet trong Phantom trước khi kết nối. Chỉ kiểm tra địa chỉ, không thực hiện giao dịch hoặc yêu cầu ký.
            </p>
            {walletAddress && (
              <div className="mt-2 flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-solana-green" title={walletAddress}>{`${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`}</span>
                <button
                  onClick={copyAddress}
                  className="inline-flex items-center gap-1 text-solana-cyan hover:text-white hover:underline shrink-0"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Đã sao chép' : 'Copy Address'}
                </button>
                <button
                  onClick={disconnectPhantom}
                  className="text-solana-cyan hover:text-white hover:underline shrink-0"
                >
                  Ngắt kết nối
                </button>
              </div>
            )}
          </div>
        </div>

        {walletError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-400/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            {walletError}
          </div>
        )}

        {!isPhantomAvailable && (
          <div className="mb-4 rounded-xl border border-yellow-400/40 bg-yellow-950/30 px-3 py-2 text-xs text-yellow-100">
            {isMobileDevice() ? (
              <>
                <p className="font-semibold">Đang dùng Chrome hoặc Safari?</p>
                <p className="mt-1 leading-relaxed">Mở ứng dụng Phantom, vào Browser, sau đó truy cập lại UniTicket. Phantom chỉ inject provider trong browser tích hợp của ứng dụng; website sẽ không yêu cầu seed phrase hoặc private key.</p>
                <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-solana-cyan hover:underline">Cài/mở Phantom</a>
              </>
            ) : (
              <>Phantom chưa được cài đặt. Hãy cài ví từ <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="text-solana-cyan hover:underline">phantom.app</a>, sau đó tải lại trang.</>
            )}
          </div>
        )}

        {/* Wallets List */}
        <div className="space-y-2.5">
          {walletProviders.map((w) => (
            <button
              key={w.name}
              onClick={() => {
                if (w.name === 'Phantom Wallet') {
                  void connectPhantom();
                } else {
                  alert(`Bạn vừa chọn xem trước ví ${w.name}! Tính năng ký ví Web3 sẽ kích hoạt ở Phase tiếp theo.`);
                  onClose();
                }
              }}
              disabled={w.name === 'Phantom Wallet' && isConnecting}
              className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-[#171038]/85 hover:bg-[#251854] border border-white/10 hover:border-solana-purple/50 active:scale-[0.98] transition-all duration-200 group text-left shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform shrink-0">
                  <span>{w.iconEmoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-white group-hover:text-solana-cyan transition-colors truncate">
                      {w.name === 'Phantom Wallet' && isConnecting ? 'Đang kết nối...' : w.name}
                    </span>
                    {w.badge && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-solana-green/15 text-solana-green border border-solana-green/30 shrink-0">
                        {w.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 sm:line-clamp-1 break-words">{w.description}</p>
                </div>
              </div>
              {w.name === 'Phantom Wallet' ? (
                <span className="text-xs text-solana-cyan shrink-0 ml-2">{walletAddress ? 'Đã kết nối' : 'Kết nối'}</span>
              ) : (
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>

        {/* Help: Download phantom guide */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-solana-cyan" />
            <span>Mới sử dụng Solana?</span>
          </div>
          <a
            href="https://phantom.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-solana-cyan hover:text-white font-medium hover:underline inline-flex items-center gap-1"
          >
            <span>Tải ví Phantom</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
          Kết nối ví chỉ xác nhận địa chỉ. Checkout và QR ticket hiện là dữ liệu mô phỏng trên thiết bị, không phải giao dịch blockchain.
        </p>

        {/* Security guarantee */}
        <div className="mt-3 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-solana-green" />
          <span>Devnet RPC: {new URL(DEVNET_RPC_URL).hostname}</span>
        </div>
      </div>
    </div>
  );
};
