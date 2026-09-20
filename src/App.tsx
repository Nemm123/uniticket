import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { WalletModal } from './components/common/WalletModal';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { ToastContainer } from './components/common/Toast';
import { HomePage } from './pages/Home';
import { CheckInPage } from './pages/CheckIn';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { OrganizerEvents } from './pages/OrganizerEvents';
import { AccessDenied } from './pages/AccessDenied';
import { RoleSelectionModal } from './components/common/RoleSelectionModal';
import { 
  ArrowLeft, 
  Ticket, 
  Compass, 
  PlusCircle, 
  ArrowUp, 
  Calendar, 
  MapPin, 
  Sparkles,
  Users,
  CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { EventItem, PurchasedTicket, TicketTier, ToastMessage, UserRole } from './types';
import { getStoredEvents, getStoredPurchasedTickets } from './utils/storage';
import { clearUserRole, getUserRole, setUserRole } from './utils/role';

const PAGE_PATHS = {
  home: '/',
  events: '/events',
  'my-tickets': '/my-tickets',
  'event-detail': '/event-detail',
  organizer: '/organizer',
  'organizer-events': '/organizer-events',
  'create-event': '/create-event',
  'check-in': '/check-in',
  'access-denied': '/access-denied',
} as const;

const ORGANIZER_PAGES = ['organizer', 'organizer-events', 'create-event', 'check-in'];

function getPageFromPathname(pathname: string): string | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return Object.entries(PAGE_PATHS).find(([, path]) => path === normalizedPath)?.[0] ?? null;
}

function getPathForPage(page: string, eventId?: string): string {
  const pathname = PAGE_PATHS[page as keyof typeof PAGE_PATHS] ?? PAGE_PATHS.home;
  if (page === 'event-detail' && eventId) {
    return `${pathname}?eventId=${encodeURIComponent(eventId)}`;
  }
  return pathname;
}

