import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  ExternalLink,
  PlusCircle,
  ScanLine,
  Search,
  Ticket,
  UserCheck,
  X,
  Check,
  Copy,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { EventItem, PurchasedTicket } from '../../types';
import { useTranslation } from '../../i18n';
import * as storage from '../../utils/storage';
import { getInitialDemoTickets, supabaseRowToTicket } from '../../services/api';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { SOLANA_TREASURY_WALLET_STR } from '../../services/solanaClient';

interface OrganizerDashboardProps {
  events: EventItem[];
  tickets: PurchasedTicket[];
  onNavigate: (page: string, param?: string) => void;
  organizerWallet?: string | null;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const isCheckedIn = (ticket: PurchasedTicket) =>
  Boolean(
    ticket?.isCheckedIn ||
    (ticket as any)?.is_checked_in ||
    ticket?.isUsed ||
    (ticket as any)?.is_used ||
    ticket?.checkInStatus === 'checked-in' ||
    ticket?.status === 'checked_in' ||
    ticket?.status === 'CHECKED_IN' ||
    ticket?.status === 'USED' ||
    ticket?.status === 'used' ||
    Boolean(ticket?.checkInTime) ||
    Boolean((ticket as any)?.checked_in_at) ||
    Boolean((ticket as any)?.checkedInAt)
  );

const getRemainingTickets = (event: EventItem) =>
  event.tiers?.reduce((total, tier) => total + tier.remainingQuantity, 0) ?? 0;

const truncateWallet = (address?: string) => {
  if (!address) return 'N/A';
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
  events,
  tickets,
  onNavigate,
  organizerWallet,
  onShowToast,
}) => {
  const { t, formatNumber, formatDate } = useTranslation();

  // Search & filter state for attendee table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'checked_in'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Treasury withdrawal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawnAmount, setWithdrawnAmount] = useState<number>(0);
  const [withdrawTxSig, setWithdrawTxSig] = useState<string | null>(null);

  // Supabase Cloud Realtime tickets synchronization
  const [cloudTickets, setCloudTickets] = useState<PurchasedTicket[]>([]);

  const fetchCloudTickets = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase.from('tickets').select('*');
      if (!error && data) {
        const mapped = data.map((row: any) => supabaseRowToTicket(row));
        setCloudTickets(mapped);
      }
    } catch (err) {
      console.warn('[OrganizerDashboard] Failed to fetch tickets from Supabase:', err);
    }
  }, []);

  useEffect(() => {
    fetchCloudTickets();
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('organizer_dashboard_tickets_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          console.log('[OrganizerDashboard] Realtime tickets update:', payload);
          fetchCloudTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCloudTickets]);

  // Gather all tickets (from props, storage, or demo tickets if empty, merged with cloudTickets)
  const allTickets = useMemo(() => {
    let list = Array.isArray(tickets) && tickets.length > 0 ? [...tickets] : [];
    if (list.length === 0) {
      const stored = storage.getStoredPurchasedTickets();
      if (stored.length > 0) {
        list = stored;
      } else {
        list = getInitialDemoTickets();
      }
    }
    if (cloudTickets.length > 0) {
      const map = new Map<string, PurchasedTicket>();
      list.forEach((t) => {
        const key = (t.ticketCode || t.id).toLowerCase();
        map.set(key, t);
      });
      cloudTickets.forEach((ct) => {
        const key = (ct.ticketCode || ct.id).toLowerCase();
        const existing = map.get(key);
        if (existing) {
          if (isCheckedIn(ct)) {
            map.set(key, { ...existing, ...ct, isCheckedIn: true, status: 'USED', checkInStatus: 'checked-in' });
          }
        } else {
          map.set(key, ct);
        }
      });
      return Array.from(map.values());
    }
    return list;
  }, [tickets, cloudTickets]);

  const eventIds = useMemo(() => new Set(events.map((event) => event.id)), [events]);
  const eventTickets = useMemo(
    () => allTickets.filter((ticket) => eventIds.has(ticket.eventId) || !ticket.eventId),
    [allTickets, eventIds]
  );

  // Metric 1: Tổng số vé đã phát hành
  const totalCapacity = events.reduce((total, event) => total + event.totalTickets, 0);

  // Vé còn lại trong kho
  const totalRemaining = events.reduce((total, event) => total + getRemainingTickets(event), 0);

  // Metric 2: Số vé đã bán thành công
  const totalSold = Math.max(0, totalCapacity - totalRemaining);

  // Metric 3: Tỷ lệ soát vé qua cổng
  const checkedInTickets = allTickets.filter(isCheckedIn).length;
  const effectiveSoldForRatio = Math.max(totalSold, allTickets.length);
  const checkInRatePercent =
    effectiveSoldForRatio > 0
      ? ((checkedInTickets / effectiveSoldForRatio) * 100).toFixed(1)
      : '0.0';

  // Metric 4: Tổng doanh thu nhận được (tính bằng SOL và VNĐ)
  const mockRevenue = events.reduce((total, event) => total + event.soldTickets * event.minPriceSol, 0);
  const totalRevenueSol = mockRevenue > 0
    ? mockRevenue
    : allTickets.reduce((sum, t) => sum + (Number(t.priceSol) || 0), 0);
  const totalRevenueVnd = Math.round(totalRevenueSol * 3800000);

  // Contract Treasury Balance (minus withdrawn amount)
  const treasuryBalance = Math.max(0, totalRevenueSol - withdrawnAmount);

  // Thống kê Doanh thu Bản quyền Thứ cấp (Secondary Royalties: tổng hợp 10% từ các giao dịch bán lại vé)
  const secondaryRoyaltySol = useMemo(() => {
    const sum = allTickets.reduce((acc, t) => {
      if (typeof (t as any).royalty_sol === 'number') {
        return acc + (t as any).royalty_sol;
      }
      if ((t.transfer_count && t.transfer_count > 0) || t.transferredAt) {
        const price = Number(t.listing_price_sol || t.priceSol) || 0.05;
        return acc + price * 0.10 * (t.transfer_count || 1);
      }
      return acc;
    }, 0);
    return sum > 0 ? Number(sum.toFixed(2)) : 0.15;
  }, [allTickets]);

  // Filtered attendees
  const filteredTickets = useMemo(() => {
    return allTickets.filter((ticket) => {
      // Event filter
      if (eventFilter !== 'all' && ticket.eventId !== eventFilter) {
        return false;
      }
      // Status filter
      const checked = isCheckedIn(ticket);
      if (statusFilter === 'checked_in' && !checked) return false;
      if (statusFilter === 'valid' && checked) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const codeMatch = (ticket.ticketCode || ticket.id || '').toLowerCase().includes(q);
      const nameMatch = (ticket.customerName || '').toLowerCase().includes(q);
      const walletMatch = (ticket.customerWallet || '').toLowerCase().includes(q);
      const eventMatch = (ticket.eventTitle || '').toLowerCase().includes(q);
      const tierMatch = (ticket.tierName || '').toLowerCase().includes(q);

      return codeMatch || nameMatch || walletMatch || eventMatch || tierMatch;
    });
  }, [allTickets, eventFilter, statusFilter, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // CSV Export handler
  const handleExportCsv = () => {
    try {
      const headers = [
        'STT',
        'Mã Vé (Ticket Code)',
        'Khán Giả (Customer Name)',
        'Địa Chỉ Ví Solana (Wallet Address)',
        'Sự Kiện (Event Title)',
        'Hạng Vé (Tier)',
        'Giá SOL (Price)',
        'Thời Gian Mua (Purchased At)',
        'Trạng Thái (Status)',
      ];

      const rows = filteredTickets.map((t, idx) => {
        const checked = isCheckedIn(t);
        const statusText = checked ? 'Đã soát vé' : 'Chưa dùng';
        const cleanName = (t.customerName || 'Khách tham dự').replace(/"/g, '""');
        const cleanEvent = (t.eventTitle || '').replace(/"/g, '""');
        const cleanTier = (t.tierName || '').replace(/"/g, '""');
        const cleanDate = t.purchasedAt || t.purchaseDate || '';

        return [
          idx + 1,
          `"${t.ticketCode || t.id}"`,
          `"${cleanName}"`,
          `"${t.customerWallet || ''}"`,
          `"${cleanEvent}"`,
          `"${cleanTier}"`,
          t.priceSol || 0,
          `"${cleanDate}"`,
          `"${statusText}"`,
        ].join(',');
      });

      // UTF-8 BOM for Microsoft Excel on Windows
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `uniticket-attendees-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onShowToast) {
        onShowToast('success', `Đã xuất thành công ${filteredTickets.length} vé ra file CSV/Excel!`);
      }
    } catch (err) {
      console.error('Lỗi xuất file CSV:', err);
      if (onShowToast) {
        onShowToast('error', 'Không thể tạo file CSV. Vui lòng thử lại!');
      }
    }
  };

  // Withdraw simulation
  const handleConfirmWithdraw = async () => {
    setIsWithdrawing(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const randomSig = `4${Array.from({ length: 84 }, () =>
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
    ).join('')}`;

    const amount = treasuryBalance;
    setWithdrawnAmount((prev) => prev + amount);
    setWithdrawTxSig(randomSig);
    setIsWithdrawing(false);
    setIsWithdrawModalOpen(false);

    if (onShowToast) {
      onShowToast('success', `Đã rút thành công ${amount.toFixed(2)} SOL về ví Ban tổ chức!`);
    }
  };

  const recipientWalletDisplay = organizerWallet || SOLANA_TREASURY_WALLET_STR;

  return (
    <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg text-left">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-solana-green/30 bg-solana-green/10 px-3 py-1 text-xs font-semibold text-solana-green">
              <BarChart3 className="h-4 w-4" /> {t('organizer.demoMode')}
            </div>
            <h1 className="text-2xl font-extrabold text-white sm:text-4xl">
              {t('organizer.dashboardTitle')}
            </h1>
            <p className="mt-2 text-xs text-slate-300 sm:text-sm">
              {t('organizer.dashboardSubtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('organizer-events')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
            >
              <CalendarDays className="h-4 w-4 text-solana-cyan" /> {t('organizer.manageEventsBtn')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('check-in')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-2.5 text-xs font-semibold text-solana-cyan hover:bg-solana-cyan/20 transition-colors"
            >
              <ScanLine className="h-4 w-4" /> {t('organizer.openCheckIn')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create-event')}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-95 transition-opacity"
            >
              <PlusCircle className="h-4 w-4" /> {t('organizer.createEventBtn')}
            </button>
          </div>
        </header>

        {/* 1. THỐNG KÊ DOANH THU & SỐ LƯỢNG VÉ (4 METRIC CARDS) */}
        <section aria-label="Organizer Metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Card 1: Tổng số vé đã phát hành */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#120B30]/90 p-5 shadow-xl transition-all duration-300 hover:border-solana-cyan/50 hover:shadow-solana-cyan/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {t('organizer.totalTicketsIssued')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-solana-cyan/10 text-solana-cyan">
                  <Ticket className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-black text-white">
                {formatNumber(totalCapacity)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {events.length} sự kiện trên hệ thống
              </p>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-solana-cyan/0 via-solana-cyan/40 to-solana-cyan/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Card 2: Số vé đã bán thành công */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#120B30]/90 p-5 shadow-xl transition-all duration-300 hover:border-solana-green/50 hover:shadow-solana-green/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {t('organizer.ticketsSoldSuccess')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-solana-green/10 text-solana-green">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-black text-white">
                {formatNumber(totalSold)}
              </p>
              <p className="mt-1 text-xs text-solana-green">
                {formatNumber(totalRemaining)} vé còn lại trong kho
              </p>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-solana-green/0 via-solana-green/40 to-solana-green/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Card 3: Tỷ lệ soát vé qua cổng (% Check-in) */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#120B30]/90 p-5 shadow-xl transition-all duration-300 hover:border-solana-purple/50 hover:shadow-solana-purple/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {t('organizer.checkInRate')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-solana-purple/20 text-solana-purple">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-3xl font-black text-white">{checkInRatePercent}%</p>
                <span className="text-xs text-slate-400">
                  ({checkedInTickets} / {effectiveSoldForRatio} vé)
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-solana-purple to-neon-pink transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, Number(checkInRatePercent)))}%` }}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-solana-purple/0 via-solana-purple/40 to-solana-purple/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Card 4: Tổng doanh thu nhận được (tính bằng SOL và VNĐ) */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#120B30]/90 p-5 shadow-xl transition-all duration-300 hover:border-neon-pink/50 hover:shadow-neon-pink/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {t('organizer.totalRevenue')}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon-pink/10 text-neon-pink">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-black text-neon-pink">
                {totalRevenueSol.toFixed(2)} SOL
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-200">
                  ≈ {totalRevenueVnd.toLocaleString('vi-VN')} ₫
                </p>
                <span className="text-[10px] text-slate-400">1 SOL ≈ 3.8M ₫</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-neon-pink/0 via-neon-pink/40 to-neon-pink/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Card 5: Bản quyền Thứ cấp (Secondary Royalties) */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#120B30]/90 p-5 shadow-xl transition-all duration-300 hover:border-yellow-400/50 hover:shadow-yellow-400/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  Bản quyền Thứ cấp (Secondary Royalties)
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-300">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-black text-yellow-300">
                +{secondaryRoyaltySol.toFixed(2)} SOL
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-200">
                  10% chia sẻ từ giao dịch bán lại
                </p>
                <span className="text-[10px] font-bold text-solana-cyan px-1.5 py-0.5 rounded bg-solana-cyan/10 border border-solana-cyan/30">
                  10% Royalty
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-yellow-400/0 via-yellow-400/40 to-yellow-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </section>

        {/* 3. RÚT TIỀN QUỸ (SMART CONTRACT TREASURY BANNER & WITHDRAWAL BUTTON) */}
        <section
          aria-label="Smart Contract Treasury"
          className="rounded-2xl border border-solana-green/30 bg-gradient-to-r from-[#120B30] via-[#1a0f3c] to-[#0e1f32] p-5 shadow-2xl sm:p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-solana-green/20 text-solana-green">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  {t('organizer.treasuryTitle')}
                </h2>
                <span className="rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2.5 py-0.5 text-[11px] font-medium text-solana-cyan">
                  {t('organizer.treasuryContract')}
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {t('organizer.treasurySubtitle')}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
                <span>
                  {t('organizer.recipientWallet')}:{' '}
                  <code className="text-solana-cyan font-mono font-semibold">
                    {truncateWallet(recipientWalletDisplay)}
                  </code>
                </span>
                {withdrawTxSig && (
                  <a
                    href={`https://explorer.solana.com/tx/${withdrawTxSig}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-solana-green hover:underline"
                  >
                    Xem GD rút gần nhất <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center sm:text-right">
                <span className="text-[11px] text-slate-400 block">
                  {t('organizer.treasuryBalance')}
                </span>
                <span className="text-xl font-black text-solana-green">
                  {treasuryBalance.toFixed(2)} SOL
                </span>
                <span className="text-[11px] text-slate-400 block">
                  ≈ {(treasuryBalance * 3800000).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={treasuryBalance <= 0}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold shadow-xl transition-all ${
                  treasuryBalance > 0
                    ? 'bg-gradient-to-r from-solana-green via-emerald-500 to-solana-cyan text-black hover:opacity-95 hover:scale-[1.02] cursor-pointer'
                    : 'bg-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Coins className="h-4 w-4" />
                {t('organizer.withdrawRevenueBtn')}
              </button>
            </div>
          </div>
        </section>

        {/* 2. DANH SÁCH KHÁN GIẢ (ATTENDEE MANAGEMENT TABLE) */}
        <section aria-label="Attendee Management" className="rounded-2xl border border-white/10 bg-[#120B30] p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-solana-cyan" />
                <h2 className="text-lg font-bold text-white">
                  {t('organizer.attendeeManagement')}
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-300">
                  {filteredTickets.length} vé
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {t('organizer.attendeeSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-solana-green/40 bg-solana-green/10 px-4 py-2 text-xs font-bold text-solana-green hover:bg-solana-green/20 transition-colors"
              >
                <Download className="h-4 w-4" />
                {t('organizer.exportCsv')}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            {/* Search Input */}
            <div className="relative sm:col-span-2 lg:col-span-6">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('organizer.searchAttendeePlaceholder')}
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-9 text-xs text-white placeholder-slate-500 focus:border-solana-cyan focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label={t('organizer.statusCol')}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white focus:border-solana-cyan focus:outline-none"
              >
                <option value="all" className="bg-[#120B30] text-white">
                  {t('organizer.allStatus')}
                </option>
                <option value="valid" className="bg-[#120B30] text-white">
                  {t('organizer.statusValid')} (Chưa soát vé)
                </option>
                <option value="checked_in" className="bg-[#120B30] text-white">
                  {t('organizer.statusCheckedIn')} (Đã soát vé)
                </option>
              </select>
            </div>

            {/* Event Filter */}
            <div className="lg:col-span-3">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                aria-label={t('organizer.eventSnapshot')}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white focus:border-solana-cyan focus:outline-none"
              >
                <option value="all" className="bg-[#120B30] text-white">
                  Tất cả sự kiện ({events.length})
                </option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id} className="bg-[#120B30] text-white">
                    {evt.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table view */}
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t('organizer.ticketCodeCol')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('organizer.buyerNameCol')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('organizer.walletCol')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('organizer.tierCol')}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t('organizer.purchaseTimeCol')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    {t('organizer.statusCol')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('organizer.actionsCol')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      <Ticket className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                      <p>{t('organizer.noAttendeesFound')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => {
                    const checked = isCheckedIn(ticket);
                    const code = ticket.ticketCode || ticket.id;
                    const wallet = ticket.customerWallet || '';
                    const isVip = (ticket.tierName || '').toLowerCase().includes('vip');

                    return (
                      <tr key={ticket.id} className="hover:bg-white/5 transition-colors">
                        {/* Mã vé */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-solana-cyan">
                              {code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(code, `code-${ticket.id}`)}
                              className="text-slate-400 hover:text-white"
                              title="Sao chép mã vé"
                            >
                              {copiedText === `code-${ticket.id}` ? (
                                <Check className="h-3 w-3 text-solana-green" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                            {ticket.eventTitle}
                          </span>
                        </td>

                        {/* Tên người mua */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-semibold text-white">
                            {ticket.customerName || 'Khách tham dự'}
                          </span>
                          {ticket.customerEmail && (
                            <span className="text-[10px] text-slate-500 block truncate max-w-[130px]">
                              {ticket.customerEmail}
                            </span>
                          )}
                        </td>

                        {/* Địa chỉ ví Solana */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300">
                              {truncateWallet(wallet)}
                            </span>
                            {wallet && (
                              <button
                                type="button"
                                onClick={() => handleCopy(wallet, `wallet-${ticket.id}`)}
                                className="text-slate-400 hover:text-white"
                                title="Sao chép địa chỉ ví"
                              >
                                {copiedText === `wallet-${ticket.id}` ? (
                                  <Check className="h-3 w-3 text-solana-green" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Hạng vé */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              isVip
                                ? 'border border-amber-400/40 bg-amber-400/10 text-amber-300'
                                : 'border border-solana-cyan/30 bg-solana-cyan/10 text-solana-cyan'
                            }`}
                          >
                            {ticket.tierName || 'Standard'}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {ticket.priceSol} SOL
                          </span>
                        </td>

                        {/* Thời gian mua */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                          {ticket.purchasedAt || ticket.purchaseDate
                            ? formatDate(ticket.purchasedAt || ticket.purchaseDate)
                            : '—'}
                        </td>

                        {/* Trạng thái */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          {checked ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-solana-green/40 bg-solana-green/10 px-2.5 py-1 text-[11px] font-semibold text-solana-green">
                              <CheckCircle2 className="h-3 w-3" />
                              ĐÃ CHECK-IN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-solana-cyan/40 bg-solana-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-solana-cyan">
                              <span className="h-1.5 w-1.5 rounded-full bg-solana-cyan animate-pulse" />
                              {t('organizer.statusValid')}
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onNavigate('verify', ticket.id)}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                              title="Tra cứu xác minh vé công khai"
                            >
                              Tra cứu
                            </button>
                            {wallet && (
                              <a
                                href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-white/10 bg-white/5 p-1 text-slate-400 hover:text-solana-cyan"
                                title="Xem ví trên Solana Explorer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Existing Event Snapshot & Check-in quick tools */}
        {events.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {t('organizer.eventSnapshot')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {t('organizer.inventoryLoaded')}
                  </p>
                </div>
                <CalendarDays className="h-5 w-5 text-solana-cyan" />
              </div>
              <div className="space-y-3">
                {events.slice(0, 4).map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-white">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(event.date)} · {event.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-solana-green">
                        {t('common.remainingTickets', {
                          count: getRemainingTickets(event),
                        })}
                      </span>
                      <span className="text-slate-400">{event.status ?? 'published'}</span>
                    </div>
                  </div>
                ))}
              </div>
              {events.length > 4 && (
                <button
                  type="button"
                  onClick={() => onNavigate('organizer-events')}
                  className="mt-4 text-xs font-semibold text-solana-cyan hover:text-white"
                >
                  {t('organizer.manageEventsBtn')} →
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-solana-cyan" />
                <h2 className="text-lg font-bold text-white">
                  {t('organizer.checkInTools')}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('organizer.checkInToolsDesc')}
              </p>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-solana-green/20 bg-solana-green/5 p-3 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-solana-green" />
                {t('organizer.checkedInRatio', {
                  checkedIn: checkedInTickets,
                  total: eventTickets.length || effectiveSoldForRatio,
                })}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('check-in')}
                className="mt-4 min-h-11 w-full rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-3 text-sm font-bold text-solana-cyan hover:bg-solana-cyan/20 transition-colors"
              >
                {t('organizer.openCheckIn')}
              </button>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                {t('organizer.inventoryLoaded')}
              </p>
            </section>
          </div>
        )}

        {/* Modal Rút Doanh Thu Về Ví Ban Tổ Chức */}
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-lg rounded-2xl border border-solana-green/40 bg-[#120B30] p-6 shadow-2xl text-left">
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                disabled={isWithdrawing}
                className="absolute right-4 top-4 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-solana-green/20 text-solana-green">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {t('organizer.withdrawModalTitle')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Smart Contract Escrow Payout (Devnet)
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 rounded-xl border border-white/10 bg-black/40 p-4 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-slate-400">{t('organizer.withdrawAmount')}:</span>
                  <div className="text-right">
                    <span className="font-bold text-solana-green text-sm">
                      {treasuryBalance.toFixed(2)} SOL
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      ≈ {(treasuryBalance * 3800000).toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-slate-400">{t('organizer.recipientWallet')}:</span>
                  <span className="font-mono text-solana-cyan font-semibold">
                    {truncateWallet(recipientWalletDisplay)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Phí mạng ước tính:</span>
                  <span className="font-mono text-slate-300">~0.000005 SOL</span>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-400">
                {t('organizer.withdrawModalDesc')}
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  disabled={isWithdrawing}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  {t('organizer.cancelBtn')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWithdraw}
                  disabled={isWithdrawing || treasuryBalance <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-solana-green via-emerald-500 to-solana-cyan py-3 text-xs font-bold text-black shadow-lg hover:opacity-95 disabled:opacity-50"
                >
                  {isWithdrawing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t('organizer.withdrawProcessing')}
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4" />
                      {t('organizer.confirmWithdrawBtn')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
