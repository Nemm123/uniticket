import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Ticket, 
  ArrowLeft, 
  QrCode, 
  Send, 
  ExternalLink, 
  ShieldCheck, 
  Lock, 
  Wallet,
  Tag,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { getStoredPurchasedTickets } from '../../utils/storage';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { 
  supabaseRowToTicket,
  acceptPendingTransfer,
  revokePendingTransfer,
  listTicketForSale,
  unlistTicketForSale
} from '../../services/api';
import { getWalletSession } from '../../services/authSession';
import { useTranslation } from '../../i18n';
import { PhantomLogo } from '../../components/common/PhantomLogo';

export interface MyTicketsProps {
  onNavigate: (page: string, id?: string) => void;
  onOpenWalletModal?: () => void;
  onSelectQrTicket?: (ticket: PurchasedTicket) => void;
  onSelectTransferTicket?: (ticket: PurchasedTicket) => void;
  walletAddress?: string | null;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const MyTicketsPage: React.FC<MyTicketsProps> = ({
  onNavigate,
  onOpenWalletModal,
  onSelectQrTicket,
  onSelectTransferTicket,
  walletAddress: propWalletAddress,
  onShowToast,
}) => {
  const { t, formatDate } = useTranslation();
  // 1. ĐỒNG BỘ NGUỒN LẤY ĐỊA CHỈ VÍ:
  const { publicKey, connected } = useWallet();
  const sessionWallet = getWalletSession()?.walletAddress;
  const effectiveWalletAddress = 
    publicKey?.toBase58() || 
    propWalletAddress || 
    sessionWallet || 
    localStorage.getItem('wallet_address') || 
    localStorage.getItem('phantom_wallet_address') || 
    '';

  const isWalletConnected = Boolean(connected && publicKey) || Boolean(effectiveWalletAddress);

  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [incomingTickets, setIncomingTickets] = useState<PurchasedTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [listingModalTicket, setListingModalTicket] = useState<PurchasedTicket | null>(null);
  const [listingPriceInput, setListingPriceInput] = useState<string>('0.1');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const fetchTickets = async () => {
    if (!isWalletConnected || !effectiveWalletAddress) {
      setTickets([]);
      setIncomingTickets([]);
      return;
    }

    setLoading(true);
    try {
      let allTickets: (PurchasedTicket & { ownerAddress?: string; walletAddress?: string; owner_address?: string })[] = [];

      // Đọc từ Supabase Cloud nếu có cấu hình
      if (isSupabaseConfigured) {
        try {
          const { data: cloudTickets, error } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && cloudTickets) {
            allTickets = cloudTickets.map((row: any) => ({
              ...supabaseRowToTicket(row),
              ownerAddress: row.owner_address || row.customer_wallet,
              walletAddress: row.wallet_address || row.customer_wallet,
              owner_address: row.owner_address || row.customer_wallet,
              transfer_count: Number(row.transfer_count) || 0,
              is_listed_for_sale: Boolean(row.is_listed_for_sale),
              listing_price_sol: Number(row.listing_price_sol) || Number(row.price_sol) || 0.05,
              pending_recipient: row.pending_recipient,
            }));
          }
        } catch (cloudErr) {
          console.warn('[MyTickets] Supabase fetch error:', cloudErr);
        }
      }

      // Đọc vé từ local storage
      const localTickets = getStoredPurchasedTickets().map((t: any) => ({
        ...t,
        ownerAddress: t.ownerAddress || t.customerWallet || t.walletAddress || t.owner_address,
        walletAddress: t.walletAddress || t.customerWallet || t.ownerAddress || t.owner_address,
        owner_address: t.owner_address || t.customerWallet || t.ownerAddress || t.walletAddress,
        transfer_count: Number(t.transfer_count) || 0,
        is_listed_for_sale: Boolean(t.is_listed_for_sale),
        listing_price_sol: Number(t.listing_price_sol) || Number(t.priceSol) || 0.05,
      }));

      const combined = [...allTickets, ...localTickets].filter(
        (t, idx, self) => idx === self.findIndex((o) => (o.ticketCode || o.id) === (t.ticketCode || t.id))
      );

      // Lọc vé thuộc sở hữu của người dùng hiện tại
      const userTickets = combined.filter(
        (t) =>
          (t.ownerAddress || t.walletAddress || t.owner_address || t.customerWallet)?.toLowerCase() ===
          effectiveWalletAddress.toLowerCase()
      );
      setTickets(userTickets);

      // Lọc vé đang gửi đến ví người dùng hiện tại (Escrow Pending Transfer)
      const incoming = combined.filter(
        (t) =>
          t.status === 'PENDING_ACCEPTANCE' &&
          (t.pending_recipient || (t as any).transferredTo || (t as any).transferred_to)?.toLowerCase() ===
            effectiveWalletAddress.toLowerCase()
      );
      setIncomingTickets(incoming);
    } catch (err) {
      console.warn('[MyTickets] Error loading tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('my-tickets-page-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
          void fetchTickets();
        })
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }
  }, [isWalletConnected, effectiveWalletAddress]);

  // Chấp nhận vé chuyển nhượng an toàn 2 bước
  const handleAcceptTicket = async (ticket: PurchasedTicket) => {
    setIsProcessingAction(true);
    try {
      const res = await acceptPendingTransfer(ticket.id, effectiveWalletAddress);
      if (res.ok) {
        onShowToast?.('success', 'Chấp nhận vé thành công! Vé đã chính thức thuộc về ví của bạn.');
        await fetchTickets();
      } else {
        onShowToast?.('error', res.message || 'Lỗi chấp nhận vé.');
      }
    } catch (err: any) {
      onShowToast?.('error', err?.message || 'Không thể chấp nhận vé.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Thu hồi vé chuyển nhượng
  const handleRevokeTicket = async (ticket: PurchasedTicket) => {
    setIsProcessingAction(true);
    try {
      const res = await revokePendingTransfer(ticket.id);
      if (res.ok) {
        onShowToast?.('info', 'Đã thu hồi vé chuyển nhượng thành công!');
        await fetchTickets();
      } else {
        onShowToast?.('error', res.message || 'Lỗi thu hồi vé.');
      }
    } catch (err: any) {
      onShowToast?.('error', err?.message || 'Không thể thu hồi vé.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Xác nhận đăng bán vé lên Chợ Thứ Cấp
  const handleConfirmListing = async () => {
    if (!listingModalTicket) return;
    const price = parseFloat(listingPriceInput);
    if (isNaN(price) || price <= 0) {
      onShowToast?.('error', 'Vui lòng nhập giá niêm yết hợp lệ.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await listTicketForSale(listingModalTicket.id, price);
      if (res.ok) {
        onShowToast?.('success', `Đã niêm yết vé với giá ${price} SOL lên Chợ Vé Thứ Cấp!`);
        setListingModalTicket(null);
        await fetchTickets();
      } else {
        onShowToast?.('error', res.message || 'Lỗi niêm yết vé.');
      }
    } catch (err: any) {
      onShowToast?.('error', err?.message || 'Không thể đăng bán vé.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Hủy niêm yết vé
  const handleUnlistTicket = async (ticket: PurchasedTicket) => {
    setIsProcessingAction(true);
    try {
      const res = await unlistTicketForSale(ticket.id);
      if (res.ok) {
        onShowToast?.('info', 'Đã hủy niêm yết vé khỏi Chợ Vé Thứ Cấp.');
        await fetchTickets();
      } else {
        onShowToast?.('error', res.message || 'Lỗi hủy niêm yết.');
      }
    } catch (err: any) {
      onShowToast?.('error', err?.message || 'Không thể hủy niêm yết.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 2. HIỂN THỊ MÀN HÌNH YÊU CẦU KẾT NỐI VÍ:
  if (!isWalletConnected || !effectiveWalletAddress) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="min-w-0">
            <button
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>{t('myTickets.backToHome')}</span>
            </button>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white break-words">
              {t('myTickets.title')} <span className="text-gradient-neon">{t('myTickets.titleGradient')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 break-words">
              {t('myTickets.subtitle')}
            </p>
          </div>
        </div>

        {/* Empty State Guard Card */}
        <div className="mx-auto max-w-lg rounded-2xl border border-solana-purple/30 bg-[#120B30]/90 backdrop-blur-md p-8 sm:p-10 text-center shadow-2xl space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-solana-purple/30 to-solana-cyan/20 border border-solana-cyan/30 text-solana-cyan shadow-lg">
            <Lock className="h-10 w-10 text-solana-cyan animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Chưa kết nối ví</h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Vui lòng kết nối ví Solana của bạn để xem và quản lý các vé NFT bạn đang sở hữu.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={onOpenWalletModal}
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-6 py-3 text-sm font-bold text-white shadow-lg shadow-solana-purple/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              <span>Kết nối ví ngay</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{t('myTickets.backToHome')}</span>
          </button>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white break-words">
            {t('myTickets.title')} <span className="text-gradient-neon">{t('myTickets.titleGradient')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 break-words">
            {t('myTickets.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTickets}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-solana-cyan' : ''}`} />
            <span>Làm mới</span>
          </button>
          <button
            onClick={onOpenWalletModal}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-4 py-2 text-xs font-semibold text-solana-cyan transition-colors hover:bg-solana-purple/30 shrink-0"
          >
            <PhantomLogo className="h-4 w-4" />
            {effectiveWalletAddress ? `${effectiveWalletAddress.slice(0, 4)}...${effectiveWalletAddress.slice(-4)}` : t('myTickets.connectWalletNotice')}
          </button>
        </div>
      </div>

      {/* BANNER THÔNG BÁO VÉ CHỜ NHẬN (ESCROW SAFE TRANSFER) */}
      {incomingTickets.length > 0 && (
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-950/20 p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Bạn có {incomingTickets.length} vé đang chờ nhận chuyển nhượng
              </h2>
              <p className="text-xs text-slate-300">
                Vé chuyển nhượng P2P an toàn 2 bước. Vui lòng bấm &quot;Chấp nhận vé&quot; để chính thức lưu vé vào ví của bạn.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingTickets.map((inc) => (
              <div key={inc.id} className="p-3.5 rounded-xl bg-[#120B30] border border-white/10 flex items-center justify-between gap-3 shadow-md">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-white truncate">{inc.eventTitle}</h3>
                  <p className="text-[11px] text-solana-cyan">{inc.tierName} • {inc.seat}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Từ ví: <span className="font-mono text-slate-300">{inc.customerWallet ? `${inc.customerWallet.slice(0, 4)}...${inc.customerWallet.slice(-4)}` : 'N/A'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAcceptTicket(inc)}
                  disabled={isProcessingAction}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-solana-green to-emerald-500 text-slate-950 text-xs font-bold shrink-0 hover:opacity-95 shadow-md transition-all active:scale-95"
                >
                  Chấp nhận vé
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#120B30] p-12 text-center shadow-2xl">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-solana-purple border-t-transparent mb-4" />
          <p className="text-sm text-slate-300">Đang tải danh sách vé NFT của bạn...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#120B30] p-8 text-center shadow-2xl">
          <Ticket className="mx-auto mb-3 h-10 w-10 text-solana-cyan" />
          <h2 className="text-xl font-bold text-white">{t('myTickets.emptyTitle')}</h2>
          <p className="mt-2 text-sm text-slate-300">{t('myTickets.emptySubtitle')}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate('events')}
              className="rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white"
            >
              {t('myTickets.exploreBtn')}
            </button>
            <button
              onClick={() => onNavigate('marketplace')}
              className="rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-5 py-2.5 text-sm font-bold text-solana-cyan hover:bg-solana-cyan/20"
            >
              Săn vé trên Chợ Vé
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {tickets.map((ticket) => {
            const transferCount = Number(ticket.transfer_count) || 0;
            const isTransferLocked = transferCount >= 2;
            const isPendingAcceptance = ticket.status === 'PENDING_ACCEPTANCE';
            const isListed = Boolean(ticket.is_listed_for_sale);
            const isUsedTicket = Boolean(
              ticket.isCheckedIn ||
              ticket.isUsed ||
              ticket.status === 'USED' ||
              ticket.status === 'used' ||
              ticket.status === 'checked_in' ||
              ticket.status === 'CHECKED_IN' ||
              (ticket as any).checked_in_at
            );

            return (
              <div key={ticket.id} className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-bold text-white">{ticket.eventTitle}</h2>
                      <p className="mt-1 text-xs text-solana-cyan">{ticket.tierName} • {ticket.seat}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        isUsedTicket
                          ? 'border-solana-green/40 bg-solana-green/15 text-solana-green'
                          : isPendingAcceptance
                          ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300'
                          : isListed
                          ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                          : 'border-solana-cyan/40 bg-solana-cyan/15 text-solana-cyan'
                      }`}>
                        {isUsedTicket
                          ? t('myTickets.statusCheckedIn')
                          : isPendingAcceptance
                          ? 'Chờ chấp nhận'
                          : isListed
                          ? 'Đang niêm yết'
                          : t('myTickets.statusUnused')}
                      </span>

                      {/* Huy hiệu Lượt đổi chủ X/2 */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isTransferLocked
                          ? 'bg-red-950/80 border-red-500/50 text-red-300'
                          : 'bg-white/5 border-white/10 text-slate-300'
                      }`}>
                        Lượt đổi chủ: {transferCount}/2
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <p><span className="text-slate-500">{t('myTickets.buyer')}</span> {ticket.customerName}</p>
                      <p><span className="text-slate-500">{t('myTickets.ticketCode')}</span> <span className="font-mono text-white">{ticket.ticketCode}</span></p>
                      <p><span className="text-slate-500">{t('myTickets.wallet')}</span> {ticket.customerWallet ? `${ticket.customerWallet.slice(0, 4)}...${ticket.customerWallet.slice(-4)}` : 'N/A'}</p>
                      <p><span className="text-slate-500">{t('myTickets.purchaseDate')}</span> {formatDate(ticket.purchaseDate || ticket.purchasedAt, { dateStyle: 'short', timeStyle: 'short' })}</p>
                      <p><span className="text-slate-500">{t('myTickets.venue')}</span> {ticket.venue}, {ticket.city}</p>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Nút Show QR */}
                        <button
                          onClick={() => onSelectQrTicket?.(ticket)}
                          className="min-h-10 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-3.5 py-1.5 text-xs font-bold text-solana-cyan hover:bg-solana-cyan/20 transition-colors flex items-center gap-1.5"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          <span>{t('myTickets.showQr')}</span>
                        </button>

                        {/* Nút Chuyển nhượng vé & Đăng bán lại */}
                        {!isUsedTicket && (
                          <>
                            {isTransferLocked ? (
                              <span className="px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] font-bold">
                                Đã khóa chuyển nhượng (Transfer Locked)
                              </span>
                            ) : isPendingAcceptance ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-yellow-300 bg-yellow-950/60 border border-yellow-500/40 px-2.5 py-1 rounded-xl">
                                  Chờ ví {ticket.pending_recipient?.slice(0, 4)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeTicket(ticket)}
                                  disabled={isProcessingAction}
                                  className="min-h-10 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60 transition-colors"
                                >
                                  Thu hồi vé (Revoke)
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Nút Chuyển nhượng */}
                                <button
                                  onClick={() => onSelectTransferTicket?.(ticket)}
                                  className="min-h-10 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-solana-purple/35 hover:text-white transition-colors flex items-center gap-1.5"
                                  title="Chuyển nhượng vé cho ví Solana khác"
                                >
                                  <Send className="h-3.5 w-3.5 text-solana-cyan" />
                                  <span>{t('myTickets.transferTicket')}</span>
                                </button>

                                {/* Nút Đăng bán lại / Hủy niêm yết */}
                                {isListed ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-1 rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-xs font-bold text-solana-cyan">
                                      {ticket.listing_price_sol || ticket.priceSol} SOL
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUnlistTicket(ticket)}
                                      disabled={isProcessingAction}
                                      className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
                                    >
                                      Hủy bán
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setListingModalTicket(ticket);
                                      setListingPriceInput(String(ticket.listing_price_sol || ticket.priceSol || 0.1));
                                    }}
                                    className="min-h-10 rounded-xl border border-neon-pink/40 bg-neon-pink/15 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-neon-pink/30 hover:text-white transition-colors flex items-center gap-1.5"
                                    title="Đăng bán vé lại trên Chợ Vé Thứ Cấp"
                                  >
                                    <Tag className="h-3.5 w-3.5 text-neon-pink" />
                                    <span>Đăng bán lại</span>
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                      {isUsedTicket && (ticket.checkInTime || (ticket as any).checked_in_at) && (
                        <span className="text-[11px] text-solana-green">
                          {t('myTickets.checkedInAt', { time: formatDate(ticket.checkInTime || (ticket as any).checked_in_at, { dateStyle: 'short', timeStyle: 'short' }) })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Solana Explorer & Tra cứu công khai */}
                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-solana-cyan/20 bg-solana-cyan/5 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Solana Devnet:</span>
                      {(ticket.txSignature || ticket.signature || ticket.nftTransactionSignature) ? (
                        <a
                          href={`https://explorer.solana.com/tx/${ticket.txSignature || ticket.signature || ticket.nftTransactionSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-solana-cyan hover:underline hover:text-white transition-colors"
                        >
                          <span>{t('myTickets.viewOnExplorer')}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="font-mono text-slate-300">
                          Tra cứu ID: <span className="text-solana-cyan font-semibold">{ticket.ticketCode || ticket.id}</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onNavigate('verify', ticket.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-solana-purple/40 bg-solana-purple/20 px-2.5 py-1 text-[11px] font-semibold text-purple-200 hover:bg-solana-purple/40 hover:text-white transition-colors"
                    >
                      <ShieldCheck className="h-3 w-3 text-solana-green" />
                      <span>{t('myTickets.viewPublicVerification')}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {t('myTickets.order')} {ticket.orderId} · {t('myTickets.qrDemoNotice')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL ĐĂNG BÁN VÉ LẠI (LIST FOR SALE MODAL) */}
      {listingModalTicket && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setListingModalTicket(null)}
        >
          <div 
            className="relative w-full max-w-md rounded-2xl border border-solana-purple/50 bg-[#120B30] p-6 shadow-2xl text-left space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-neon-pink" />
                <h3 className="text-base font-bold text-white">Đăng bán lại vé trên Chợ Vé</h3>
              </div>
              <button onClick={() => setListingModalTicket(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1">
              <h4 className="font-bold text-white text-sm">{listingModalTicket.eventTitle}</h4>
              <p className="text-solana-cyan">{listingModalTicket.tierName} • {listingModalTicket.seat}</p>
              <p className="text-slate-400">Giá gốc: <span className="font-mono text-white">{listingModalTicket.priceSol} SOL</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Giá bạn muốn bán trên Chợ (SOL):</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={listingPriceInput}
                  onChange={(e) => setListingPriceInput(e.target.value)}
                  className="w-full bg-[#180E3D] border border-solana-purple/40 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-solana-cyan"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-solana-cyan">SOL</span>
              </div>
            </div>

            {/* BẢNG TÍNH MINH BẠCH DÒNG TIỀN */}
            {(() => {
              const p = parseFloat(listingPriceInput) || 0;
              const royalty = p * 0.10;
              const platform = p * 0.05;
              const net = p * 0.85;
              return (
                <div className="p-3.5 rounded-xl bg-solana-purple/10 border border-solana-purple/30 text-xs space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Bảng tính minh bạch dòng tiền:
                  </span>
                  <div className="flex justify-between text-slate-300">
                    <span>Phí bản quyền BTC (10%):</span>
                    <span className="font-mono text-neon-pink">-{royalty.toFixed(3)} SOL</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Phí nền tảng (5%):</span>
                    <span className="font-mono text-solana-cyan">-{platform.toFixed(3)} SOL</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-white">
                    <span>Thực nhận về ví (85%):</span>
                    <span className="font-mono text-solana-green text-sm">+{net.toFixed(3)} SOL</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setListingModalTicket(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmListing}
                disabled={isProcessingAction || !listingPriceInput || parseFloat(listingPriceInput) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-xs font-bold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
              >
                {isProcessingAction ? 'Đang lưu...' : 'Xác nhận niêm yết'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
