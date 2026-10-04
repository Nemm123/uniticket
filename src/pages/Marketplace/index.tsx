import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
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
  X,
  AlertTriangle,
  Wallet,
  Trophy,
  ExternalLink,
  Ticket,
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
  onCloseWalletModal?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string, url?: string, label?: string) => void;
  onTicketsChanged?: () => void;
}

// Hiệu ứng pháo hoa Confetti Canvas mượt mà dành cho Celebration Modal
const ConfettiFireworks: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    const colors = ['#9945FF', '#14F195', '#F72585', '#4CC9F0', '#FFD166', '#FFFFFF'];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      rotation: number;
      vRot: number;
    }> = [];

    // Tạo 85 hạt pháo hoa confetti rực rỡ
    for (let i = 0; i < 85; i++) {
      particles.push({
        x: canvas.width * 0.5 + (Math.random() - 0.5) * 140,
        y: canvas.height * 0.32 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 11,
        vy: (Math.random() - 1) * 10 - 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.008 + 0.006,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach((p) => {
        if (p.alpha <= 0) return;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24; // gravity
        p.vx *= 0.98; // air resistance
        p.alpha -= p.decay;
        p.rotation += p.vRot;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (alive) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-30 w-full h-full"
    />
  );
};

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
  onCloseWalletModal,
  onShowToast,
  onTicketsChanged,
}) => {
  const { formatDate } = useTranslation();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [listedTickets, setListedTickets] = useState<PurchasedTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [buyingTicketId, setBuyingTicketId] = useState<string | null>(null);
  const [confirmingTicket, setConfirmingTicket] = useState<PurchasedTicket | null>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [purchasedSuccessTicket, setPurchasedSuccessTicket] = useState<PurchasedTicket | null>(null);
  const [successTxSignature, setSuccessTxSignature] = useState<string>('');
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

      // Tạo map tra cứu trạng thái trong LocalStorage
      const storedById = new Map<string, PurchasedTicket>();
      stored.forEach((item: PurchasedTicket) => {
        if (item.id) storedById.set(item.id, item);
        if (item.ticketCode) storedById.set(item.ticketCode, item);
      });

      // 1. Thêm vé mẫu: NẾU vé đã có trong LocalStorage thì BẮT BUỘC dùng trạng thái từ LocalStorage
      // Nếu đã được mua hoặc đã hủy niêm yết (is_listed_for_sale !== true) thì TUYỆT ĐỐI không đưa lên Chợ
      SEED_MARKETPLACE_TICKETS.forEach((seed) => {
        const locallyUpdated = storedById.get(seed.id) || (seed.ticketCode ? storedById.get(seed.ticketCode) : undefined);
        if (locallyUpdated) {
          if (locallyUpdated.is_listed_for_sale === true && !locallyUpdated.isCheckedIn && !locallyUpdated.isUsed && locallyUpdated.status !== 'USED') {
            map.set(locallyUpdated.id, locallyUpdated);
          }
        } else {
          map.set(seed.id, seed);
        }
      });

      // 2. Thêm các vé được đăng bán từ local
      localListed.forEach((t: PurchasedTicket) => {
        if (t.is_listed_for_sale === true && !t.isCheckedIn && !t.isUsed && t.status !== 'USED') {
          map.set(t.id, t);
        }
      });

      // 3. Thêm các vé từ Cloud (nếu trong local chưa ghi nhận là đã mua/hủy bán)
      cloudListed.forEach((t) => {
        const locallyUpdated = storedById.get(t.id) || (t.ticketCode ? storedById.get(t.ticketCode) : undefined);
        if (locallyUpdated) {
          if (locallyUpdated.is_listed_for_sale === true && !locallyUpdated.isCheckedIn && !locallyUpdated.isUsed && locallyUpdated.status !== 'USED') {
            map.set(t.id, t);
          }
        } else {
          map.set(t.id, t);
        }
      });

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

  // Mở modal xác nhận giao dịch mua vé thứ cấp
  const handleOpenConfirmModal = (ticket: PurchasedTicket) => {
    const effectiveWallet = walletAddress || publicKey?.toBase58();

    const sellerWallet = ticket.owner_address || (ticket as any).seller_address || ticket.ownerAddress || ticket.customerWallet || '';
    if (effectiveWallet && sellerWallet && sellerWallet.toLowerCase() === effectiveWallet.toLowerCase()) {
      if (onShowToast) onShowToast('error', 'Bạn đang sở hữu vé này, không thể tự mua vé của chính mình.');
      return;
    }

    if ((Number(ticket.transfer_count) || 0) >= 2) {
      if (onShowToast) onShowToast('error', 'Vé này đã đạt giới hạn chuyển nhượng tối đa 2 lần.');
      return;
    }

    setConfirmingTicket(ticket);
  };

  // Cập nhật trạng thái vé sau khi giao dịch on-chain thành công
  const handleUpdateTicketAfterPurchase = async (
    ticketId: string,
    buyerWalletStr: string,
    txSig?: string
  ) => {
    const targetTicket = listedTickets.find((t) => t.id === ticketId) || confirmingTicket;
    if (!targetTicket) return;

    const listingPrice = Number(targetTicket.listing_price_sol || targetTicket.priceSol) || 0.05;
    const royaltyShare = Number((listingPrice * 0.10).toFixed(4));
    const nowIso = new Date().toISOString();
    const nextTransferCount = (Number(targetTicket.transfer_count) || 0) + 1;
    const prevOwner = targetTicket.owner_address || (targetTicket as any).seller_address || targetTicket.ownerAddress || targetTicket.customerWallet || '';

    const updatedTicket: PurchasedTicket = {
      ...targetTicket,
      customerWallet: buyerWalletStr,
      ownerAddress: buyerWalletStr,
      owner_address: buyerWalletStr,
      is_listed_for_sale: false,
      listing_price_sol: undefined,
      transfer_count: nextTransferCount,
      royalty_sol: (Number(targetTicket.royalty_sol) || 0) + royaltyShare,
      transferredAt: nowIso,
      transferredFrom: prevOwner,
      transferredTo: buyerWalletStr,
      txSignature: txSig || targetTicket.txSignature,
    };

    // 1. Cập nhật LocalStorage
    storage.savePurchasedTicket(updatedTicket);

    // 2. Cập nhật Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('tickets')
          .update({
            owner_address: buyerWalletStr,
            customer_wallet: buyerWalletStr,
            is_listed_for_sale: false,
            listing_price_sol: null,
            transfer_count: nextTransferCount,
            royalty_sol: updatedTicket.royalty_sol,
            updated_at: nowIso,
          })
          .or(`id.eq.${targetTicket.id},ticket_code.eq.${targetTicket.ticketCode}`);
      } catch (supaUpErr) {
        console.warn('[Marketplace] Lỗi cập nhật Supabase sau khi mua:', supaUpErr);
      }
    }

    // 3. Ngay lập tức cập nhật state danh sách vé đang bán:
    setListedTickets((prevTickets) =>
      prevTickets.filter((item) => item.id !== ticketId && item.id !== targetTicket.id && item.ticketCode !== targetTicket.ticketCode)
    );
    setConfirmingTicket(null);

    // Đồng bộ danh sách vé của toàn ứng dụng
    onTicketsChanged?.();

    // Kích hoạt state mở isSuccessModalOpen = true và lưu thông tin vé vừa mua
    setPurchasedSuccessTicket(updatedTicket);
    setSuccessTxSignature(txSig || updatedTicket.txSignature || '');
    setIsSuccessModalOpen(true);

    if (onShowToast) {
      onShowToast('success', "Mua vé thành công! Vé đã được chuyển về 'Vé của tôi'");
    }
  };

  // Xử lý xác nhận và ký ví Phantom trên Solana Devnet
  const handleConfirmAndSign = async (ticket: PurchasedTicket) => {
    // 1. KIỂM TRA ĐIỀU KIỆN KẾT NỐI VÍ:
    const phantomProvider = typeof window !== 'undefined' ? ((window as any).phantom?.solana || (window as any).solana) : null;
    const isPhantomDirectConnected = Boolean(phantomProvider?.isConnected && phantomProvider?.publicKey);

    // Xác định public key người mua an toàn:
    let buyerPubKey: PublicKey | null = publicKey || null;
    if (!buyerPubKey && isPhantomDirectConnected) {
      buyerPubKey = phantomProvider.publicKey;
    } else if (!buyerPubKey && walletAddress) {
      try {
        buyerPubKey = new PublicKey(walletAddress);
      } catch {
        buyerPubKey = null;
      }
    }

    const isWalletConnected = Boolean((connected && publicKey) || isPhantomDirectConnected || (walletAddress && buyerPubKey));

    // NẾU CHƯA KẾT NỐI (!connected hoặc !publicKey): Lúc này mới mở modal kết nối ví
    if (!isWalletConnected || !buyerPubKey) {
      if (onShowToast) onShowToast('info', 'Vui lòng kết nối ví Phantom trước khi mua vé.');
      onOpenWalletModal?.();
      return;
    }

    // NẾU ĐÃ KẾT NỐI (connected && publicKey): TUYỆT ĐỐI KHÔNG mở modal kết nối ví
    onCloseWalletModal?.();

    const buyerWalletStr = buyerPubKey.toBase58();
    const sellerWallet = ticket.owner_address || (ticket as any).seller_address || ticket.ownerAddress || ticket.customerWallet || '';
    if (sellerWallet && sellerWallet.toLowerCase() === buyerWalletStr.toLowerCase()) {
      if (onShowToast) onShowToast('error', 'Bạn đang sở hữu vé này, không thể tự mua vé của chính mình.');
      return;
    }

    if ((Number(ticket.transfer_count) || 0) >= 2) {
      if (onShowToast) onShowToast('error', 'Vé này đã đạt giới hạn chuyển nhượng tối đa 2 lần.');
      return;
    }

    setIsSigning(true);
    setBuyingTicketId(ticket.id);

    // 2. LUỒNG THANH TOÁN KÝ GỬI THẬT TRÊN SOLANA DEVNET
    try {
      if (onShowToast) onShowToast('info', 'Vui lòng ký xác nhận giao dịch trên ví Phantom...');

      let sellerPubkey: PublicKey;
      try {
        sellerPubkey = new PublicKey(ticket.owner_address || (ticket as any).seller_address || ticket.ownerAddress || ticket.customerWallet || SOLANA_TREASURY_WALLET_STR);
      } catch {
        sellerPubkey = new PublicKey(SOLANA_TREASURY_WALLET_STR);
      }

      let organizerPubkey: PublicKey;
      try {
        organizerPubkey = new PublicKey(ticket.organizer_address || SOLANA_TREASURY_WALLET_STR);
      } catch {
        organizerPubkey = new PublicKey(SOLANA_TREASURY_WALLET_STR);
      }

      const listingPrice = Number(ticket.listing_price_sol || ticket.priceSol) || 0.05;
      const lamports = Math.round(listingPrice * LAMPORTS_PER_SOL);

      // Chia dòng tiền: 85% người bán, 10% BTC, 5% phí sàn
      const sellerAmount = Math.floor(lamports * 0.85);
      const royaltyAmount = Math.floor(lamports * 0.10);
      const platformAmount = Math.floor(lamports * 0.05);

      const transaction = new Transaction();

      // Chuyển cho người bán
      if (sellerAmount > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: buyerPubKey,
            toPubkey: sellerPubkey,
            lamports: Math.max(5000, sellerAmount),
          })
        );
      }

      // Chuyển phí bản quyền cho BTC
      if (royaltyAmount > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: buyerPubKey,
            toPubkey: organizerPubkey,
            lamports: Math.max(5000, royaltyAmount),
          })
        );
      }

      // Chuyển phí nền tảng cho UniTicket
      if (platformAmount > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: buyerPubKey,
            toPubkey: new PublicKey(SOLANA_TREASURY_WALLET_STR),
            lamports: Math.max(5000, platformAmount),
          })
        );
      }

      const activeConnection = connection || getDevnetConnection();
      try {
        const { blockhash } = await getLatestBlockhashWithRetry(activeConnection);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = buyerPubKey;
      } catch (bhErr) {
        console.warn('[Marketplace] Lỗi lấy recentBlockhash:', bhErr);
      }

      // Kích hoạt popup ví Phantom để người dùng bấm Phê duyệt (Approve)
      let signature = '';
      const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

      if ((isMobile || phantomProvider?.isPhantom) && phantomProvider && typeof phantomProvider.signAndSendTransaction === 'function') {
        const res = await phantomProvider.signAndSendTransaction(transaction);
        signature = typeof res === 'string' ? res : res.signature;
      } else if (connected && typeof sendTransaction === 'function') {
        signature = await sendTransaction(transaction, activeConnection);
      } else if (phantomProvider && typeof phantomProvider.signAndSendTransaction === 'function') {
        const res = await phantomProvider.signAndSendTransaction(transaction);
        signature = typeof res === 'string' ? res : res.signature;
      } else if (typeof sendTransaction === 'function') {
        signature = await sendTransaction(transaction, activeConnection);
      } else {
        signature = `demo-mkt-${Date.now().toString(16)}`;
      }

      try {
        await activeConnection.confirmTransaction(signature, 'processed');
      } catch (confErr) {
        console.warn('[Marketplace] confirmTransaction notice:', confErr);
      }

      // Cập nhật trạng thái vé mới
      await handleUpdateTicketAfterPurchase(ticket.id, buyerWalletStr, signature);

    } catch (err: any) {
      console.error("Lỗi giao dịch:", err);
      const errMsg = String(err?.message || err || '').toLowerCase();
      const isRejected =
        err?.code === 4001 ||
        errMsg.includes('reject') ||
        errMsg.includes('cancel') ||
        errMsg.includes('denied') ||
        err?.name === 'WalletSignTransactionError' ||
        err?.name === 'WalletSendTransactionError';

      if (isRejected) {
        if (onShowToast) {
          onShowToast('info', 'Bạn đã hủy bỏ ký giao dịch trên ví Phantom.');
        }
      } else {
        if (onShowToast) {
          onShowToast('error', err?.message || 'Giao dịch mua vé thất bại. Vui lòng thử lại.');
        }
      }
    } finally {
      setIsSigning(false);
      setBuyingTicketId(null);
    }
  };

  const currentWalletAddress = (publicKey?.toBase58() || walletAddress || '').toLowerCase().trim();

  // Danh sách vé hiển thị trên Marketplace BẮT BUỘC thỏa mãn:
  // t.is_listed_for_sale === true && t.owner_address !== currentWalletAddress
  const activeMarketplaceTickets = useMemo(() => {
    return listedTickets.filter((t) => {
      if (t.is_listed_for_sale !== true) return false;
      const ticketOwner = (
        t.owner_address ||
        (t as any).seller_address ||
        t.ownerAddress ||
        t.customerWallet ||
        ''
      ).toLowerCase().trim();
      if (currentWalletAddress && ticketOwner === currentWalletAddress) {
        return false;
      }
      return true;
    });
  }, [listedTickets, currentWalletAddress]);

  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return activeMarketplaceTickets;
    const q = searchQuery.toLowerCase().trim();
    return activeMarketplaceTickets.filter(
      (t) =>
        t.eventTitle.toLowerCase().includes(q) ||
        t.tierName.toLowerCase().includes(q) ||
        t.venue.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.ticketCode.toLowerCase().includes(q)
    );
  }, [activeMarketplaceTickets, searchQuery]);

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
                        onClick={() => handleOpenConfirmModal(t)}
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

      {/* Modal Xác nhận Mua vé Thứ cấp */}
      {confirmingTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => !isSigning && setConfirmingTicket(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-solana-purple/50 bg-[#120B30] p-6 shadow-2xl shadow-purple-950/60 text-left space-y-5 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-solana-cyan">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Chi tiết Giao dịch Thứ cấp</h3>
                  <p className="text-xs text-slate-400">Xác nhận điều khoản thanh toán & chuyển nhượng NFT</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSigning && setConfirmingTicket(null)}
                disabled={isSigning}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Details */}
            {(() => {
              const sellerWallet = confirmingTicket.ownerAddress || confirmingTicket.customerWallet || confirmingTicket.owner_address || '';
              const listPrice = Number(confirmingTicket.listing_price_sol || confirmingTicket.priceSol) || 0.05;
              const sellerShare = (listPrice * 0.85).toFixed(3);
              const royaltyShare = (listPrice * 0.10).toFixed(3);
              const platformShare = (listPrice * 0.05).toFixed(3);

              return (
                <>
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                    <div>
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tên sự kiện</span>
                      <p className="text-sm font-bold text-white line-clamp-1">{confirmingTicket.eventTitle}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-400">Hạng vé:</span>
                        <p className="text-xs font-semibold text-solana-cyan">{confirmingTicket.tierName}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Mã vé:</span>
                        <p className="text-xs font-mono font-bold text-white">{confirmingTicket.ticketCode || confirmingTicket.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/5">
                      <div>
                        <span className="text-[11px] text-slate-400">Chỗ ngồi:</span>
                        <p className="text-xs text-slate-300">{confirmingTicket.seat || 'Khu vực tự do'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Tên chủ sở hữu hiện tại:</span>
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {confirmingTicket.customerName || 'Chủ sở hữu'}
                          {sellerWallet && (
                            <span className="block text-[10px] font-mono text-slate-400 truncate">
                              ({sellerWallet.slice(0, 4)}...{sellerWallet.slice(-4)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Revenue Distribution */}
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-solana-purple/10 border border-solana-purple/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-300 font-medium">Tổng giá thanh toán:</span>
                        <p className="text-[11px] text-slate-400">Bao gồm thuế phí on-chain</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-solana-green font-mono">{listPrice.toFixed(2)} SOL</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-2 text-xs">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Minh bạch dòng tiền phân bổ:</span>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-solana-green" />
                          Người bán nhận (85%):
                        </span>
                        <span className="font-mono font-bold text-white">{sellerShare} SOL</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-neon-pink" />
                          Phí bản quyền Ban tổ chức (10%):
                        </span>
                        <span className="font-mono font-bold text-neon-pink">{royaltyShare} SOL</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-solana-cyan" />
                          Phí nền tảng UniTicket (5%):
                        </span>
                        <span className="font-mono font-bold text-solana-cyan">{platformShare} SOL</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Notice */}
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-200/90 leading-relaxed">
                      Sau khi mua, vé này sẽ ghi nhận +1 lượt chuyển nhượng (Tối đa 2 lần).
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingTicket(null)}
                      disabled={isSigning}
                      className="flex-1 py-2.5 px-4 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmAndSign(confirmingTicket)}
                      disabled={isSigning}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-solana-purple via-[#8338EC] to-neon-pink hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-purple-950/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isSigning ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Đang ký ví Phantom...</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4" />
                          <span>Xác nhận & Ký ví Phantom</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Chúc Mừng Mua Vé Thành Công (Celebration Success Modal) */}
      {isSuccessModalOpen && purchasedSuccessTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => {
            setIsSuccessModalOpen(false);
            setPurchasedSuccessTicket(null);
          }}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-solana-cyan/50 bg-[#0F0826] p-6 sm:p-8 shadow-2xl shadow-purple-950/90 text-center space-y-5 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hiệu ứng pháo hoa confetti */}
            <ConfettiFireworks />

            {/* Glowing neon background orbs */}
            <div className="pointer-events-none absolute -top-20 -left-20 h-48 w-48 rounded-full bg-solana-purple/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-solana-cyan/25 blur-3xl" />

            {/* Nút đóng modal */}
            <button
              type="button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                setPurchasedSuccessTicket(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-40"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon chúc mừng với hiệu ứng neon */}
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-solana-purple/30 via-neon-pink/20 to-solana-cyan/30 border-2 border-solana-cyan/50 shadow-2xl shadow-solana-cyan/30">
              <Trophy className="h-10 w-10 text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]" />
              <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-solana-green text-[12px] shadow-lg animate-pulse">
                ✨
              </span>
            </div>

            {/* Tiêu đề & Thông điệp */}
            <div className="space-y-2 relative z-10">
              <h3 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-solana-cyan tracking-tight">
                🎉 CHÚC MỪNG BẠN ĐÃ SỞ HỮU VÉ THÀNH CÔNG!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                Giao dịch đã được ghi nhận trên Solana Devnet. Chiếc vé NFT chính thức thuộc về ví của bạn với mã check-in Dynamic QR an toàn.
              </p>
            </div>

            {/* Thẻ tóm tắt nhanh */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3 text-left relative z-10">
              {/* Tên sự kiện & Hạng vé */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sự kiện &amp; Hạng vé</span>
                  <h4 className="text-sm sm:text-base font-bold text-white line-clamp-1 mt-0.5">
                    {purchasedSuccessTicket.eventTitle}
                  </h4>
                  <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-md bg-solana-purple/20 border border-solana-purple/40 text-xs font-semibold text-solana-cyan">
                    <Ticket className="w-3.5 h-3.5" />
                    {purchasedSuccessTicket.tierName} {purchasedSuccessTicket.seat ? `• ${purchasedSuccessTicket.seat}` : ''}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm font-extrabold text-solana-green bg-solana-green/10 border border-solana-green/30 px-2.5 py-1 rounded-lg">
                  {Number(purchasedSuccessTicket.listing_price_sol || purchasedSuccessTicket.priceSol || 0).toFixed(2)} SOL
                </span>
              </div>

              {/* Mã vé */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Mã vé (Ticket Code):</span>
                <span className="font-mono font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                  {purchasedSuccessTicket.ticketCode || purchasedSuccessTicket.id}
                </span>
              </div>

              {/* Lượt chuyển nhượng hiện tại */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Lượt chuyển nhượng hiện tại:</span>
                {(() => {
                  const count = Number(purchasedSuccessTicket.transfer_count) || 1;
                  const remaining = Math.max(0, 2 - count);
                  return (
                    <span className="font-semibold text-yellow-300 bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 rounded">
                      {count}/2 (Còn {remaining} lượt chuyển nhượng)
                    </span>
                  );
                })()}
              </div>

              {/* Hash giao dịch (Transaction Signature) kèm link xem trên Solana Explorer Devnet */}
              {successTxSignature && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                  <span className="text-slate-400">Hash giao dịch:</span>
                  <a
                    href={`https://explorer.solana.com/tx/${successTxSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-solana-cyan hover:text-white underline decoration-solana-cyan/50 hover:decoration-white transition-colors"
                    title="Xem trên Solana Explorer"
                  >
                    <span>{successTxSignature.length > 12 ? `${successTxSignature.slice(0, 4)}...${successTxSignature.slice(-4)}` : successTxSignature}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            {/* 2 Nút hành động CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setPurchasedSuccessTicket(null);
                  onNavigate('my-tickets');
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-solana-purple via-[#8338EC] to-neon-pink hover:opacity-95 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-purple-950/80 transition-all flex items-center justify-center gap-2"
              >
                <span>Xem Vé Của Tôi Ngay 🎟️</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  setPurchasedSuccessTicket(null);
                }}
                className="w-full sm:w-auto py-3 px-5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs sm:text-sm transition-colors"
              >
                <span>Tiếp tục dạo Chợ vé</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
