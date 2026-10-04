import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Copy, 
  Calendar, 
  MapPin, 
  Ticket as TicketIcon, 
  ArrowLeft, 
  Search, 
  Clock, 
  ArrowRight, 
  Check,
  Sparkles,
  User
} from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { getStoredTicketById } from '../../utils/storage';
import { getTicketById, supabaseRowToTicket } from '../../services/api';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { useTranslation } from '../../i18n';

interface VerifyTicketPageProps {
  ticketId?: string | null;
  onNavigate: (page: string, eventId?: string) => void;
}

export const VerifyTicketPage: React.FC<VerifyTicketPageProps> = ({ ticketId: propTicketId, onNavigate }) => {
  const { t, formatDate } = useTranslation();

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return dateStr;
    }
  };

  // Extract ID from props, URL param, or pathname
  const initialIdentifier = React.useMemo(() => {
    if (propTicketId) return propTicketId;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const fromQuery = searchParams.get('id') || searchParams.get('ticketId');
      if (fromQuery) return fromQuery;

      const pathname = window.location.pathname;
      const verifyPrefix = '/verify/';
      if (pathname.startsWith(verifyPrefix)) {
        return decodeURIComponent(pathname.slice(verifyPrefix.length));
      }
    }
    return '';
  }, [propTicketId]);

  const [searchQuery, setSearchQuery] = useState(initialIdentifier);
  const [ticket, setTicket] = useState<PurchasedTicket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searched, setSearched] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchTicket = async (queryCode: string) => {
    const clean = queryCode.trim();
    if (!clean) {
      setTicket(null);
      setLoading(false);
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);

    try {
      // 1. Tìm trực tiếp trên Supabase bảng tickets:
      if (isSupabaseConfigured) {
        try {
          const { data: cloudTicket, error } = await supabase
            .from('tickets')
            .select('*')
            .or(`id.eq.${clean},ticket_code.eq.${clean}`)
            .maybeSingle();

          let targetCloudTicket = cloudTicket;
          if (!targetCloudTicket && !error) {
            const { data: byId } = await supabase.from('tickets').select('*').eq('id', clean).maybeSingle();
            if (byId) targetCloudTicket = byId;
          }
          if (!targetCloudTicket && !error) {
            const { data: byCode } = await supabase.from('tickets').select('*').eq('ticket_code', clean).maybeSingle();
            if (byCode) targetCloudTicket = byCode;
          }
          if (!targetCloudTicket && !error) {
            const { data: fuzzyTicket } = await supabase
              .from('tickets')
              .select('*')
              .or(`id.ilike.%${clean}%,ticket_code.ilike.%${clean}%`)
              .maybeSingle();
            if (fuzzyTicket) targetCloudTicket = fuzzyTicket;
          }

          if (targetCloudTicket) {
            const isUsed = 
              targetCloudTicket.status === 'USED' || 
              targetCloudTicket.status === 'used' || 
              Boolean(targetCloudTicket.checked_in_at) || 
              Boolean(targetCloudTicket.is_checked_in) ||
              targetCloudTicket.checkInStatus === 'checked-in';

            const mapped = supabaseRowToTicket(targetCloudTicket);
            const resolvedTicket: PurchasedTicket = {
              ...mapped,
              status: isUsed ? 'USED' : 'UNUSED',
              isCheckedIn: isUsed,
              isUsed: isUsed,
              checkInStatus: isUsed ? 'checked-in' : 'unused',
              checkInTime: targetCloudTicket.checked_in_at || targetCloudTicket.check_in_time || mapped.checkInTime,
              checkedInBy: targetCloudTicket.checked_in_by || (mapped as any).checkedInBy || 'Staff Gate',
              ...( { checked_in_at: targetCloudTicket.checked_in_at, is_checked_in: isUsed } as any ),
            };
            setTicket(resolvedTicket);
            return;
          }
        } catch (supaQueryErr) {
          console.warn('[VerifyTicket] Lỗi query Supabase:', supaQueryErr);
        }
      }

      // Prioritize API then fallback to storage
      let found = await getTicketById(clean);
      if (!found) {
        found = getStoredTicketById(clean);
      }
      if (found) {
        const isUsedFound = Boolean(
          found.isCheckedIn ||
          found.isUsed ||
          found.status === 'USED' ||
          found.status === 'used' ||
          found.status === 'checked_in' ||
          found.status === 'CHECKED_IN' ||
          found.checkInStatus === 'checked-in' ||
          (found as any).checked_in_at ||
          (found as any).is_checked_in
        );
        found = {
          ...found,
          isCheckedIn: isUsedFound,
          isUsed: isUsedFound,
          status: isUsedFound ? 'USED' : (found.status || 'UNUSED'),
        };
      }
      setTicket(found);
    } catch {
      const fallback = getStoredTicketById(clean);
      setTicket(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialIdentifier) {
      setSearchQuery(initialIdentifier);
      void fetchTicket(initialIdentifier);
    } else {
      // If no query, check if there are any tickets in storage to preview first one
      const stored = getStoredTicketById('');
      if (stored) {
        setTicket(stored);
        setSearchQuery(stored.ticketCode || stored.id);
      }
      setLoading(false);
    }
  }, [initialIdentifier]);

  // 3. TỰ ĐỘNG LẮNG NGHE SUPABASE REALTIME TRÊN TRANG TRA CỨU:
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('verify_ticket_realtime_stream')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          const updated = payload.new as any;
          if (!updated) return;

          setTicket((prevTicket) => {
            if (!prevTicket) return prevTicket;
            const currentCode = (prevTicket.ticketCode || '').toLowerCase().trim();
            const currentId = (prevTicket.id || '').toLowerCase().trim();
            const targetCode = (updated.ticket_code || '').toLowerCase().trim();
            const targetId = (updated.id || '').toLowerCase().trim();

            const isMatch =
              (targetCode && (targetCode === currentCode || targetCode === currentId)) ||
              (targetId && (targetId === currentId || targetId === currentCode));

            if (isMatch) {
              console.log('[VerifyTicket] Realtime check-in detected:', updated);
              const mapped = supabaseRowToTicket(updated);
              return {
                ...prevTicket,
                ...mapped,
                status: 'USED',
                isCheckedIn: true,
                checkInStatus: 'checked-in',
                checkInTime: updated.checked_in_at || new Date().toISOString(),
                checkedInBy: updated.checked_in_by || prevTicket.checkedInBy || 'Staff Gate',
              };
            }
            return prevTicket;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Update history URL without reloading
      const newUrl = `/verify/${encodeURIComponent(searchQuery.trim())}`;
      if (window.location.pathname !== newUrl) {
        window.history.pushState(null, '', newUrl);
      }
      void fetchTicket(searchQuery.trim());
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isCheckedIn = Boolean(
    ticket?.isCheckedIn ||
    ticket?.isUsed ||
    ticket?.status === 'USED' ||
    ticket?.status === 'used' ||
    ticket?.status === 'checked_in' ||
    ticket?.status === 'CHECKED_IN' ||
    ticket?.checkInStatus === 'checked-in' ||
    (ticket as any)?.checked_in_at ||
    (ticket as any)?.is_checked_in
  );

  const isTransferred = Boolean(
    ticket?.transferredAt ||
    (ticket?.status as string) === 'transferred' ||
    (ticket?.status as string) === 'TRANSFERRED'
  );

  const txSignature = ticket?.txSignature || ticket?.signature || ticket?.nftTransactionSignature;

  return (
    <div className="min-h-screen bg-[#070412] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('verifyPage.backToHome')}</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 text-xs font-semibold text-solana-cyan self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('verifyPage.badge')}</span>
          </div>
        </div>

        <div className="text-center sm:text-left space-y-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            {t('verifyPage.title')}{' '}
            <span className="bg-gradient-to-r from-solana-purple via-pink-500 to-solana-cyan bg-clip-text text-transparent">
              {t('verifyPage.titleGradient')}
            </span>
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            {t('verifyPage.subtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('verifyPage.searchPlaceholder')}
              className="w-full bg-[#120B30] border border-solana-purple/30 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-solana-cyan transition-colors shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="ml-3 px-5 py-3.5 bg-gradient-to-r from-solana-purple to-pink-600 hover:from-purple-600 hover:to-pink-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-purple-900/40 shrink-0"
          >
            {t('verifyPage.searchBtn')}
          </button>
        </form>

        {/* Content Display */}
        {loading ? (
          <div className="p-12 text-center bg-[#120B30]/60 border border-white/10 rounded-2xl">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solana-cyan border-t-transparent" />
            <p className="mt-3 text-sm text-slate-300">Đang tra cứu dữ liệu vé trên chuỗi Solana...</p>
          </div>
        ) : !ticket ? (
          searched && (
            <div className="p-10 text-center bg-[#120B30]/70 border border-white/10 rounded-2xl shadow-xl">
              <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white">{t('verifyPage.notFoundTitle')}</h2>
              <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                {t('verifyPage.notFoundSubtitle')}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400">
                <Sparkles className="w-4 h-4 text-solana-cyan" />
                <span>{t('verifyPage.scanQrTip')}</span>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {/* Verification Status Banner */}
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl ${
                isCheckedIn
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {isCheckedIn ? (
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                    <XCircle className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10">
                      Solana Devnet Verified
                    </span>
                    {isCheckedIn ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        ĐÃ SỬ DỤNG
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        HỢP LỆ
                      </span>
                    )}
                    {isTransferred && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {t('verifyPage.statusTransferred')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                    {isCheckedIn ? 'ĐÃ SỬ DỤNG (Đã qua cổng soát vé)' : 'HỢP LỆ (Chưa sử dụng)'}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isCheckedIn
                      ? `Vé đã được check-in vào lúc ${
                          formatDateTime((ticket as any)?.checked_in_at || ticket.checkInTime) ||
                          formatDate((ticket as any)?.checked_in_at || ticket.checkInTime) ||
                          (ticket.checkInTime || (ticket as any)?.checked_in_at || 'vừa qua')
                        } bởi ${ticket.checkedInBy || (ticket as any)?.checked_in_by || 'Staff Gate'}.`
                      : 'Vé nguyên bản, chưa qua cổng soát vé. Sẵn sàng tham gia sự kiện.'}
                  </p>
                </div>
              </div>

              {txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-solana-purple/30 hover:bg-solana-purple/50 border border-solana-purple/50 text-xs font-semibold text-solana-cyan transition-colors self-start sm:self-auto shrink-0"
                >
                  <span>{t('verifyPage.viewExplorer')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Ticket & Event Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Details */}
              <div className="p-6 rounded-2xl bg-[#120B30] border border-solana-purple/20 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-solana-cyan flex items-center gap-2">
                    <TicketIcon className="w-4 h-4" />
                    <span>{t('verifyPage.ticketInfo')}</span>
                  </h3>
                  <button
                    onClick={() => onNavigate('event-detail', ticket.eventId)}
                    className="text-xs text-purple-300 hover:text-white transition-colors underline"
                  >
                    Xem sự kiện
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">{t('verifyPage.eventTitle')}</span>
                    <span className="font-bold text-base text-white">{ticket.eventTitle}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-solana-purple" />
                        <span>{t('verifyPage.timeLabel')}</span>
                      </span>
                      <span className="text-slate-200 font-medium">{ticket.date} · {ticket.time}</span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-solana-cyan" />
                        <span>{t('verifyPage.venueLabel')}</span>
                      </span>
                      <span className="text-slate-200 font-medium">{ticket.venue}, {ticket.city}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-400 block">{t('verifyPage.tierAndSeat')}</span>
                      <span className="font-semibold text-solana-cyan">{ticket.tierName}</span>
                      <span className="text-xs text-slate-400 block mt-0.5">Ghế: {ticket.seat || 'Tự do'}</span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block">{t('verifyPage.ticketCodeLabel')}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-semibold text-white bg-black/40 px-2 py-0.5 rounded border border-white/10">
                          {ticket.ticketCode}
                        </span>
                        <button
                          onClick={() => handleCopy(ticket.ticketCode, 'ticketCode')}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title="Sao chép mã vé"
                        >
                          {copiedField === 'ticketCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-400 flex items-center justify-between">
                    <span>{t('verifyPage.orderIdLabel')}: <span className="font-mono text-slate-300">{ticket.orderId}</span></span>
                    <span>Giá: <span className="font-bold text-solana-cyan">{ticket.priceSol} SOL</span></span>
                  </div>
                </div>
              </div>

              {/* Ownership & Cryptographic Proof */}
              <div className="p-6 rounded-2xl bg-[#120B30] border border-solana-purple/20 shadow-xl space-y-4">
                <div className="border-b border-white/10 pb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-solana-cyan flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{t('verifyPage.ownerSection')}</span>
                  </h3>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">{t('verifyPage.ownerName')}</span>
                    <span className="font-semibold text-white">{ticket.customerName || 'Khách hàng UniTicket'}</span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block">{t('verifyPage.ownerWallet')}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-purple-200 bg-solana-purple/20 px-3 py-1.5 rounded-lg border border-solana-purple/40 break-all">
                        {ticket.customerWallet ? ticket.customerWallet : 'Chưa liên kết ví'}
                      </span>
                      {ticket.customerWallet && (
                        <button
                          onClick={() => handleCopy(ticket.customerWallet, 'wallet')}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                          title="Sao chép địa chỉ ví"
                        >
                          {copiedField === 'wallet' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {ticket.customerWallet && (
                      <a
                        href={`https://explorer.solana.com/address/${ticket.customerWallet}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-solana-cyan hover:underline mt-2"
                      >
                        <span>Kiểm tra ví trên Solana Explorer</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10 text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Thời điểm phát hành:</span>
                      <span className="text-slate-300">{formatDate(ticket.purchaseDate || ticket.purchasedAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tiêu chuẩn vé:</span>
                      <span className="text-solana-cyan font-mono">Solana SPL / Metaplex NFT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* History Section: Mint, Transfer, Check-in */}
            <div className="p-6 rounded-2xl bg-[#120B30] border border-solana-purple/20 shadow-xl space-y-4">
              <div className="border-b border-white/10 pb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-solana-cyan flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{t('verifyPage.historySection')}</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">Devnet Ledger</span>
              </div>

              <div className="space-y-4">
                {/* 1. Mint Transaction */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-lg bg-solana-purple/30 text-solana-cyan shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-white">{t('verifyPage.mintTransaction')}</span>
                      <span className="text-xs text-slate-400">{formatDate(ticket.purchaseDate || ticket.purchasedAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Vé NFT được phát hành thành công cho đơn hàng #{ticket.orderId}.
                    </p>
                    {txSignature ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Tx:</span>
                        <a
                          href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-solana-cyan hover:underline inline-flex items-center gap-1 truncate max-w-xs sm:max-w-md"
                        >
                          <span className="truncate">{txSignature}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Mã tra cứu:</span>
                        <span className="font-mono text-xs text-slate-300">{ticket.ticketCode}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. P2P Transfer History (if any) */}
                {isTransferred && ticket.transferredAt && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white">{t('verifyPage.transferHistory')}</span>
                        <span className="text-xs text-purple-300">{formatDate(ticket.transferredAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        {ticket.transferredFrom && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <span className="text-slate-500">{t('verifyPage.transferredFrom')}</span>
                            <span className="font-mono text-slate-200">
                              {ticket.transferredFrom.slice(0, 6)}...{ticket.transferredFrom.slice(-6)}
                            </span>
                          </div>
                        )}
                        {ticket.transferredTo && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <span className="text-slate-500">{t('verifyPage.transferredTo')}</span>
                            <span className="font-mono text-solana-cyan">
                              {ticket.transferredTo.slice(0, 6)}...{ticket.transferredTo.slice(-6)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Check-in History */}
                {isCheckedIn && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-white">{t('verifyPage.checkInHistory')}</span>
                        {ticket.checkInTime && (
                          <span className="text-xs text-amber-300">{formatDate(ticket.checkInTime, { dateStyle: 'short', timeStyle: 'short' })}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Khán giả đã quét mã QR và xác thực vào cổng thành công. Vé đã được đánh dấu sử dụng.
                      </p>
                      {ticket.checkedInBy && (
                        <p className="text-xs text-slate-400 mt-1">
                          {t('verifyPage.checkedInBy')} <span className="text-slate-200">{ticket.checkedInBy}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