export function App() {
  const [currentPage, setCurrentPage] = useState<string>(() => getPageFromPathname(window.location.pathname) ?? 'home');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('eventId'));
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [events, setEvents] = useState<EventItem[]>(() => getStoredEvents());
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>(() => getStoredPurchasedTickets());
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutEvent, setCheckoutEvent] = useState<EventItem | null>(null);
  const [checkoutTier, setCheckoutTier] = useState<TicketTier | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ event: EventItem; tier: TicketTier } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(() => getUserRole());
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(false);

  // Lắng nghe cuộn trang để hiện nút Back to Top
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 350) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (walletAddress && !currentRole) {
      setIsRoleSelectionOpen(true);
    }
  }, [walletAddress, currentRole]);

  useEffect(() => {
    const syncPageFromLocation = () => {
      const pageFromLocation = getPageFromPathname(window.location.pathname);
      const nextPage = pageFromLocation ?? 'home';

      if (ORGANIZER_PAGES.includes(nextPage) && currentRole !== 'organizer') {
        setCurrentPage('access-denied');
        window.history.replaceState(null, '', PAGE_PATHS['access-denied']);
      } else {
        setCurrentPage(nextPage);
        setSelectedEventId(nextPage === 'event-detail' ? new URLSearchParams(window.location.search).get('eventId') : null);
        if (!pageFromLocation) {
          window.history.replaceState(null, '', PAGE_PATHS.home);
        }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    syncPageFromLocation();
    window.addEventListener('popstate', syncPageFromLocation);
    return () => window.removeEventListener('popstate', syncPageFromLocation);
  }, [currentRole]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (page: string, eventId?: string) => {
    if (ORGANIZER_PAGES.includes(page) && currentRole !== 'organizer') {
      setCurrentPage('access-denied');
      window.history.pushState(null, '', PAGE_PATHS['access-denied']);
      scrollToTop();
      return;
    }
    const nextPage = PAGE_PATHS[page as keyof typeof PAGE_PATHS] ? page : 'home';
    const nextPath = getPathForPage(nextPage, eventId);
    setCurrentPage(nextPage);
    if (eventId) {
      setSelectedEventId(eventId);
    }
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    scrollToTop();
  };

  // Cuộn mượt xuống section sự kiện trên trang chủ
  const handleScrollToEvents = () => {
    if (currentPage !== 'home') {
      handleNavigate('home');
      setTimeout(() => {
        const el = document.getElementById('featured-events-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById('featured-events-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const showToast = (type: ToastMessage['type'], message: string) => {
    setToasts((current) => [...current, { id: `${Date.now()}-${Math.random()}`, type, message }]);
  };

  const resetWalletSession = () => {
    const roleWasCleared = clearUserRole();
    setCurrentRole(null);
    setPendingPurchase(null);
    setIsCheckoutOpen(false);
    setCheckoutEvent(null);
    setCheckoutTier(null);
    setIsRoleSelectionOpen(false);

    if (ORGANIZER_PAGES.includes(currentPage)) {
      handleNavigate('home');
    }
    if (!roleWasCleared) {
      showToast('error', 'Kh\u00f4ng th\u1ec3 x\u00f3a role \u0111\u00e3 l\u01b0u tr\u00ean tr\u00ecnh duy\u1ec7t n\u00e0y.');
    }
  };

  const handleWalletChange = (address: string | null) => {
    const hasChangedWallet = Boolean(address && walletAddress && walletAddress !== address);
    setWalletAddress(address);
    if (!address) {
      resetWalletSession();
      return;
    }

    if (hasChangedWallet) {
      resetWalletSession();
      setIsRoleSelectionOpen(true);
      return;
    }

    if (!currentRole) {
      setIsRoleSelectionOpen(true);
      return;
    }
    if (address && pendingPurchase) {
      setCheckoutEvent(pendingPurchase.event);
      setCheckoutTier(pendingPurchase.tier);
      setPendingPurchase(null);
      setIsWalletModalOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  const handleCloseWalletModal = () => {
    setPendingPurchase(null);
    setIsWalletModalOpen(false);
  };

  const handleRoleContinue = (role: UserRole) => {
    if (!setUserRole(role)) {
      showToast('error', 'Không thể lưu role trên trình duyệt này.');
      return;
    }

    setCurrentRole(role);
    setIsRoleSelectionOpen(false);
    showToast('success', 'Role switched successfully');

    if (role === 'attendee' && ORGANIZER_PAGES.includes(currentPage)) {
      handleNavigate('home');
    }
    if (pendingPurchase) {
      setCheckoutEvent(pendingPurchase.event);
      setCheckoutTier(pendingPurchase.tier);
      setPendingPurchase(null);
      setIsCheckoutOpen(true);
      setIsWalletModalOpen(false);
    }
  };

  const handleCloseRoleSelection = () => {
    if (!currentRole) {
      setPendingPurchase(null);
    }
    setIsRoleSelectionOpen(false);
  };

  const handlePurchase = (event: EventItem, tier: TicketTier) => {
    if (tier.remainingQuantity <= 0) {
      showToast('error', 'Hạng vé này đã hết. Vui lòng chọn hạng vé khác.');
      return;
    }
    if (!walletAddress) {
      setPendingPurchase({ event, tier });
      setIsWalletModalOpen(true);
      return;
    }
    setCheckoutEvent(event);
    setCheckoutTier(tier);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = (tickets: PurchasedTicket[]) => {
    setPurchasedTickets(getStoredPurchasedTickets());
    setEvents(getStoredEvents());
    setIsCheckoutOpen(false);
    setCheckoutEvent(null);
    setCheckoutTier(null);
    showToast('success', `Mua thành công ${tickets.length} vé mô phỏng. Vé đã được lưu trên thiết bị.`);
    handleNavigate('my-tickets');
  };

  return (
    <div className="min-h-screen bg-[#070412] text-slate-100 flex flex-col selection:bg-solana-purple selection:text-white font-sans relative">
      {/* Thanh điều hướng toàn cục */}
      <Navbar
        currentPage={currentPage}
        onNavigate={(p) => handleNavigate(p)}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onOpenRoleSelection={() => setIsRoleSelectionOpen(true)}
        currentRole={currentRole}
        walletAddress={walletAddress}
      />

      {/* Nội dung trang động */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage 
            onNavigate={(page, id) => {
              if (page === 'events') {
                handleScrollToEvents();
              } else {
                handleNavigate(page, id);
              }
            }} 
          />
        )}

        {/* Trang Khám Phá Sự Kiện (Events) */}
        {currentPage === 'events' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <button
                  onClick={() => handleNavigate('home')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-3 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Quay lại Trang Chủ</span>
                </button>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
                  Tất Cả <span className="text-gradient-solana">Sự Kiện & Concert</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Khám phá các buổi hòa nhạc, lễ hội EDM và sự kiện công nghệ Web3 trên Solana.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-xs text-solana-cyan">
                <Compass className="w-4 h-4" />
                <span>Hiển thị {events.length} sự kiện</span>
              </div>
            </div>

            {/* Grid tất cả sự kiện */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => handleNavigate('event-detail', evt.id)}
                  className="rounded-2xl bg-[#110A2B]/90 border border-white/10 hover:border-solana-purple/50 p-4 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer shadow-xl group"
                >
                  <div className="relative h-48 rounded-xl overflow-hidden mb-4 bg-black/40">
                    <img
                      src={evt.thumbnailImage}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-semibold text-solana-cyan">
                      {evt.category}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs font-bold">
                      {evt.minPriceSol} SOL
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base font-bold text-white group-hover:text-solana-cyan transition-colors line-clamp-2 break-words">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-1 break-words">
                      {evt.subtitle}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 gap-2 min-w-0">
                    <span className="truncate min-w-0">{evt.date}</span>
                    <span className="text-solana-purple font-semibold group-hover:underline shrink-0">
                      Xem Chi Tiết →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trang Chi Tiết Sự Kiện (Event Detail Preview) */}
        {currentPage === 'event-detail' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn">
            <button
              onClick={() => handleNavigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Trang Chủ</span>
            </button>

            {/* Banner lớn */}
            <div className="rounded-2xl bg-[#120B30] border border-solana-purple/30 overflow-hidden shadow-2xl">
              <div className="relative h-64 sm:h-96">
                <img
                  src={selectedEvent.bannerImage}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#120B30] via-[#120B30]/50 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 space-y-2 min-w-0">
                  <span className="inline-block px-3 py-1 rounded-full bg-black/70 border border-solana-green/40 text-solana-green text-xs font-bold shrink-0">
                    {selectedEvent.category}
                  </span>
                  <h1 className="text-xl sm:text-4xl font-extrabold text-white break-words line-clamp-2 sm:line-clamp-none">
                    {selectedEvent.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-2xl break-words">
                    {selectedEvent.subtitle}
                  </p>
                </div>
              </div>

              {/* Thông tin thời gian & địa điểm */}
              <div className="p-5 sm:p-8 space-y-8 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-xl bg-[#1A1040]/80 border border-white/10 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-solana-purple/20 text-solana-purple shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-400">Thời gian</div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate block">{selectedEvent.date}</div>
                      <div className="text-[11px] text-slate-300 truncate block">{selectedEvent.time}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-neon-pink/20 text-neon-pink shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-400">Địa điểm</div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate block">{selectedEvent.venue}</div>
                      <div className="text-[11px] text-slate-300 truncate block">{selectedEvent.city}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-solana-green/20 text-solana-green shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-slate-400">Ban tổ chức</div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate block">{selectedEvent.organizer.name}</div>
                      <div className="text-[11px] text-solana-green truncate block">Đã xác minh Web3 ✓</div>
                    </div>
                  </div>
                </div>

                {/* Mô tả sự kiện */}
                <div className="space-y-3 min-w-0">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-solana-cyan shrink-0" />
                    <span>Giới Thiệu Sự Kiện</span>
                  </h3>
                  <p className="text-slate-300 leading-relaxed text-sm sm:text-base text-wrap-safe break-words">
                    {selectedEvent.description}
                  </p>
                </div>

                {/* Nghệ sĩ Line-up */}
                {selectedEvent.lineup && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white">Nghệ Sĩ Biểu Diễn (Line-up)</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.lineup.map((artist, i) => (
                        <span
                          key={i}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1C1242] border border-solana-purple/30 text-xs font-semibold text-slate-200"
                        >
                          🎵 {artist}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bảng chọn hạng vé (Ticket Tiers Preview) */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-xl font-bold text-white">Các Hạng Vé NFT Khả Dụng</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedEvent.tiers?.map((tier) => (
                      <div
                        key={tier.id}
                        className="p-5 rounded-2xl bg-[#170E38] border border-white/10 hover:border-solana-purple/50 flex flex-col justify-between space-y-4 transition-all min-w-0"
                      >
                        <div className="min-w-0">
                          <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                            <span className="text-sm font-bold text-white break-words min-w-0 flex-1">{tier.name}</span>
                            <span className="text-xs text-solana-green font-bold px-2 py-0.5 rounded bg-solana-green/10 shrink-0">
                              {tier.remainingQuantity} vé
                            </span>
                          </div>
                          <div className="text-2xl font-black text-solana-cyan mb-2">
                            {tier.priceSol} SOL
                          </div>
                          <p className="text-xs text-slate-300 mb-3 break-words">{tier.description}</p>
                          <ul className="space-y-1.5 text-xs text-slate-300 min-w-0">
                            {tier.perks.map((p, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 min-w-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
                                <span className="break-words min-w-0 flex-1">{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          onClick={() => handlePurchase(selectedEvent, tier)}
                          disabled={tier.remainingQuantity <= 0}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-white font-bold text-xs shadow-md hover:shadow-solana-purple/50 transition-all active:scale-95 shrink-0"
                        >
                          {tier.remainingQuantity <= 0 ? 'HẾT VÉ' : 'Chọn Mua Vé Hạng Này'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trang Vé Của Tôi */}
        {currentPage === 'my-tickets' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="min-w-0">
                <button
                  onClick={() => handleNavigate('home')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Quay lại Trang Chủ</span>
                </button>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white break-words">
                  Ví Vé NFT <span className="text-gradient-neon">Của Tôi</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 break-words">
                  Mỗi vé là một tài sản số NFT độc bản trên mạng Solana Metaplex.
                </p>
              </div>

              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-solana-purple/20 border border-solana-purple/40 text-xs font-semibold text-solana-cyan hover:bg-solana-purple/30 transition-colors shrink-0"
              >
                {walletAddress ? `Connected: ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Disconnected'}
              </button>
            </div>

            {purchasedTickets.length === 0 ? (
              <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#120B30] p-8 text-center shadow-2xl">
                <Ticket className="mx-auto mb-3 h-10 w-10 text-solana-cyan" />
                <h2 className="text-xl font-bold text-white">Bạn chưa có vé nào</h2>
                <p className="mt-2 text-sm text-slate-300">Khám phá sự kiện và tạo vé mô phỏng đầu tiên của bạn.</p>
                <button
                  onClick={() => handleNavigate('events')}
                  className="mt-5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white"
                >
                  Khám phá sự kiện
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {purchasedTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-xl">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="min-w-0">
                        <h2 className="break-words text-base font-bold text-white">{ticket.eventTitle}</h2>
                        <p className="mt-1 text-xs text-solana-cyan">{ticket.tierName}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-solana-green/40 bg-solana-green/15 px-2 py-1 text-[10px] font-bold text-solana-green">
                        {ticket.status === 'valid' || ticket.status === 'VALID' ? 'VALID' : ticket.status}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="space-y-2 text-xs text-slate-300">
                        <p><span className="text-slate-500">Mã vé:</span> <span className="font-mono text-white">{ticket.ticketCode}</span></p>
                        <p><span className="text-slate-500">Ví:</span> {ticket.customerWallet.slice(0, 4)}...{ticket.customerWallet.slice(-4)}</p>
                        <p><span className="text-slate-500">Ngày mua:</span> {new Date(ticket.purchaseDate || ticket.purchasedAt).toLocaleString('vi-VN')}</p>
                        <p><span className="text-slate-500">Địa điểm:</span> {ticket.venue}, {ticket.city}</p>
                      </div>
                      <div className="flex w-fit flex-col items-center rounded-xl bg-white p-2 text-black">
                        <QRCodeSVG value={ticket.qrPayload} size={112} level="M" />
                        <span className="mt-1 text-[9px] font-mono font-bold">QR MÔ PHỎNG</span>
                      </div>
                    </div>
                    <p className="mt-4 border-t border-dashed border-white/10 pt-3 text-[11px] text-slate-400">
                      Order: {ticket.orderId} · QR này chỉ là dữ liệu mô phỏng, chưa có cơ chế chống gian lận blockchain.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentPage === 'check-in' && (
          <CheckInPage onShowToast={showToast} />
        )}

        {currentPage === 'organizer' && (
          <OrganizerDashboard events={events} tickets={purchasedTickets} onNavigate={handleNavigate} />
        )}

        {currentPage === 'organizer-events' && (
          <OrganizerEvents events={events} onNavigate={handleNavigate} />
        )}

        {currentPage === 'access-denied' && (
          <AccessDenied
            currentRole={currentRole}
            onSwitchRole={() => setIsRoleSelectionOpen(true)}
            onNavigate={handleNavigate}
          />
        )}

        {/* Trang Tạo Sự Kiện (Create Event Preview) */}
        {currentPage === 'create-event' && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-6 animate-fadeIn">
            <button
              onClick={() => handleNavigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Trang Chủ</span>
            </button>

            <div className="rounded-2xl bg-[#120B30] border border-solana-purple/30 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="p-3 rounded-xl bg-solana-green/20 text-solana-green">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                    Tạo Sự Kiện Mới & Phát Hành Vé NFT
                  </h1>
                  <p className="text-xs text-slate-300">
                    Dành cho Ban tổ chức concert & lễ hội âm nhạc Web3
                  </p>
                </div>
              </div>

              {/* Form Xem Trước */}
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Tên Sự Kiện / Hòa Nhạc *
                  </label>
                  <input
                    type="text"
                    disabled
                    placeholder="VD: Neon Cyber Live Concert 2026"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-slate-400 text-xs cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      Thể Loại *
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="EDM Festival"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-slate-400 text-xs cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      Giá Vé Khởi Điểm (SOL) *
                    </label>
                    <input
                      type="text"
                      disabled
                      placeholder="0.85 SOL"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-slate-400 text-xs cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/40 border border-solana-purple/30 text-xs text-purple-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-solana-cyan shrink-0 mt-0.5" />
                  <span>
                    Form tạo sự kiện đầy đủ kèm tính năng mint Smart Contract trên Solana sẽ hoàn thiện ở các giai đoạn tiếp theo.
                  </span>
                </div>

                <button
                  onClick={() => alert('Chức năng Tạo Sự Kiện sẽ sẵn sàng sau khi hoàn tất các giao diện phụ!')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-white font-bold text-xs sm:text-sm shadow-lg hover:shadow-solana-purple/50 transition-all active:scale-95"
                >
                  Gửi Thông Tin Duyệt Sự Kiện (Bản Thử Nghiệm)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Chân trang toàn cục */}
      <Footer onNavigate={(p) => handleNavigate(p)} />

      {/* Modal Connect Wallet */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={handleCloseWalletModal}
        onWalletChange={handleWalletChange}
        onConnectionCancelled={() => setPendingPurchase(null)}
      />

      <RoleSelectionModal
        isOpen={isRoleSelectionOpen}
        currentRole={currentRole}
        onClose={handleCloseRoleSelection}
        onContinue={handleRoleContinue}
      />

      {checkoutEvent && checkoutTier && walletAddress && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          event={checkoutEvent}
          tier={checkoutTier}
          quantity={1}
          walletAddress={walletAddress}
          onSuccess={handleCheckoutSuccess}
          onError={(message) => showToast('error', message)}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onClose={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />

      {/* Nút Back to Top nổi ở góc phải dưới */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Cuộn lên đầu trang"
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-xl shadow-purple-950/60 hover:scale-110 active:scale-95 transition-all animate-bounce duration-300"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default App;
