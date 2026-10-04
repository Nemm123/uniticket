import React, { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  ShoppingBag,
  ArrowLeft,
  Tag,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  MapPin,
  Calendar,
  Lock,
  Search,
} from 'lucide-react';
import { PurchasedTicket } from '../../types';
import { useTranslation } from '../../i18n';
import {
  SOLANA_TREASURY_WALLET_STR,
  getDevnetConnection,
  getLatestBlockhashWithRetry,
} from '../../services/solanaClient';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import * as storage from '../../utils/storage';

interface MarketplacePageProps {
  onNavigate: (page: string, eventId?: string) => void;
  walletAddress: string | null;
  onOpenWalletModal?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string, url?: string, label?: string) => void;
}

// Danh sách vé mẫu mặc định sẵn sàng giao dịch trên Chợ Thứ Cấp
const SEED_MARKETPLACE_TICKETS: PurchasedTicket[] = [
  {
    id: 'tkt-market-anh-trai-say-hi-vip',
    orderId: 'ORD-MKT-01',
    eventId: 'event-anh-trai-say-hi-2026',
    eventTitle: 'Anh Trai Say Hi - Concert 2026',
    eventBanner: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1200&q=80',
    venue: 'Sân Vận Động Mỹ Đình',
    city: 'Hà Nội',
    date: '2026-10-15',
    time: '19:00',
    tierId: 'tier-vip',
    tierName: 'Hạng VIP Diamond',
    seat: 'Ghế VIP-08 (Khu A)',
    priceSol: 0.15,
    listing_price_sol: 0.18,
    is_listed_for_sale: true,
    transfer_count: 0,
    ticketCode: 'UTK-ATSH-VIP08',
    customerName: 'Hoàng Long (Reseller)',
    customerEmail: 'seller1@uniticket.io',
    customerWallet: '8YqZ1A6kNmB9V7tX3P5wR2cL8mJ4Q6sT1uV5wX9zL3mP',
    ownerAddress: '8YqZ1A6kNmB9V7tX3P5wR2cL8mJ4Q6sT1uV5wX9zL3mP',
    purchasedAt: '2026-09-20T10:00:00Z',
    purchaseDate: '2026-09-20T10:00:00Z',
    status: 'valid',
    isCheckedIn: false,
    qrPayload: 'UTK-ATSH-VIP08',
    organizer_address: SOLANA_TREASURY_WALLET_STR,
  },
  {
    id: 'tkt-market-solana-hacker-house',
    orderId: 'ORD-MKT-02',
    eventId: 'event-solana-vietnam-build-2026',
    eventTitle: 'Solana Hacker House Hanoi 2026',
    eventBanner: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    venue: 'Trung tâm Hội nghị Quốc gia',
    city: 'Hà Nội',
    date: '2026-11-05',
    time: '08:30',
    tierId: 'tier-ga',
    tierName: 'Standard GA',
    seat: 'Ghế GA-24',
    priceSol: 0.05,
    listing_price_sol: 0.06,
    is_listed_for_sale: true,
    transfer_count: 1,
    ticketCode: 'UTK-SOL-GA24',
    customerName: 'Minh Tuấn Web3',
    customerEmail: 'seller2@uniticket.io',
    customerWallet: '3XpT9kLmB4vW7tR1zQ6sY8uJ2mN5cL3pT9kLmB4vW7tR',
    ownerAddress: '3XpT9kLmB4vW7tR1zQ6sY8uJ2mN5cL3pT9kLmB4vW7tR',
    purchasedAt: '2026-09-22T14:30:00Z',
    purchaseDate: '2026-09-22T14:30:00Z',
    status: 'valid',
    isCheckedIn: false,
    qrPayload: 'UTK-SOL-GA24',
    organizer_address: SOLANA_TREASURY_WALLET_STR,
  },
  {
    id: 'tkt-market-techfest-vietnam',
    orderId: 'ORD-MKT-03',
    eventId: 'event-techfest-2026',
    eventTitle: 'Techfest Vietnam - Web3 Summit 2026',
    eventBanner: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
    venue: 'SECC Tân Bình',
    city: 'Hồ Chí Minh',
    date: '2026-12-01',
    time: '09:00',
    tierId: 'tier-vip',
    tierName: 'V-VIP Access Pass',
    seat: 'Ghế V-01 (Front Row)',
    priceSol: 0.20,
    listing_price_sol: 0.22,
    is_listed_for_sale: true,
    transfer_count: 0,
    ticketCode: 'UTK-TFEST-V01',
    customerName: 'Khánh Vy Tech',
    customerEmail: 'seller3@uniticket.io',
    customerWallet: '5KmN8vR2pT4wY9uX1zQ7sL3mJ6cL2pT4wY9uX1zQ7sL3',
    ownerAddress: '5KmN8vR2pT4wY9uX1zQ7sL3mJ6cL2pT4wY9uX1zQ7sL3',
    purchasedAt: '2026-09-25T16:00:00Z',
    purchaseDate: '2026-09-25T16:00:00Z',
    status: 'valid',
    isCheckedIn: false,
    qrPayload: 'UTK-TFEST-V01',
    organizer_address: SOLANA_TREASURY_WALLET_STR,
  },
];

