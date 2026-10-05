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
import { QRCodeSVG } from 'qrcode.react';
import { PurchasedTicket } from '../../types';
import * as storage from '../../utils/storage';
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
  onTicketsChanged?: () => void;
}

// RÀNG BUỘC GIÁ NIÊM YẾT VÀ CHỐNG DUST LAMPORT (P0 - Extreme Values)
export const getListingPriceValidationError = (value: string, originalPriceSol?: number): string | null => {
  if (!value || value.trim() === '') {
    return 'Vui lòng nhập giá niêm yết.';
  }
  const trimmed = value.trim();
  if (!/^[0-9]+(\.[0-9]{1,4})?$/.test(trimmed)) {
    return 'Chỉ chấp nhận số dương hợp lệ, tối đa 4 chữ số thập phân.';
  }
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0.01) {
    return 'Giá tối thiểu phải từ 0.01 SOL (ngăn chặn lỗi Dust Lamport).';
  }
  if (num > 100) {
    return 'Giá tối đa không được vượt quá 100 SOL.';
  }
  if (originalPriceSol && originalPriceSol > 0 && num > originalPriceSol * 1.5) {
    return `Giá không được vượt quá 150% giá gốc (${(originalPriceSol * 1.5).toFixed(3)} SOL).`;
  }
  return null;
};

