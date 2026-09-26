import React, { useEffect, useState } from 'react';
import {
  X,
  Ticket,
  Sparkles,
  User,
  Mail,
  Minus,
  Plus,
  Clock,
  Copy,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { EventItem, TicketTier, PurchasedTicket } from '../../types';
import { demoPayOrder, type OrderSummary } from '../../services/ordersApi';
import * as api from '../../services/api';
import { useTranslation } from '../../i18n';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  parseSolanaTxError,
  getSolanaExplorerUrl,
  getWalletSolBalance,
  SOLANA_TREASURY_WALLET_STR,
} from '../../services/solanaClient';
import { PhantomLogo } from '../common/PhantomLogo';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  tier: TicketTier;
  quantity: number;
  walletAddress?: string | null;
  solBalance?: number | null;
  onSuccess: (ticketsCreated: PurchasedTicket[], txSignature?: string) => void;
  onError: (msg: string) => void;
  onOpenWalletModal?: () => void;
  onConnectWallet?: () => Promise<void> | void;
  onNavigateToMyTickets?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  event,
  tier,
  quantity,
  walletAddress: _walletAddress,
  solBalance,
  onSuccess,
  onError,
  onOpenWalletModal,
  onConnectWallet,
  onNavigateToMyTickets,
}) => {
  const { t } = useTranslation();
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction, select, wallets, connect: adapterConnect } = useWallet();
  const [step, setStep] = useState<'FORM' | 'PAYMENT' | 'SUCCESS'>('FORM');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [reservation, setReservation] = useState<OrderSummary | null>(null);
  const [guestAccessToken] = useState<string>(() => localStorage.getItem('guest_access_token') ?? '');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);
  const [solanaTxSignature, setSolanaTxSignature] = useState<string | null>(null);
  const [createdTickets, setCreatedTickets] = useState<PurchasedTicket[]>([]);
  const [internalSolBalance, setInternalSolBalance] = useState<number | null>(solBalance ?? null);

  const activeWallet = publicKey ? publicKey.toBase58() : null;
  const unitPriceSol = 0.05;
  const totalSol = unitPriceSol * selectedQuantity;

  useEffect(() => {
    if (solBalance !== undefined && solBalance !== null) {
      setInternalSolBalance(solBalance);
    }
  }, [solBalance]);

  useEffect(() => {
    if (publicKey) {
      void getWalletSolBalance(publicKey.toBase58()).then((bal) => {
        if (bal !== null) {
          setInternalSolBalance(bal);
        }
      });
    }
  }, [publicKey]);

  // Tự động kết nối Solana Wallet Adapter nếu đã kết nối Phantom trên cửa sổ
  useEffect(() => {
    if (isOpen && !connected && wallets.length > 0) {
      const phantom = wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
      if (phantom) {
        select(phantom.adapter.name);
        adapterConnect().catch(() => undefined);
      }
    }
  }, [isOpen, connected, wallets, select, adapterConnect]);

  useEffect(() => {
    if (isOpen) {
      setSelectedQuantity(Math.max(1, Math.min(quantity, tier.remainingQuantity)));
      setReservation(null);
      setStep('FORM');
      setIsSubmitting(false);
      setIsVerifying(false);
      setVerificationSuccess(false);
      setVerificationMessage('');
      setSolanaTxSignature(null);
      setCreatedTickets([]);
      setCopiedField(null);
    }
  }, [isOpen, quantity, tier.id, tier.remainingQuantity]);

  // Đồng hồ đếm ngược giữ chỗ
  useEffect(() => {
    if (!reservation?.expiresAt || step === 'FORM') {
      setTimeLeftMs(0);
      return;
    }
    const updateCountdown = () => {
      const expiresTime = new Date(reservation.expiresAt).getTime();
      const remaining = Math.max(0, expiresTime - Date.now());
      setTimeLeftMs(remaining);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [reservation?.expiresAt, step]);

  if (!isOpen) return null;

  const formatCountdown = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isExpired = Boolean(reservation && timeLeftMs <= 0);

  const copyToClipboard = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Hàm thực hiện chuyển 0.05 SOL trực tiếp trên Solana Devnet qua ví Phantom
  const executeSolanaPayment = async () => {
    if (!connected || !publicKey) {
      onError('Vui lòng kết nối ví Phantom trước khi thanh toán.');
      await handleConnectWalletFromModal();
      return;
    }

    if (hasInsufficientSol) {
      onError(`Số dư SOL không đủ để thanh toán (${internalSolBalance?.toFixed(4)} < ${totalSol.toFixed(2)} SOL).`);
      return;
    }

    setIsVerifying(true);
    setVerificationSuccess(false);
    setVerificationMessage('Vui lòng ký giao dịch trên ví Phantom...');

    try {
      // 1. Tạo transaction chuyển SOL thật trên Devnet bằng SystemProgram.transfer
      const treasuryPubKey = new PublicKey(SOLANA_TREASURY_WALLET_STR);
      const lamportsToSend = Math.round(0.05 * LAMPORTS_PER_SOL * selectedQuantity);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasuryPubKey,
          lamports: lamportsToSend,
        })
      );

      // BẮT BUỘC gọi sendTransaction để ví Phantom hiển thị popup yêu cầu người dùng xác nhận chuyển SOL
      const signature = await sendTransaction(transaction, connection);

      setSolanaTxSignature(signature);
      setVerificationMessage('Đang xác nhận giao dịch trên Solana Devnet...');

      const latestBlockHash = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        },
        'confirmed'
      );

      setVerificationMessage('Giao dịch đã xác nhận on-chain! Đang phát hành vé NFT...');
      setVerificationSuccess(true);

      // 2. Tạo vé và lưu vào LocalStorage để hiển thị ở tab "Vé Của Tôi"
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const orderId = `ORD-${nowMs.toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newTickets: PurchasedTicket[] = [];
      for (let i = 0; i < selectedQuantity; i++) {
        const ticketId = `tkt-${nowMs}-${i}`;
        const ticketCode = `UTK-${orderId.slice(-4)}-${i + 1}`;
        const qrPayload = JSON.stringify({
          ticketId,
          orderId,
          eventId: event.id,
          eventTitle: event.title,
          tierId: tier.id,
          tierName: tier.name,
          customerWallet: publicKey.toBase58(),
          customerName: customerName.trim() || 'Khách tham dự',
          customerEmail: customerEmail.trim() || 'customer@uniticket.io',
          txSignature: signature,
          timestamp: nowMs,
          signatureVersion: 'mock-v1',
        });

        newTickets.push({
          id: ticketId,
          orderId,
          eventId: event.id,
          eventTitle: event.title,
          eventBanner: event.bannerImage || event.thumbnailImage || '',
          venue: event.venue,
          city: event.city,
          date: event.date,
          time: event.time,
          tierId: tier.id,
          tierName: tier.name,
          seat: `ZONE-${tier.name.slice(0, 2).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
          priceSol: 0.05,
          ticketCode,
          customerName: customerName.trim() || 'Khách tham dự',
          customerEmail: customerEmail.trim() || 'customer@uniticket.io',
          customerWallet: publicKey.toBase58(),
          purchasedAt: nowIso,
          purchaseDate: nowIso,
          status: 'valid',
          isCheckedIn: false,
          timestamp: nowMs,
          signatureVersion: 'mock-v1',
          checkInStatus: 'unused',
          qrPayload,
          nftTransactionSignature: signature,
          nftStatus: 'MINTED',
        });
      }

      // Lưu vé thông qua MOCK API Data Layer
      await api.createTickets(event.id, tier.id, selectedQuantity, newTickets);

      if (reservation?.id) {
        demoPayOrder(reservation.id, guestAccessToken || undefined, signature).catch(() => undefined);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      setIsVerifying(false);
      setCreatedTickets(newTickets);
      setStep('SUCCESS');
      onSuccess(newTickets, signature);
    } catch (err) {
      setIsVerifying(false);
      setVerificationSuccess(false);
      setVerificationMessage('');
      const friendlyError = parseSolanaTxError(err);
      onError(friendlyError);
    }
  };

  // Bước 1: Khi bấm "Tiếp tục thanh toán qua Solana Devnet", kích hoạt ngay luồng ký ví Phantom
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !customerEmail.trim()) {
      onError('Vui lòng điền đầy đủ họ tên và email nhận vé.');
      return;
    }

    if (!connected || !publicKey) {
      try {
        const phantom = wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
        if (phantom) {
          select(phantom.adapter.name);
          await adapterConnect();
        }
      } catch (err) {
        console.warn('Auto adapter connect attempt:', err);
      }
    }

    if (!connected || !publicKey) {
      onError('Vui lòng kết nối ví Phantom trước khi tiếp tục thanh toán.');
      await handleConnectWalletFromModal();
      return;
    }

    // Thực hiện luồng thanh toán Solana Devnet ngay lập tức, bắt buộc mở popup ví Phantom
    await executeSolanaPayment();
  };

  const handleConnectWalletFromModal = async () => {
    try {
      const phantom = wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
      if (phantom) {
        select(phantom.adapter.name);
        await adapterConnect();
      }
    } catch (err) {
      console.warn('Modal adapter connect notice:', err);
    }
    if (onConnectWallet) {
      await onConnectWallet();
    } else {
      onOpenWalletModal?.();
    }
  };

  const handleViewMyTickets = () => {
    onClose();
    if (onNavigateToMyTickets) {
      onNavigateToMyTickets();
    }
  };

  // BƯỚC 2: KÝ & GỬI TRANSACTION CHUYỂN SOL THẬT TRÊN SOLANA DEVNET QUA VÍ PHANTOM
  const handleBuyWithSolana = async () => {
    await executeSolanaPayment();
  };

  const hasInsufficientSol = internalSolBalance !== null && internalSolBalance < totalSol;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md transition-all overflow-y-auto">
      <div className="fixed inset-0" onClick={isVerifying ? undefined : onClose} />

      <div className="relative w-full max-w-lg my-auto rounded-2xl bg-[#0F0A28] border border-solana-purple/40 p-5 sm:p-7 shadow-2xl shadow-purple-950/80 z-10 overflow-hidden animate-scaleUp text-left max-h-[90vh] overflow-y-auto">
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-solana-purple/20 rounded-full blur-3xl pointer-events-none" />

        {/* Nút đóng modal */}
        <button
          onClick={onClose}
          disabled={isVerifying}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề Modal */}
        <div className="pb-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-solana-purple/30 border border-solana-purple/50 flex items-center justify-center text-solana-cyan shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>{step === 'SUCCESS' ? 'Xác Nhận Vé NFT' : 'Thanh Toán Vé Solana'}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-solana-cyan/20 text-solana-cyan border border-solana-cyan/40">
                Devnet
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {step === 'FORM' && 'Nhập thông tin người nhận vé và chọn số lượng'}
              {step === 'PAYMENT' && 'Ký giao dịch on-chain trên Solana Devnet qua ví Phantom'}
              {step === 'SUCCESS' && 'Giao dịch on-chain đã hoàn tất và vé đã được phát hành'}
            </p>
          </div>
        </div>

        {/* BƯỚC 1: FORM THÔNG TIN NGƯỜI MUA */}
        {step === 'FORM' && (
          <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
            {/* Tóm tắt hạng vé & Giá bằng SOL */}
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 space-y-3">
              <div className="text-xs text-slate-300 border-b border-white/10 pb-2">
                <span className="text-slate-400 block text-[11px]">Sự kiện:</span>
                <strong className="text-white text-sm block mt-0.5 line-clamp-1">{event.title}</strong>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('checkout.selectedTier')}:</span>
                  <strong className="text-solana-cyan block mt-0.5">{tier.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Đơn giá:</span>
                  <span className="text-solana-green block mt-0.5 font-mono font-bold">
                    0.05 SOL (Solana Devnet)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mạng Blockchain:</span>
                  <span className="text-white block mt-0.5 font-medium">Solana Devnet</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phí mạng ước tính:</span>
                  <span className="text-solana-green block mt-0.5 font-mono">~0.000005 SOL</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white">Tổng thanh toán:</span>
                <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-solana-cyan to-solana-green font-mono">
                  {totalSol.toFixed(2)} SOL
                </span>
              </div>
            </div>

            {/* Chọn số lượng */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div>
                <span className="block text-xs font-semibold text-white">{t('checkout.quantityLabel')}</span>
                <span className="text-[11px] text-slate-400">{t('checkout.maxTicketsHint', { count: tier.remainingQuantity })}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0620] p-1">
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((current) => Math.max(1, current - 1))}
                  disabled={selectedQuantity <= 1}
                  aria-label="Giảm số lượng vé"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-mono font-bold text-white">{selectedQuantity}</span>
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((current) => Math.min(tier.remainingQuantity, current + 1))}
                  disabled={selectedQuantity >= tier.remainingQuantity}
                  aria-label="Tăng số lượng vé"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Thông tin người nhận vé */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-solana-cyan" />
                <span>{t('checkout.fullNameLabel')}</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('checkout.fullNamePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neon-pink" />
                <span>{t('checkout.emailLabel')}</span>
              </label>
              <input
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder={t('checkout.emailPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isVerifying}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-solana-cyan" />
                    <span>{verificationMessage || 'Đang mở ví Phantom...'}</span>
                  </>
                ) : (
                  <>
                    <PhantomLogo className="w-5 h-5 shrink-0" />
                    <span>Tiếp tục thanh toán qua Solana Devnet</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-slate-400 mt-2">
                Hệ thống sẽ kết nối ví Phantom để xác nhận giao dịch {totalSol.toFixed(2)} SOL trên Solana Devnet.
              </p>
            </div>
          </form>
        )}

        {/* BƯỚC 2: CỔNG THANH TOÁN ON-CHAIN SOLANA DEVNET (BẮT BUỘC MỞ VÍ PHANTOM) */}
        {step === 'PAYMENT' && reservation && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            {/* Banner trạng thái & Countdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-purple-950/40 border border-solana-purple/50">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${isExpired ? 'text-neon-pink' : 'text-solana-cyan animate-pulse'}`} />
                <span className="text-xs text-slate-300">
                  {isExpired ? t('checkout.expiredReservation') : 'Thời gian giữ vé on-chain còn lại:'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-solana-cyan/20 text-solana-cyan border border-solana-cyan/40">
                  SOLANA_DEVNET
                </span>
                <div className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                  isExpired ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40' : 'bg-solana-cyan/10 text-solana-cyan border border-solana-cyan/30'
                }`}>
                  {isExpired ? '00:00 (Hết hạn)' : formatCountdown(timeLeftMs)}
                </div>
              </div>
            </div>

            {/* Chi tiết đơn hàng và Giá vé quy đổi ra SOL */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-solana-purple/20 via-[#170E38] to-solana-cyan/10 border border-solana-purple/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs text-slate-400">Mã đơn hàng:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-solana-cyan">{reservation.orderCode}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(reservation.orderCode, 'orderCode')}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title={t('common.copy')}
                  >
                    {copiedField === 'orderCode' ? <Check className="w-3.5 h-3.5 text-solana-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[11px]">Sự kiện:</span>
                  <span className="text-white block mt-0.5 font-medium truncate">{event.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Hạng vé &amp; SL:</span>
                  <span className="text-white block mt-0.5">{tier.name} × {selectedQuantity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Giá vé:</span>
                  <span className="text-solana-green block mt-0.5 font-mono font-bold">0.05 SOL (Solana Devnet)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phí mạng (Gas fee):</span>
                  <span className="text-solana-green block mt-0.5 font-mono font-bold">~0.000005 SOL</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Tổng thanh toán:</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedQuantity > 1 ? `${selectedQuantity} × 0.05 SOL` : '0.05 SOL (Solana Devnet)'}
                  </span>
                </div>
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-solana-cyan via-white to-solana-green font-mono">
                  {totalSol.toFixed(2)} SOL
                </span>
              </div>
            </div>

            {/* Trạng thái kết nối ví Phantom & Số dư SOL Devnet */}
            {activeWallet ? (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-solana-purple/30 flex items-center justify-center p-1.5 border border-solana-purple/50 shrink-0">
                      <PhantomLogo className="w-full h-full" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Ví thanh toán Phantom</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-solana-green">
                          <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
                          <span>Devnet</span>
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-white">
                        {activeWallet.slice(0, 4)}...{activeWallet.slice(-4)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Số dư SOL Devnet</span>
                    <span className="font-mono text-xs font-bold text-solana-cyan">
                      {internalSolBalance !== null ? `${internalSolBalance.toFixed(4)} SOL` : '-- SOL'}
                    </span>
                  </div>
                </div>

                {hasInsufficientSol && (
                  <div className="p-2.5 rounded-lg bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-between gap-2 text-xs">
                    <span className="text-pink-200 text-[11px]">
                      Số dư SOL không đủ để thanh toán ({internalSolBalance.toFixed(4)} &lt; {totalSol.toFixed(2)} SOL).
                    </span>
                    <a
                      href="https://faucet.solana.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-neon-pink/20 hover:bg-neon-pink/30 text-neon-pink border border-neon-pink/50 text-[11px] font-bold shrink-0 transition-colors"
                    >
                      Nhận SOL Faucet
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-purple-950/30 border border-solana-purple/40 space-y-3 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Chưa phát hiện ví Phantom nào được kết nối</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Vui lòng kết nối ví Phantom để ký giao dịch mua vé và xác nhận quyền sở hữu NFT trên Solana Devnet.
                </p>
                <button
                  type="button"
                  onClick={handleConnectWalletFromModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-950/50"
                >
                  <PhantomLogo className="w-4 h-4" />
                  <span>Kết nối ví Phantom</span>
                </button>
              </div>
            )}

            {/* Trạng thái xác minh đang chạy (Bắt buộc mở ví và chờ xác nhận) */}
            {isVerifying && (
              <div className="p-4 rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-solana-cyan font-semibold text-sm">
                  {verificationSuccess ? <CheckCircle2 className="w-5 h-5 text-solana-green" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>{verificationMessage}</span>
                </div>
                {solanaTxSignature && (
                  <div className="pt-1">
                    <a
                      href={getSolanaExplorerUrl(solanaTxSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-solana-cyan underline hover:text-white transition-colors"
                    >
                      <span>Xem giao dịch trên Solana Explorer</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
                <p className="text-[11px] text-slate-300">
                  Đang tương tác trực tiếp với mạng Solana Devnet &amp; Smart Contract...
                </p>
              </div>
            )}

            {/* Nút hành động Bước 2 */}
            {!isVerifying && (
              <div className="space-y-2 pt-1">
                {activeWallet ? (
                  <button
                    type="button"
                    onClick={handleBuyWithSolana}
                    disabled={isVerifying || isExpired || hasInsufficientSol}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-solana-purple via-[#9945FF] to-solana-cyan text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl shadow-purple-950/80 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <PhantomLogo className="w-5 h-5 shrink-0" />
                    <span>Xác nhận &amp; Ký giao dịch trên ví Phantom</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectWalletFromModal}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 active:scale-95 transition-all"
                  >
                    <PhantomLogo className="w-5 h-5" />
                    <span>Kết nối ví Phantom để tiếp tục</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  disabled={isVerifying}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('checkout.backBtn')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* BƯỚC 3: MÀN HÌNH HOÀN TẤT THÀNH CÔNG (SUCCESS - ON-CHAIN CONFIRMED) */}
        {step === 'SUCCESS' && (
          <div className="space-y-5 pt-2 text-center animate-fadeIn">
            {/* Header thành công */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-solana-green/20 border-2 border-solana-green/60 shadow-lg shadow-solana-green/30">
                <CheckCircle2 className="w-9 h-9 text-solana-green animate-scaleUp" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Mua vé thành công!
                </h3>
                <p className="text-xs text-solana-cyan mt-1 font-medium">
                  Giao dịch on-chain đã được xác nhận và vé NFT đã được cấp phát trên Solana Devnet.
                </p>
              </div>
            </div>

            {/* Thông tin đơn hàng & vé */}
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400">Sự kiện:</span>
                <span className="text-white font-bold line-clamp-1 max-w-[240px]">{event.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Hạng vé &amp; Số lượng:</span>
                <span className="text-solana-cyan font-medium">{tier.name} × {selectedQuantity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Số SOL đã thanh toán:</span>
                <span className="text-solana-green font-mono font-bold">{totalSol.toFixed(2)} SOL (Devnet)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Người nhận vé:</span>
                <span className="text-slate-200 font-medium">{customerName || 'Khách tham dự'}</span>
              </div>
              {createdTickets.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-slate-400">Mã vé (Ticket Code):</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {createdTickets.map((t) => (
                      <span key={t.id} className="font-mono text-solana-green bg-solana-green/10 border border-solana-green/30 px-1.5 py-0.5 rounded text-[11px] font-bold">
                        {t.ticketCode}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Khung giao dịch Solana Explorer */}
            {solanaTxSignature && (
              <div className="p-4 rounded-xl bg-solana-purple/20 border border-solana-purple/50 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-solana-cyan" />
                    <span>Mã giao dịch (Tx Signature):</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-solana-green/20 text-solana-green border border-solana-green/40">
                    Confirmed
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-black/50 border border-white/10 font-mono text-[11px] text-solana-cyan break-all select-all flex items-center justify-between gap-2">
                  <span className="line-clamp-2">{solanaTxSignature}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(solanaTxSignature, 'txSig')}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white shrink-0"
                    title={t('common.copy')}
                  >
                    {copiedField === 'txSig' ? <Check className="w-3.5 h-3.5 text-solana-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <a
                  href={`https://explorer.solana.com/tx/${solanaTxSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-purple-950/50"
                >
                  <span>https://explorer.solana.com/tx/{solanaTxSignature.slice(0, 10)}...?cluster=devnet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Nút hành động */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleViewMyTickets}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple to-solana-cyan hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-950/60"
              >
                <Ticket className="w-4 h-4" />
                <span>Xem vé trong &quot;Vé của tôi&quot; (My Tickets)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default CheckoutModal;