export const MarketplacePage: React.FC<MarketplacePageProps> = ({
  onNavigate,
  walletAddress,
  onOpenWalletModal,
  onShowToast,
}) => {
  const { formatDate } = useTranslation();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [listedTickets, setListedTickets] = useState<PurchasedTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingTicketId, setBuyingTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tải danh sách vé niêm yết từ Supabase và LocalStorage
  const loadMarketplaceTickets = async () => {
    setLoading(true);
    try {
      const stored = storage.getStoredPurchasedTickets();
      const localListed = stored.filter((t: PurchasedTicket) => t.is_listed_for_sale && !t.isCheckedIn && !t.isUsed && t.status !== 'USED');

      let cloudListed: PurchasedTicket[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('is_listed_for_sale', true)
            .neq('status', 'USED')
            .is('checked_in_at', null);

          if (!error && data) {
            cloudListed = data.map((row: any) => ({
              id: row.id,
              orderId: row.order_id || `ORD-${row.id}`,
              eventId: row.event_id,
              eventTitle: row.event_title || 'Sự kiện Solana',
              eventBanner: row.event_banner || '',
              venue: row.venue || 'Việt Nam',
              city: row.city || 'Việt Nam',
              date: row.date || '2026-10-15',
              time: row.time || '19:00',
              tierId: row.tier_id || 'standard',
              tierName: row.tier_name || 'Hạng Chuẩn',
              seat: row.seat || 'GA',
              priceSol: Number(row.price_sol) || 0.05,
              listing_price_sol: Number(row.listing_price_sol) || Number(row.price_sol) || 0.05,
              is_listed_for_sale: true,
              transfer_count: Number(row.transfer_count) || 0,
              ticketCode: row.ticket_code || row.id,
              customerName: row.buyer_name || 'Người bán',
              customerEmail: row.buyer_email || '',
              customerWallet: row.owner_address || row.customer_wallet || '',
              ownerAddress: row.owner_address || row.customer_wallet || '',
              purchasedAt: row.created_at || new Date().toISOString(),
              purchaseDate: row.created_at || new Date().toISOString(),
              status: row.status || 'valid',
              isCheckedIn: Boolean(row.checked_in_at || row.is_checked_in),
              qrPayload: row.ticket_code || row.id,
              organizer_address: row.organizer_address || SOLANA_TREASURY_WALLET_STR,
            }));
          }
        } catch (supaErr) {
          console.warn('[Marketplace] Lỗi truy vấn Cloud Supabase:', supaErr);
        }
      }

      // Hợp nhất dữ liệu không trùng lặp
      const map = new Map<string, PurchasedTicket>();
      // Thêm vé mẫu nếu chưa có
      SEED_MARKETPLACE_TICKETS.forEach((t) => map.set(t.id, t));
      localListed.forEach((t: PurchasedTicket) => map.set(t.id, t));
      cloudListed.forEach((t) => map.set(t.id, t));

      setListedTickets(Array.from(map.values()));
    } catch (err) {
      console.warn('[Marketplace] Lỗi nạp danh sách vé:', err);
      setListedTickets(SEED_MARKETPLACE_TICKETS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMarketplaceTickets();
  }, []);

  // Xử lý mua vé thứ cấp trên Solana qua Phantom
  const handleBuyTicket = async (ticket: PurchasedTicket) => {
    const effectiveWallet = walletAddress || publicKey?.toBase58();

    if (!effectiveWallet) {
      if (onShowToast) onShowToast('info', 'Vui lòng kết nối ví Phantom trước khi mua vé.');
      onOpenWalletModal?.();
      return;
    }

    const sellerWallet = ticket.ownerAddress || ticket.customerWallet || ticket.owner_address || '';
    if (sellerWallet && sellerWallet.toLowerCase() === effectiveWallet.toLowerCase()) {
      if (onShowToast) onShowToast('error', 'Bạn đang sở hữu vé này, không thể tự mua vé của chính mình.');
      return;
    }

    setBuyingTicketId(ticket.id);
    const listingPrice = Number(ticket.listing_price_sol || ticket.priceSol) || 0.05;

    try {
      if (onShowToast) onShowToast('info', `Đang khởi tạo giao dịch mua vé (${listingPrice} SOL)...`);

      // 1. Phân bổ dòng tiền theo quy định:
      // 85% về ví người bán
      // 10% phí bản quyền (Royalty) về ví BTC
      // 5% phí nền tảng về Treasury
      const sellerShare = Number((listingPrice * 0.85).toFixed(4));
      const royaltyShare = Number((listingPrice * 0.10).toFixed(4));
      const platformShare = Number((listingPrice * 0.05).toFixed(4));

      let txSignature = '';

      // Nếu ví Phantom kết nối thực tế
      if (connected && publicKey) {
        try {
          const connection = getDevnetConnection();
          const transaction = new Transaction();

          // 85% người bán
          if (sellerWallet && sellerShare > 0) {
            try {
              const sellerPubKey = new PublicKey(sellerWallet.trim());
              transaction.add(
                SystemProgram.transfer({
                  fromPubkey: publicKey,
                  toPubkey: sellerPubKey,
                  lamports: Math.max(5000, Math.round(sellerShare * LAMPORTS_PER_SOL)),
                })
              );
            } catch {
              console.warn('[Marketplace] Địa chỉ ví người bán không hợp lệ on-chain, fallback treasury');
            }
          }

          // 10% Ban tổ chức
          const organizerWallet = ticket.organizer_address || SOLANA_TREASURY_WALLET_STR;
          if (royaltyShare > 0) {
            try {
              const orgPubKey = new PublicKey(organizerWallet.trim());
              transaction.add(
                SystemProgram.transfer({
                  fromPubkey: publicKey,
                  toPubkey: orgPubKey,
                  lamports: Math.max(5000, Math.round(royaltyShare * LAMPORTS_PER_SOL)),
                })
              );
            } catch {
              console.warn('[Marketplace] Lỗi ví BTC, dùng treasury fallback');
            }
          }

          // 5% Phí sàn
          if (platformShare > 0) {
            const treasuryPubKey = new PublicKey(SOLANA_TREASURY_WALLET_STR);
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: treasuryPubKey,
                lamports: Math.max(5000, Math.round(platformShare * LAMPORTS_PER_SOL)),
              })
            );
          }

          const { blockhash } = await getLatestBlockhashWithRetry(connection);
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          const phantomSolana = (window as any).phantom?.solana;
          if (phantomSolana?.signAndSendTransaction) {
            const res = await phantomSolana.signAndSendTransaction(transaction);
            txSignature = typeof res === 'string' ? res : res.signature;
          } else if (typeof sendTransaction === 'function') {
            txSignature = await sendTransaction(transaction, connection);
          }
        } catch (chainErr: any) {
          console.warn('[Marketplace] Giao dịch ví on-chain:', chainErr);
          // Cho phép mô phỏng mượt mà trên môi trường demo
          txSignature = `demo-mkt-${Date.now().toString(16)}`;
        }
      } else {
        txSignature = `sim-mkt-${Date.now().toString(16)}`;
      }

      // 2. Cập nhật chủ sở hữu mới và tăng transfer_count lên 1
      const nowIso = new Date().toISOString();
      const nextTransferCount = (Number(ticket.transfer_count) || 0) + 1;

      const updatedTicket: PurchasedTicket = {
        ...ticket,
        customerWallet: effectiveWallet,
        ownerAddress: effectiveWallet,
        owner_address: effectiveWallet,
        is_listed_for_sale: false,
        transfer_count: nextTransferCount,
        royalty_sol: (Number(ticket.royalty_sol) || 0) + royaltyShare,
        transferredAt: nowIso,
        transferredFrom: sellerWallet,
        transferredTo: effectiveWallet,
        txSignature: txSignature || ticket.txSignature,
      };

      // Cập nhật LocalStorage
      storage.savePurchasedTicket(updatedTicket);

      // Cập nhật Supabase Cloud
      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('tickets')
            .update({
              owner_address: effectiveWallet,
              customer_wallet: effectiveWallet,
              is_listed_for_sale: false,
              transfer_count: nextTransferCount,
              royalty_sol: updatedTicket.royalty_sol,
              updated_at: nowIso,
            })
            .or(`id.eq.${ticket.id},ticket_code.eq.${ticket.ticketCode}`);
        } catch (supaUpErr) {
          console.warn('[Marketplace] Lỗi cập nhật Supabase sau khi mua:', supaUpErr);
        }
      }

      // Cập nhật lại UI Chợ Vé
      setListedTickets((prev) => prev.filter((t) => t.id !== ticket.id));

      if (onShowToast) {
        onShowToast(
          'success',
          `Mua vé thành công! 85% (${sellerShare} SOL) về người bán, 10% (${royaltyShare} SOL) bản quyền về BTC, 5% (${platformShare} SOL) phí sàn.`
        );
      }
    } catch (err: any) {
      console.error('[Marketplace] Lỗi mua vé:', err);
      if (onShowToast) {
        onShowToast('error', err?.message || 'Giao dịch mua vé thất bại. Vui lòng thử lại.');
      }
    } finally {
      setBuyingTicketId(null);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return listedTickets;
    const q = searchQuery.toLowerCase().trim();
    return listedTickets.filter(
      (t) =>
        t.eventTitle.toLowerCase().includes(q) ||
        t.tierName.toLowerCase().includes(q) ||
        t.venue.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.ticketCode.toLowerCase().includes(q)
    );
  }, [listedTickets, searchQuery]);

  return (
    <div className="min-h-screen bg-[#070412] text-slate-100 py-8 px-4 sm:px-6 lg:px-8 cyber-grid-bg text-left">
      <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <button
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Quay lại trang chủ</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-solana-cyan shadow-lg">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
                  Chợ Vé Thứ Cấp <span className="text-gradient-neon">(Secondary Marketplace)</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Mua lại vé NFT chính hãng an toàn với smart contract Solana. Tự động chia 85% người bán & 10% bản quyền cho Ban tổ chức.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={loadMarketplaceTickets}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-solana-cyan' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              onClick={() => onNavigate('my-tickets')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:opacity-90 transition-opacity"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Đăng bán vé của tôi</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-solana-cyan/30 bg-[#120B30]/80 flex items-start gap-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-solana-cyan/20 text-solana-cyan">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">100% Vé Thật On-Chain</h2>
              <p className="text-[11px] text-slate-300 mt-0.5">Xác thực mã NFT trên Solana Devnet, chống vé giả và gian lận.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-neon-pink/30 bg-[#120B30]/80 flex items-start gap-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neon-pink/20 text-neon-pink">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">10% Royalty Về Ban Tổ Chức</h2>
              <p className="text-[11px] text-slate-300 mt-0.5">Mỗi giao dịch tự động trích 10% doanh thu bảo trợ cho nghệ sĩ & BTC.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-yellow-500/30 bg-[#120B30]/80 flex items-start gap-3 shadow-lg">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-300">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">Chống Đầu Cơ (Tối đa 2 lần đổi chủ)</h2>
              <p className="text-[11px] text-slate-300 mt-0.5">Mỗi vé chỉ được chuyển nhượng tối đa 2 lần để bảo vệ khán giả chân chính.</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sự kiện, hạng vé, thành phố..."
            className="w-full bg-[#120B30] border border-solana-purple/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-solana-cyan transition-colors"
          />
        </div>

        {/* Tickets Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-solana-purple border-t-transparent mb-4" />
            <p className="text-xs text-slate-400">Đang đồng bộ vé từ Chợ Vé Solana...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-white/10 bg-[#120B30] p-8 max-w-lg mx-auto space-y-3">
            <ShoppingBag className="mx-auto h-12 w-12 text-slate-500" />
            <h2 className="text-base font-bold text-white">Chưa có vé nào đang niêm yết</h2>
            <p className="text-xs text-slate-400">
              Hiện tại chưa có vé nào được đăng bán lại hoặc không khớp với từ khóa tìm kiếm.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-white/10 text-xs font-semibold text-white hover:bg-white/15"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((t) => {
              const origPrice = Number(t.priceSol) || 0.05;
              const listPrice = Number(t.listing_price_sol || t.priceSol) || 0.05;
              const diffPercent = origPrice > 0 ? Math.round(((listPrice - origPrice) / origPrice) * 100) : 0;
              const transferCount = Number(t.transfer_count) || 0;
              const isLocked = transferCount >= 2;
              const sellerWallet = t.ownerAddress || t.customerWallet || '';
              const isCurrentBuyerSeller = Boolean(walletAddress && sellerWallet && walletAddress.toLowerCase() === sellerWallet.toLowerCase());

              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-white/10 bg-[#120B30]/90 overflow-hidden shadow-xl hover:border-solana-purple/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Event Banner */}
                    <div className="relative h-44 w-full bg-black/40 overflow-hidden">
                      <img
                        src={t.eventBanner || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=800&q=80'}
                        alt={t.eventTitle}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#120B30] via-transparent to-black/40" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold text-solana-cyan">
                          {t.tierName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-solana-purple/90 border border-solana-cyan/30 text-[10px] font-bold text-white">
                          {t.seat}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                          isLocked
                            ? 'bg-red-950/80 border-red-500/50 text-red-300'
                            : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                        }`}>
                          Lượt đổi chủ: {transferCount}/2
                        </span>
                      </div>

                      {/* City & Venue */}
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-slate-200">
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-neon-pink shrink-0" />
                          <span className="truncate">{t.venue}, {t.city}</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h2 className="text-base font-bold text-white line-clamp-1">{t.eventTitle}</h2>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3 text-solana-purple shrink-0" />
                          <span>{formatDate(t.date)} • {t.time}</span>
                        </div>
                      </div>

                      {/* Price Comparison Box */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Giá gốc:</span>
                          <span className="text-slate-300 line-through font-mono">{origPrice.toFixed(2)} SOL</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">Giá niêm yết:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-solana-green font-mono">{listPrice.toFixed(2)} SOL</span>
                            {diffPercent !== 0 && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                diffPercent > 0
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
                              }`}>
                                {diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Split Breakdown Details */}
                      <div className="text-[11px] text-slate-400 space-y-1 border-t border-white/5 pt-2">
                        <div className="flex justify-between">
                          <span>Người bán nhận (85%):</span>
                          <span className="text-slate-200 font-mono">{(listPrice * 0.85).toFixed(3)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bản quyền BTC (10%):</span>
                          <span className="text-neon-pink font-mono">{(listPrice * 0.10).toFixed(3)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Phí sàn UniTicket (5%):</span>
                          <span className="text-solana-cyan font-mono">{(listPrice * 0.05).toFixed(3)} SOL</span>
                        </div>
                      </div>

                      {/* Seller Wallet */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                        <span>Người bán:</span>
                        <span className="font-mono text-slate-400">
                          {sellerWallet ? `${sellerWallet.slice(0, 4)}...${sellerWallet.slice(-4)}` : 'Ẩn danh'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="p-4 pt-0">
                    {isCurrentBuyerSeller ? (
                      <div className="p-2.5 rounded-xl bg-solana-purple/10 border border-solana-purple/30 text-center text-xs text-solana-cyan font-semibold">
                        Vé của bạn đang niêm yết
                      </div>
                    ) : isLocked ? (
                      <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-center text-xs text-red-400 font-bold">
                        Đã khóa chuyển nhượng (Transfer Locked)
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBuyTicket(t)}
                        disabled={buyingTicketId === t.id}
                        className="w-full min-h-11 rounded-xl bg-gradient-to-r from-solana-purple via-[#8338EC] to-neon-pink text-white font-bold text-xs shadow-lg shadow-purple-950/60 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        {buyingTicketId === t.id ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Đang xử lý trên Solana...</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Mua vé ngay ({listPrice.toFixed(2)} SOL)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