export const MyTicketsPage: React.FC<MyTicketsProps> = ({
  onNavigate,
  onOpenWalletModal,
  onSelectQrTicket,
  onSelectTransferTicket,
  walletAddress: propWalletAddress,
  onShowToast,
  onTicketsChanged,
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

  // Lắng nghe sự kiện đổi tài khoản Phantom (Chống Wallet Desync P1)
  useEffect(() => {
    const phantomProvider = typeof window !== 'undefined' ? ((window as any).phantom?.solana || (window as any).solana) : null;
    if (!phantomProvider || typeof phantomProvider.on !== 'function') return;

    const handleAccountChange = () => {
      setListingModalTicket(null);
      setIsProcessingAction(false);
    };

    phantomProvider.on('accountChanged', handleAccountChange);
    return () => {
      if (typeof phantomProvider.removeListener === 'function') {
        phantomProvider.removeListener('accountChanged', handleAccountChange);
      }
    };
  }, []);

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

    // KIỂM SOÁT VÉ ĐÃ SỬ DỤNG (P0 - Used Ticket Integrity):
    if (
      listingModalTicket.status === 'USED' ||
      listingModalTicket.status === 'used' ||
      listingModalTicket.isCheckedIn ||
      (listingModalTicket as any).is_checked_in ||
      (listingModalTicket as any).isUsed ||
      (listingModalTicket as any).checked_in_at
    ) {
      onShowToast?.('error', 'Vé này đã được check-in sử dụng tại sự kiện, tuyệt đối không thể niêm yết lên Chợ!');
      setListingModalTicket(null);
      return;
    }

    // RÀNG BUỘC GIÁ NIÊM YẾT VÀ CHỐNG DUST LAMPORT (P0 - Extreme Values):
    const priceErr = getListingPriceValidationError(
      listingPriceInput,
      Number(listingModalTicket.priceSol) || 0.05
    );
    if (priceErr) {
      onShowToast?.('error', priceErr);
      return;
    }

    const price = parseFloat(listingPriceInput);

    setIsProcessingAction(true);
    try {
      const ticket = listingModalTicket;
      const currentWalletAddress = effectiveWalletAddress;
      const listingPriceSol = price;

      // 1. XỬ LÝ KHI NGƯỜI DÙNG ĐĂNG BÁN VÉ:
      // BẮT BUỘC gọi trực tiếp Supabase để cập nhật bản ghi vé:
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('tickets')
            .upsert({
              id: ticket.id,
              ticket_code: ticket.ticketCode || (ticket as any).ticket_code || ticket.id,
              event_id: ticket.eventId || (ticket as any).event_id || '',
              event_title: ticket.eventTitle || (ticket as any).event_title || '',
              event_banner: ticket.eventBanner || (ticket as any).event_banner || '',
              venue: ticket.venue || '',
              city: ticket.city || '',
              date: ticket.date || '',
              time: ticket.time || '',
              tier_name: ticket.tierName || (ticket as any).tier_name || '',
              seat: ticket.seat || '',
              is_listed_for_sale: true,
              listing_price_sol: Number(listingPriceSol),
              price_sol: Number(ticket.priceSol) || 0.05,
              ticketCode: ticket.ticketCode || ticket.id,
              owner_address: currentWalletAddress,
              customer_wallet: currentWalletAddress,
              wallet_address: currentWalletAddress,
              transfer_count: Number(ticket.transfer_count || (ticket as any).transferCount || 0),
              status: ticket.status || 'valid',
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (error) {
            console.warn('[MyTickets] Supabase upsert listing error:', error);
          }
        } catch (supaErr) {
          console.warn('[MyTickets] Supabase listing exception:', supaErr);
        }
      }

      // 2. Cập nhật LocalStorage và API
      await listTicketForSale(ticket.id, price);
      storage.listStoredTicketForSale(ticket.id, price);

      onShowToast?.('success', `Đã niêm yết vé với giá ${price} SOL lên Chợ Vé Thứ Cấp!`);
      setListingModalTicket(null);
      await fetchTickets();
      onTicketsChanged?.();
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
      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('tickets')
            .update({
              is_listed_for_sale: false,
              listing_price_sol: null,
              updated_at: new Date().toISOString(),
            })
            .or(`id.eq.${ticket.id},ticket_code.eq.${ticket.ticketCode || ticket.id}`);
        } catch (supaErr) {
          console.warn('[MyTickets] Lỗi hủy niêm yết Supabase:', supaErr);
        }
      }

      await unlistTicketForSale(ticket.id);
      storage.unlistStoredTicketForSale(ticket.id);
      onShowToast?.('info', 'Đã hủy niêm yết vé khỏi Chợ Vé Thứ Cấp.');
      await fetchTickets();
      onTicketsChanged?.();
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
                  Chấp nhận vé (Accept)
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
              <div
                key={ticket.id}
                className="relative rounded-2xl border border-purple-500/25 hover:border-purple-500/60 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] bg-gradient-to-br from-[#120B30] via-[#0D0724] to-[#170C3D] p-4 sm:p-5 shadow-xl flex flex-col justify-between transition-all duration-300 group overflow-hidden"
              >
                {/* Glow background orb */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-solana-purple/15 blur-2xl group-hover:bg-solana-purple/25 transition-all" />

                <div>
                  {/* VIP Ticket Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-widest text-solana-cyan uppercase font-mono bg-solana-cyan/10 px-2 py-0.5 rounded border border-solana-cyan/30">
                          VIP TICKET
                        </span>
                        <h2 className="break-words text-base sm:text-lg font-bold text-white">{ticket.eventTitle}</h2>
                      </div>
                      <p className="mt-1 text-xs text-solana-cyan font-medium">{ticket.tierName} • {ticket.seat}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Tem bảo mật Holographic óng ánh */}
                      <div className="hologram-badge rounded-xl border border-white/40 px-3 py-1 shadow-md flex items-center gap-1.5 select-none relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 animate-pulse pointer-events-none" />
                        <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                        <div className="leading-tight hidden sm:block">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-white drop-shadow">VIP SECURE PASS</span>
                          <span className="block text-[8px] font-mono text-cyan-100">SOLANA DEVNET</span>
                        </div>
                      </div>

                      {/* Trạng thái vé */}
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
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

                  {/* Body vé & Cuống vé với Nét đứt vé xé */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-stretch">
                    {/* Phần thân vé (Ticket Body) */}
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <p><span className="text-slate-500">{t('myTickets.buyer')}</span> <span className="font-semibold text-white">{ticket.customerName}</span></p>
                        <p><span className="text-slate-500">{t('myTickets.ticketCode')}</span> <span className="font-mono font-bold text-solana-cyan bg-solana-cyan/10 px-1.5 py-0.5 rounded border border-solana-cyan/30">{ticket.ticketCode}</span></p>
                      </div>
                      <p><span className="text-slate-500">{t('myTickets.wallet')}</span> <span className="font-mono text-slate-300">{ticket.customerWallet ? `${ticket.customerWallet.slice(0, 6)}...${ticket.customerWallet.slice(-6)}` : 'N/A'}</span></p>
                      <p><span className="text-slate-500">{t('myTickets.purchaseDate')}</span> <span className="text-slate-200">{formatDate(ticket.purchaseDate || ticket.purchasedAt, { dateStyle: 'short', timeStyle: 'short' })}</span></p>
                      <p><span className="text-slate-500">{t('myTickets.venue')}</span> <span className="text-slate-200">{ticket.venue}, {ticket.city}</span></p>
                    </div>

                    {/* Đường nét đứt xé vé (Perforated Tear Line) & Cuống vé xé */}
                    <div className="border-t-2 md:border-t-0 md:border-l-2 border-dashed border-purple-500/30 pt-4 md:pt-0 md:pl-5 flex flex-col sm:flex-row md:flex-col items-center justify-between gap-3 relative">
                      {/* Decorative Ticket Notches */}
                      <div className="hidden md:block absolute -top-6 -left-2 w-4 h-4 rounded-full bg-[#070412] border-b border-purple-500/30" />
                      <div className="hidden md:block absolute -bottom-6 -left-2 w-4 h-4 rounded-full bg-[#070412] border-t border-purple-500/30" />

                      {/* Mã QR có tia quét neon mờ */}
                      <div
                        onClick={() => onSelectQrTicket?.(ticket)}
                        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-white p-2 shadow-2xl border-2 border-solana-cyan/40 cursor-pointer group/qr overflow-hidden flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                        title="Bấm để phóng to mã QR check-in"
                      >
                        <QRCodeSVG value={`UTK:${ticket.ticketCode}:${ticket.id}`} size={92} level="M" />
                        {/* Tia quét laser neon */}
                        <div className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-solana-cyan to-transparent opacity-95 shadow-[0_0_10px_#00F5FF] animate-scanner" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/qr:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[1px]">
                          <QrCode className="w-5 h-5 text-solana-cyan animate-pulse mb-0.5" />
                          <span className="text-[10px] font-extrabold text-white">Xem QR</span>
                        </div>
                      </div>

                      {/* Các nút hành động trên cuống vé */}
                      <div className="flex flex-col items-center md:items-end gap-2 w-full sm:w-auto">
                        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                          {/* Nút Show QR */}
                          <button
                            onClick={() => onSelectQrTicket?.(ticket)}
                            className="min-h-9 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-3 py-1.5 text-xs font-bold text-solana-cyan hover:bg-solana-cyan/20 transition-colors flex items-center gap-1.5"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>{t('myTickets.showQr')}</span>
                          </button>

                          {/* Nút Chuyển nhượng vé & Đăng bán lại */}
                          {!isUsedTicket && (
                            <>
                              {isTransferLocked ? (
                                <span className="px-2.5 py-1 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] font-bold flex items-center gap-1">
                                  <span>🔒 Đã khóa chuyển nhượng (Transfer Locked)</span>
                                </span>
                              ) : isPendingAcceptance ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-yellow-300 bg-yellow-950/60 border border-yellow-500/40 px-2.5 py-1 rounded-xl">
                                    Đang chờ ví {ticket.pending_recipient ? `${ticket.pending_recipient.slice(0, 4)}...${ticket.pending_recipient.slice(-4)}` : 'người nhận'} chấp nhận
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeTicket(ticket)}
                                    disabled={isProcessingAction}
                                    className="min-h-9 rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60 transition-colors"
                                  >
                                    Thu hồi vé (Revoke)
                                  </button>
                                </div>
                              ) : (
                                <>
                                  {/* Nút Chuyển nhượng */}
                                  <button
                                    onClick={() => onSelectTransferTicket?.(ticket)}
                                    className="min-h-9 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-solana-purple/35 hover:text-white transition-colors flex items-center gap-1.5"
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
                                        className="min-h-9 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
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
                                      className="min-h-9 rounded-xl border border-neon-pink/40 bg-neon-pink/15 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-neon-pink/30 hover:text-white transition-colors flex items-center gap-1.5"
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

            {(() => {
              const originalPrice = Number(listingModalTicket.priceSol) || 0.05;
              const priceValidationError = getListingPriceValidationError(listingPriceInput, originalPrice);

              return (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Giá bạn muốn bán trên Chợ (SOL):</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        value={listingPriceInput}
                        onChange={(e) => setListingPriceInput(e.target.value)}
                        className={`w-full bg-[#180E3D] border ${
                          priceValidationError ? 'border-red-500/80 focus:border-red-500' : 'border-solana-purple/40 focus:border-solana-cyan'
                        } rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors`}
                        placeholder="VD: 0.1"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-solana-cyan">SOL</span>
                    </div>
                    {priceValidationError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{priceValidationError}</span>
                      </div>
                    )}
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
                      disabled={isProcessingAction || Boolean(priceValidationError)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-xs font-bold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
                    >
                      {isProcessingAction ? 'Đang lưu...' : 'Xác nhận niêm yết'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
