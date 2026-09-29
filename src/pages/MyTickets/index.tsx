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
  Wallet 
} from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { getStoredPurchasedTickets } from '../../utils/storage';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { supabaseRowToTicket } from '../../services/api';
import { getWalletSession } from '../../services/authSession';
import { useTranslation } from '../../i18n';
import { PhantomLogo } from '../../components/common/PhantomLogo';

export interface MyTicketsProps {
  onNavigate: (page: string, id?: string) => void;
  onOpenWalletModal?: () => void;
  onSelectQrTicket?: (ticket: PurchasedTicket) => void;
  onSelectTransferTicket?: (ticket: PurchasedTicket) => void;
  walletAddress?: string | null;
}

export const MyTicketsPage: React.FC<MyTicketsProps> = ({
  onNavigate,
  onOpenWalletModal,
  onSelectQrTicket,
  onSelectTransferTicket,
  walletAddress: propWalletAddress,
}) => {
  const { t, formatDate } = useTranslation();
  // 1. ĐỒNG BỘ NGUỒN LẤY ĐỊA CHỈ VÍ:
  // Lấy trạng thái kết nối ví từ Solana Wallet Adapter, props, Session hoặc LocalStorage
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
  const [loading, setLoading] = useState<boolean>(false);

  // 1. QUẢN LÝ TRẠNG THÁI KHI NGẮT KẾT NỐI VÍ (DISCONNECTED STATE):
  // Thêm useEffect theo dõi trạng thái isWalletConnected và effectiveWalletAddress:
  // Khi !isWalletConnected hoặc !effectiveWalletAddress: Lập tức xóa trắng danh sách vé và không fetch/đọc vé nào.
  useEffect(() => {
    if (!isWalletConnected || !effectiveWalletAddress) {
      setTickets([]);
      return;
    }

    let isCancelled = false;

    const fetchTickets = async () => {
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
        }));

        const combined = [...allTickets, ...localTickets].filter(
          (t, idx, self) => idx === self.findIndex((o) => (o.ticketCode || o.id) === (t.ticketCode || t.id))
        );

        // 3. LỌC CHÍNH XÁC VÉ THEO ĐỊA CHỈ VÍ ĐANG KẾT NỐI (STRICT WALLET FILTER):
        const filtered = combined.filter(
          t => (t.ownerAddress || t.walletAddress || t.owner_address || t.customerWallet)?.toLowerCase() === effectiveWalletAddress.toLowerCase()
        );

        if (!isCancelled) {
          setTickets(filtered);
        }
      } catch (err) {
        console.warn('[MyTickets] Error loading tickets:', err);
        if (!isCancelled) {
          const localTickets = getStoredPurchasedTickets().map((t: any) => ({
            ...t,
            ownerAddress: t.ownerAddress || t.customerWallet || t.walletAddress || t.owner_address,
            walletAddress: t.walletAddress || t.customerWallet || t.ownerAddress || t.owner_address,
            owner_address: t.owner_address || t.customerWallet || t.ownerAddress || t.walletAddress,
          }));
          const filtered = localTickets.filter(
            t => (t.ownerAddress || t.walletAddress || t.owner_address || t.customerWallet)?.toLowerCase() === effectiveWalletAddress.toLowerCase()
          );
          setTickets(filtered);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    void fetchTickets();

    // Supabase Realtime synchronization
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('my-tickets-page-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
          void fetchTickets();
        })
        .subscribe();

      return () => {
        isCancelled = true;
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [isWalletConnected, effectiveWalletAddress]);

  // 2. HIỂN THỊ MÀN HÌNH YÊU CẦU KẾT NỐI VÍ (WALLET GUARD UI):
  if (!isWalletConnected || !effectiveWalletAddress) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn">
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn">
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

        <button
          onClick={onOpenWalletModal}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-4 py-2 text-xs font-semibold text-solana-cyan transition-colors hover:bg-solana-purple/30 shrink-0"
        >
          <PhantomLogo className="h-4 w-4" />
          {effectiveWalletAddress ? `${effectiveWalletAddress.slice(0, 4)}...${effectiveWalletAddress.slice(-4)}` : t('myTickets.connectWalletNotice')}
        </button>
      </div>

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
          <button
            onClick={() => onNavigate('events')}
            className="mt-5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white"
          >
            {t('myTickets.exploreBtn')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-bold text-white">{ticket.eventTitle}</h2>
                  <p className="mt-1 text-xs text-solana-cyan">{ticket.tierName}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                  ticket.isCheckedIn || ticket.isUsed || ticket.status === 'USED' || ticket.status === 'used' || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN' || Boolean((ticket as any).checked_in_at)
                    ? 'border-solana-green/40 bg-solana-green/15 text-solana-green'
                    : 'border-solana-cyan/40 bg-solana-cyan/15 text-solana-cyan'
                }`}>
                  {ticket.isCheckedIn || ticket.isUsed || ticket.status === 'USED' || ticket.status === 'used' || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN' || Boolean((ticket as any).checked_in_at) ? t('myTickets.statusCheckedIn') : t('myTickets.statusUnused')}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-2 text-xs text-slate-300">
                  <p><span className="text-slate-500">{t('myTickets.buyer')}</span> {ticket.customerName}</p>
                  <p><span className="text-slate-500">{t('myTickets.ticketCode')}</span> <span className="font-mono text-white">{ticket.ticketCode}</span></p>
                  <p><span className="text-slate-500">{t('myTickets.wallet')}</span> {ticket.customerWallet ? `${ticket.customerWallet.slice(0, 4)}...${ticket.customerWallet.slice(-4)}` : 'N/A'}</p>
                  <p><span className="text-slate-500">{t('myTickets.purchaseDate')}</span> {formatDate(ticket.purchaseDate || ticket.purchasedAt, { dateStyle: 'short', timeStyle: 'short' })}</p>
                  <p><span className="text-slate-500">{t('myTickets.venue')}</span> {ticket.venue}, {ticket.city}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onSelectQrTicket?.(ticket)}
                      className="min-h-11 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-2 text-xs font-bold text-solana-cyan hover:bg-solana-cyan/20 transition-colors flex items-center gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>{t('myTickets.showQr')}</span>
                    </button>

                    {/* Nút Chuyển nhượng vé chỉ khả dụng khi vé chưa check-in */}
                    {!ticket.isCheckedIn && !ticket.isUsed && ticket.status !== 'USED' && ticket.status !== 'used' && ticket.status !== 'checked_in' && ticket.status !== 'CHECKED_IN' && !(ticket as any).checked_in_at && (
                      <button
                        onClick={() => onSelectTransferTicket?.(ticket)}
                        className="min-h-11 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-3.5 py-2 text-xs font-bold text-purple-200 hover:bg-solana-purple/35 hover:text-white hover:border-solana-cyan/40 transition-colors flex items-center gap-1.5"
                        title="Chuyển nhượng vé cho ví Solana khác"
                      >
                        <Send className="h-3.5 w-3.5 text-solana-cyan" />
                        <span>{t('myTickets.transferTicket')}</span>
                      </button>
                    )}
                  </div>
                  {(ticket.isCheckedIn || (ticket as any).checked_in_at || ticket.status === 'USED') && (ticket.checkInTime || (ticket as any).checked_in_at) && <span className="text-[11px] text-solana-green">{t('myTickets.checkedInAt', { time: formatDate(ticket.checkInTime || (ticket as any).checked_in_at, { dateStyle: 'short', timeStyle: 'short' }) })}</span>}
                </div>
              </div>
              {/* Solana Explorer & Tra cứu công khai */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-solana-cyan/20 bg-solana-cyan/5 px-3 py-2 text-xs">
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

              <p className="mt-4 border-t border-dashed border-white/10 pt-3 text-[11px] text-slate-400">
                {t('myTickets.order')} {ticket.orderId} · {t('myTickets.qrDemoNotice')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
