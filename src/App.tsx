import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { WalletModal, getPhantomProvider, safeConnectPhantom, logPhantomDebug, extractWalletErrorMessage } from './components/common/WalletModal';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { ToastContainer } from './components/common/Toast';
import { HomePage } from './pages/Home';
import { EventsPage } from './pages/Events';
import { EventDetailPage } from './pages/EventDetail';
import { CheckInPage } from './pages/CheckIn';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { OrganizerEvents } from './pages/OrganizerEvents';
import { AccessDenied } from './pages/AccessDenied';
import { MyTicketsPage } from './pages/MyTickets';
import { MarketplacePage } from './pages/Marketplace';
import { SearchModal } from './components/common/SearchModal';
import { ArrowUp } from 'lucide-react';
import { VerifyTicketPage } from './pages/VerifyTicket';
import { DynamicQRModal } from './components/tickets/DynamicQRModal';
import { TransferTicketModal } from './components/tickets/TransferTicketModal';
import { EventItem, PurchasedTicket, TicketTier, ToastMessage, UserRole } from './types';
import { getStoredEvents, getStoredPurchasedTickets, saveStoredEvents, savePurchasedTickets } from './utils/storage';
import { useWallet } from '@solana/wallet-adapter-react';
import { getEvent as getEventFromApi, isApiEventId } from './services/eventsApi';

import * as api from './services/api';
import { mockEvents } from './data/mockEvents';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { clearWalletSession, getWalletSession, setWalletSession, WalletSession } from './services/authSession';
import { logoutWalletSession } from './services/authApi';
import { getWalletSolBalance, SOLANA_TREASURY_WALLET_STR } from './services/solanaClient';
import { clearUserRole, getUserRole, setUserRole } from './utils/role';
import { ViewMode, getStoredViewMode, saveStoredViewMode } from './utils/viewMode';
import { useTranslation } from './i18n';

const PAGE_PATHS = {
  home: '/',
  events: '/events',
  marketplace: '/marketplace',
  'my-tickets': '/my-tickets',
  'event-detail': '/event-detail',
  verify: '/verify',
  organizer: '/organizer',
  'organizer-events': '/organizer-events',
  'create-event': '/create-event',
  'check-in': '/check-in',
  'access-denied': '/access-denied',
} as const;

const ORGANIZER_PAGES = ['organizer', 'organizer-events', 'create-event', 'check-in'];

function getPageFromPathname(pathname: string): string | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalizedPath === '/verify' || normalizedPath.startsWith('/verify/')) {
    return 'verify';
  }
  return Object.entries(PAGE_PATHS).find(([, path]) => path === normalizedPath)?.[0] ?? null;
}

function getTicketIdFromPathname(pathname: string): string | null {
  if (pathname.startsWith('/verify/')) {
    const raw = pathname.slice('/verify/'.length).trim();
    return raw ? decodeURIComponent(raw) : null;
  }
  return null;
}

function getPathForPage(page: string, id?: string): string {
  const pathname = PAGE_PATHS[page as keyof typeof PAGE_PATHS] ?? PAGE_PATHS.home;
  if (page === 'event-detail' && id) {
    return `${pathname}?eventId=${encodeURIComponent(id)}`;
  }
  if (page === 'verify' && id) {
    return `/verify/${encodeURIComponent(id)}`;
  }
  return pathname;
}

export function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<string>(() => getPageFromPathname(window.location.pathname) ?? 'home');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('eventId'));
  const [selectedVerifyTicketId, setSelectedVerifyTicketId] = useState<string | null>(() => {
    return getTicketIdFromPathname(window.location.pathname) || new URLSearchParams(window.location.search).get('ticketId') || new URLSearchParams(window.location.search).get('id');
  });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [events, setEvents] = useState<EventItem[]>(() => getStoredEvents());
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedApiEvent, setSelectedApiEvent] = useState<EventItem | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<UserRole | null>(null);

  const refreshSolBalance = useCallback(async (address: string) => {
    try {
      const balance = await getWalletSolBalance(address);
      setSolBalance(balance);
    } catch (err) {
      console.warn('Failed to query SOL balance:', err);
      setSolBalance(null);
    }
  }, []);

  // Sử dụng useWallet() từ @solana/wallet-adapter-react làm nguồn định danh Web3
  const { publicKey, connected, disconnect: walletDisconnect, select, wallets, connect: adapterConnect } = useWallet();
  const isDisconnectingRef = useRef<boolean>(false);

  // Đồng bộ trạng thái ví từ Solana Wallet Adapter:
  // - Chưa connect: ở trạng thái khách bình thường, KHÔNG bắn popup lỗi "Không thể kết nối máy chủ xác thực"
  // - Đã connect: lấy publicKey làm định danh tài khoản Web3
  useEffect(() => {
    if (isDisconnectingRef.current || localStorage.getItem('wallet_disconnected') === 'true' || sessionStorage.getItem('user_explicitly_disconnected') === 'true') {
      return;
    }
    if (connected && publicKey) {
      const address = publicKey.toBase58();
      setWalletAddress(address);
      void refreshSolBalance(address);

      const storedRole = getUserRole();
      const isOrg = storedRole === 'organizer' || address === SOLANA_TREASURY_WALLET_STR;
      setAuthRole(isOrg ? 'organizer' : 'attendee');

      const localSession: WalletSession = {
        token: `pure_web3_${address}`,
        walletAddress: address,
        role: isOrg ? 'organizer' : 'customer',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      setWalletSession(localSession);
    }
  }, [connected, publicKey, refreshSolBalance]);
  const initialSession = getWalletSession();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const isOrg = initialSession?.role === 'organizer' || initialSession?.role === 'admin';
    if (!isOrg) return 'attendee';
    return getStoredViewMode();
  });
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>(() => getStoredPurchasedTickets());
  const [, setGuestAccessToken] = useState<string>(() => localStorage.getItem('guest_access_token') ?? '');
  const [selectedQrTicket, setSelectedQrTicket] = useState<PurchasedTicket | null>(null);
  const [transferTicketTarget, setTransferTicketTarget] = useState<PurchasedTicket | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutEvent, setCheckoutEvent] = useState<EventItem | null>(null);
  const [checkoutTier, setCheckoutTier] = useState<TicketTier | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ event: EventItem; tier: TicketTier } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState<string | undefined>(undefined);
  const [searchCityFilter, setSearchCityFilter] = useState<string | undefined>(undefined);
  const [searchQueryFilter, setSearchQueryFilter] = useState<string>('');

  // Lắng nghe thay đổi số dư khi địa chỉ ví thay đổi
  useEffect(() => {
    if (walletAddress) {
      void refreshSolBalance(walletAddress);
    } else {
      setSolBalance(null);
    }
  }, [walletAddress, refreshSolBalance]);

  // Keyboard shortcut Ctrl+K / Cmd+K để mở Search Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Eager connection: tự động kết nối trong nền khi app khởi tạo nếu ví đã được tin cậy (chỉ chạy duy nhất một lần)
  useEffect(() => {
    let cancelled = false;
    let hasAttempted = false;

    const checkEagerConnection = async () => {
      if (hasAttempted || localStorage.getItem('wallet_disconnected') === 'true' || sessionStorage.getItem('user_explicitly_disconnected') === 'true') return;
      const provider = getPhantomProvider();
      if (!provider?.isPhantom) return;
      hasAttempted = true;

      try {
        const resp = await safeConnectPhantom({ onlyIfTrusted: true });
        if (cancelled || localStorage.getItem('wallet_disconnected') === 'true' || sessionStorage.getItem('user_explicitly_disconnected') === 'true') return;
        const pubKey = resp?.publicKey || provider.publicKey;
        if (!pubKey) return;
        const address = pubKey.toString();

        void refreshSolBalance(address);
        setWalletAddress(address);

        const storedRole = getUserRole();
        const isOrg = storedRole === 'organizer' || address === SOLANA_TREASURY_WALLET_STR;
        setAuthRole(isOrg ? 'organizer' : 'attendee');

        const localSession: WalletSession = {
          token: `pure_web3_${address}`,
          walletAddress: address,
          role: isOrg ? 'organizer' : 'customer',
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
        setWalletSession(localSession);
      } catch {
        // Trạng thái khách bình thường: im lặng hoàn toàn, không hiển thị lỗi
      }
    };

    void checkEagerConnection();
    window.addEventListener('load', checkEagerConnection);
    const timer = window.setTimeout(checkEagerConnection, 300);

    return () => {
      cancelled = true;
      window.removeEventListener('load', checkEagerConnection);
      window.clearTimeout(timer);
    };
  }, [refreshSolBalance]);

  // Backend and Supabase Cloud is the source of truth for events, merged with mockEvents.
  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const { data: cloudEvents } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });

        let customEvents: any[] = [];
        try {
          customEvents = JSON.parse(localStorage.getItem('uniticket_custom_events') || '[]');
        } catch {}

        const combinedEvents = [...(Array.isArray(customEvents) ? customEvents : []), ...(cloudEvents || []), ...mockEvents].filter(
          (event, index, self) => index === self.findIndex((e) => e.id === event.id)
        );

        if (cancelled) return;
        const normalized = combinedEvents.map((e) => api.supabaseRowToEvent(e));
        setEvents(normalized);
        saveStoredEvents(normalized);
      } catch (error) {
        if (cancelled) return;
        // Fallback an toàn về danh sách sự kiện mặc định mà không hiển thị lỗi đỏ
        setEvents(getStoredEvents());
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    void loadEvents();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('app-events-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
          void loadEvents();
        })
        .subscribe();

      return () => {
        cancelled = true;
        void supabase.removeChannel(channel);
      };
    }

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (currentPage !== 'event-detail' || !selectedEventId || !isApiEventId(selectedEventId)) {
      setSelectedApiEvent(null);
      return;
    }
    let cancelled = false;
    setSelectedApiEvent(null);
    getEventFromApi(selectedEventId)
      .then((event) => { if (!cancelled) setSelectedApiEvent(event); })
      .catch(() => {
        // Fallback to local stored events
      });
    return () => { cancelled = true; };
  }, [currentPage, selectedEventId]);

  const fetchMyTickets = useCallback(async () => {
    if (!walletAddress) {
      setPurchasedTickets([]);
      return [];
    }
    try {
      const remoteTickets = await api.getPurchasedTickets(walletAddress);
      // Lọc loại bỏ vé trùng lặp theo id hoặc ticketCode
      setPurchasedTickets((prev) => {
        const source = remoteTickets.length > 0 ? remoteTickets : prev;
        const seen = new Set<string>();
        const deduped: PurchasedTicket[] = [];
        for (const t of source) {
          const key = t.ticketCode || t.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            deduped.push(t);
          }
        }
        return deduped;
      });
      return remoteTickets;
    } catch (err) {
      console.warn('[UniTicket App] Could not load tickets from API:', err);
      return [];
    }
  }, [walletAddress]);

  // ĐỒNG BỘ THỜI GIAN THỰC (REALTIME LISTENER):
  // Lắng nghe kênh postgres_changes trên bảng tickets của Supabase.
  // Khi có sự kiện UPDATE hoặc INSERT, tự động refresh lại danh sách vé của người dùng mà không cần reload trang.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('tickets-realtime-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('[Supabase Realtime] Phát hiện thay đổi dữ liệu vé:', payload.eventType);
          void fetchMyTickets();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchMyTickets]);

  useEffect(() => {
    if (!connected || !walletAddress) {
      setPurchasedTickets([]);
      return;
    }
    void fetchMyTickets();
  }, [currentPage, connected, walletAddress, fetchMyTickets]);

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
    const syncPageFromLocation = () => {
      const pageFromLocation = getPageFromPathname(window.location.pathname);
      const nextPage = pageFromLocation ?? 'home';

      if (ORGANIZER_PAGES.includes(nextPage)) {
        setAuthRole('organizer');
        setUserRole('organizer');
        setViewMode('organizer');
        saveStoredViewMode('organizer');
        setCurrentPage(nextPage);
        setSelectedEventId(null);
        setSelectedVerifyTicketId(null);
      } else {
        setCurrentPage(nextPage);
        setSelectedEventId(nextPage === 'event-detail' ? new URLSearchParams(window.location.search).get('eventId') : null);
        setSelectedVerifyTicketId(
          nextPage === 'verify'
            ? getTicketIdFromPathname(window.location.pathname) || new URLSearchParams(window.location.search).get('ticketId') || new URLSearchParams(window.location.search).get('id')
            : null
        );
        if (!pageFromLocation) {
          window.history.replaceState(null, '', PAGE_PATHS.home);
        }
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    syncPageFromLocation();
    window.addEventListener('popstate', syncPageFromLocation);
    return () => window.removeEventListener('popstate', syncPageFromLocation);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (page: string, targetId?: string) => {
    if (ORGANIZER_PAGES.includes(page)) {
      setAuthRole('organizer');
      setUserRole('organizer');
      setViewMode('organizer');
      saveStoredViewMode('organizer');
    } else if (page === 'home') {
      setViewMode('attendee');
      saveStoredViewMode('attendee');
    }
    const nextPage = (PAGE_PATHS[page as keyof typeof PAGE_PATHS] || page === 'verify') ? page : 'home';
    const nextPath = getPathForPage(nextPage, targetId);
    setCurrentPage(nextPage);
    if (nextPage === 'event-detail') {
      setSelectedEventId(targetId ?? null);
    } else if (nextPage === 'verify') {
      setSelectedVerifyTicketId(targetId ?? null);
    }
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    scrollToTop();
  };

  useEffect(() => {
    const handleCustomNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'string') {
        handleNavigate(detail);
      }
    };
    window.addEventListener('uniticket-navigate', handleCustomNav);
    return () => window.removeEventListener('uniticket-navigate', handleCustomNav);
  }, []);



  const selectedEvent = (selectedApiEvent && selectedApiEvent.id === selectedEventId)
    ? selectedApiEvent
    : events.find((e) => e.id === selectedEventId) || events[0];

  const showToast = useCallback((
    type: ToastMessage['type'],
    message: string,
    actionUrl?: string,
    actionLabel?: string,
    toastId?: string
  ) => {
    // Chặn triệt để mọi thông báo lỗi về máy chủ xác thực trong dApp Web3
    if (
      message.includes('máy chủ xác thực') ||
      message.includes('Không thể kết nối máy chủ xác thực') ||
      message.includes('Backend offline')
    ) {
      console.warn('[UniTicket Toast Suppressed]:', message);
      return;
    }

    const id = toastId || `${Date.now()}-${Math.random()}`;

    setToasts((current) => {
      // Nếu đã có toast với toastId này thì không xếp chồng nhiều thông báo lên nhau
      if (toastId && current.some((t) => t.id === toastId)) {
        return current;
      }
      return [
        ...current,
        { id, type, message, actionUrl, actionLabel }
      ];
    });
  }, []);

  const toast = useMemo(() => ({
    info: (message: string, options?: { toastId?: string }) => {
      showToast('info', message, undefined, undefined, options?.toastId);
    },
    success: (message: string, options?: { toastId?: string }) => {
      showToast('success', message, undefined, undefined, options?.toastId);
    },
    error: (message: string, options?: { toastId?: string }) => {
      showToast('error', message, undefined, undefined, options?.toastId);
    },
  }), [showToast]);

  const handleCloseToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const resetWalletSession = () => {
    const previousSession = clearWalletSession();
    if (previousSession) void logoutWalletSession(previousSession.token).catch(() => undefined);
    clearUserRole();
    setAuthRole(null);
    setViewMode('attendee');
    saveStoredViewMode('attendee');
    setPendingPurchase(null);
    setIsCheckoutOpen(false);
    setCheckoutEvent(null);
    setCheckoutTier(null);

    if (ORGANIZER_PAGES.includes(currentPage)) {
      handleNavigate('home');
    }
  };

  const handleToggleViewMode = () => {
    if (authRole !== 'organizer') {
      showToast('error', t('toasts.organizerRoleRequired'));
      return;
    }
    const nextMode: ViewMode = viewMode === 'organizer' ? 'attendee' : 'organizer';
    setViewMode(nextMode);
    saveStoredViewMode(nextMode);
    if (nextMode === 'attendee') {
      handleNavigate('home');
    } else {
      handleNavigate('organizer');
    }
    showToast('info', nextMode === 'organizer' ? t('toasts.organizerModeEnabled') : t('toasts.attendeeModeEnabled'));
  };

  const handleWalletChange = (address: string | null) => {
    setWalletAddress(address);
    if (address) {
      void refreshSolBalance(address);
    } else {
      setSolBalance(null);
      resetWalletSession();
    }
  };

  const handleWalletAuthenticated = (session: WalletSession) => {
    sessionStorage.removeItem('user_explicitly_disconnected');
    setWalletSession(session);
    setWalletAddress(session.walletAddress);
    void refreshSolBalance(session.walletAddress);
    const isOrg = session.role === 'organizer' || session.role === 'admin';
    const role: UserRole = isOrg ? 'organizer' : 'attendee';
    setAuthRole(role);
    if (isOrg) {
      const stored = getStoredViewMode();
      setViewMode(stored);
    } else {
      setViewMode('attendee');
      saveStoredViewMode('attendee');
    }
    if (pendingPurchase) {
      setCheckoutEvent(pendingPurchase.event);
      setCheckoutTier(pendingPurchase.tier);
      setPendingPurchase(null);
      setIsWalletModalOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  const handleConnectWalletDirect = async () => {
    sessionStorage.removeItem('user_explicitly_disconnected');
    localStorage.removeItem('wallet_disconnected');
    if (isConnectingWallet) return;
    const provider = getPhantomProvider();
    if (!provider?.isPhantom) {
      // Nếu chưa có extension, mở modal hướng dẫn cài đặt Phantom
      setIsWalletModalOpen(true);
      return;
    }

    setIsConnectingWallet(true);
    try {
      try {
        const phantom = wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
        if (phantom) {
          select(phantom.adapter.name);
          await adapterConnect();
        }
      } catch (adapterErr) {
        console.warn('Wallet adapter connection notice:', adapterErr);
      }

      let pubKey = provider.publicKey;
      if (!pubKey || !provider.isConnected) {
        const resp = await safeConnectPhantom();
        pubKey = resp?.publicKey || provider.publicKey;
      }
      if (!pubKey) {
        throw new Error('Không nhận được địa chỉ ví công khai từ Phantom.');
      }
      const address = pubKey.toString();

      // Trong dApp Web3: Lấy publicKey làm định danh tài khoản trực tiếp (không gọi máy chủ xác thực)
      const storedRole = getUserRole();
      const isOrg = storedRole === 'organizer' || address === SOLANA_TREASURY_WALLET_STR;
      const role: UserRole = isOrg ? 'organizer' : 'attendee';
      setAuthRole(role);

      const localSession: WalletSession = {
        token: `pure_web3_${address}`,
        walletAddress: address,
        role: isOrg ? 'organizer' : 'customer',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      setWalletSession(localSession);
      setWalletAddress(address);

      await refreshSolBalance(address);
      showToast('success', `Đã kết nối ví Phantom (${address.slice(0, 4)}...${address.slice(-4)})`);

      if (pendingPurchase) {
        setCheckoutEvent(pendingPurchase.event);
        setCheckoutTier(pendingPurchase.tier);
        setPendingPurchase(null);
        setIsWalletModalOpen(false);
        setIsCheckoutOpen(true);
      }
    } catch (error) {
      const errorMsg = extractWalletErrorMessage(error);
      if (
        !errorMsg.includes('máy chủ xác thực') &&
        !errorMsg.includes('Không thể kết nối máy chủ xác thực') &&
        !errorMsg.includes('Backend offline')
      ) {
        showToast('error', errorMsg);
      }
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      localStorage.setItem('wallet_disconnected', 'true');
      sessionStorage.setItem('user_explicitly_disconnected', 'true');

      // 1. Ngắt kết nối adapter
      if (walletDisconnect) {
        await walletDisconnect().catch(() => undefined);
      }
      const phantomWindow = window as unknown as { phantom?: { solana?: { disconnect: () => Promise<void> } } };
      if (phantomWindow?.phantom?.solana?.disconnect) {
        await phantomWindow.phantom.solana.disconnect().catch(() => undefined);
      } else {
        const provider = getPhantomProvider();
        if (provider?.isPhantom && provider.disconnect) {
          await provider.disconnect().catch(() => undefined);
        }
      }

      // 2. Dọn sạch toàn bộ state
      setWalletAddress(null);
      setSolBalance(null);
      setAuthRole(null);
      resetWalletSession();

      // 3. Xóa sạch localStorage liên quan đến ví
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('connectedWallet');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('uniticket_wallet_session');
      localStorage.removeItem('walletName');
      clearUserRole();

      // 4. Bắn DUY NHẤT 1 toast với toastId cố định để chặn spam
      toast.info("Đã ngắt kết nối ví Phantom.", { toastId: "disconnect-toast" });
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  // Lắng nghe sự kiện đổi tài khoản và ngắt kết nối trực tiếp từ tiện ích Phantom
  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider || !provider.on) return;

    const handleAccountChange = (publicKey?: { toString: () => string } | null) => {
      if (isDisconnectingRef.current || localStorage.getItem('wallet_disconnected') === 'true') return;
      if (publicKey) {
        sessionStorage.removeItem('user_explicitly_disconnected');
        const newAddress = publicKey.toString();
        logPhantomDebug('App.tsx accountChanged', { newAddress });
        setWalletAddress(newAddress);
        void refreshSolBalance(newAddress);

        const storedRole = getUserRole();
        const isOrg = storedRole === 'organizer' || newAddress === SOLANA_TREASURY_WALLET_STR;
        setAuthRole(isOrg ? 'organizer' : 'attendee');

        const session: WalletSession = {
          token: `pure_web3_${newAddress}`,
          walletAddress: newAddress,
          role: isOrg ? 'organizer' : 'customer',
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
        setWalletSession(session);
      } else {
        // Ví đổi sang rỗng hoặc ngắt từ extension: reset tĩnh lặng, TUYỆT ĐỐI KHÔNG GỌI handleDisconnectWallet VÀ KHÔNG BẮN TOAST
        resetWalletSession();
        setWalletAddress(null);
        setSolBalance(null);
      }
    };

    const handleDisconnect = () => {
      if (isDisconnectingRef.current) return;
      // Nhận event ngắt kết nối từ tiện ích: reset tĩnh lặng, TUYỆT ĐỐI KHÔNG GỌI handleDisconnectWallet VÀ KHÔNG BẮN TOAST
      resetWalletSession();
      setWalletAddress(null);
      setSolBalance(null);
    };

    provider.on('accountChanged', handleAccountChange);
    provider.on('disconnect', handleDisconnect);

    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountChanged', handleAccountChange);
        provider.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [refreshSolBalance]);

  const handleCloseWalletModal = () => {
    setPendingPurchase(null);
    setIsWalletModalOpen(false);
  };


  const handlePurchase = (event: EventItem, tier: TicketTier) => {
    if (tier.remainingQuantity <= 0) {
      showToast('error', t('toasts.tierSoldOut'));
      return;
    }
    setCheckoutEvent(event);
    setCheckoutTier(tier);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = async (tickets: PurchasedTicket[], txSignature?: string) => {
    const storedToken = localStorage.getItem('guest_access_token') ?? '';
    if (storedToken) setGuestAccessToken(storedToken);

    if (tickets.length > 0) {
      savePurchasedTickets(tickets);
    }

    // Tự động fetch lại danh sách vé trong trang "Vé của tôi" (My Tickets)
    await fetchMyTickets();
    const storedTickets = getStoredPurchasedTickets();
    setPurchasedTickets((prev) => {
      const source = storedTickets.length > 0 ? storedTickets : tickets;
      const seen = new Set<string>();
      const deduped: PurchasedTicket[] = [];
      for (const t of [...source, ...prev]) {
        const key = t.ticketCode || t.id;
        if (key && !seen.has(key)) {
          seen.add(key);
          deduped.push(t);
        }
      }
      return deduped;
    });
    setEvents(getStoredEvents());

    const explorerUrl = txSignature
      ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      : undefined;

    showToast(
      'success',
      txSignature
        ? 'Giao dịch mua vé thành công! Đã xác nhận trên Solana Devnet.'
        : t('toasts.purchaseSuccessCount', { count: tickets.length }),
      explorerUrl,
      explorerUrl ? 'Xem giao dịch trên Solana Explorer' : undefined
    );

    // Xác nhận trạng thái lưu trữ vé
    showToast(
      'info',
      isSupabaseConfigured
        ? 'Vé đã được đồng bộ an toàn lên Cloud Supabase'
        : 'Vé đã lưu vào bộ nhớ cục bộ (Local Mode)'
    );

    if (walletAddress) {
      void refreshSolBalance(walletAddress);
    }
  };

  const handleCloseCheckout = (navigateToMyTickets?: boolean) => {
    setIsCheckoutOpen(false);
    setCheckoutEvent(null);
    setCheckoutTier(null);
    if (navigateToMyTickets) {
      handleNavigate('my-tickets');
    }
  };

  return (
    <div className="min-h-screen bg-[#070412] text-slate-100 flex flex-col selection:bg-solana-purple selection:text-white font-sans relative overflow-x-hidden">
      {/* Thanh điều hướng toàn cục */}
      <Navbar
        currentPage={currentPage}
        onNavigate={(p) => handleNavigate(p)}
        onOpenWalletModal={() => setIsWalletModalOpen(true)}
        onConnectWallet={handleConnectWalletDirect}
        onDisconnectWallet={handleDisconnectWallet}
        setWalletAddress={setWalletAddress}
        setSolBalance={setSolBalance}
        toast={toast}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        authRole={authRole}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        walletAddress={walletAddress}
        solBalance={solBalance}
        isConnectingWallet={isConnectingWallet}
      />

      {/* Nội dung trang động */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage 
            events={events}
            onNavigate={(page, id) => {
              if (page === 'events') {
                setSearchCategoryFilter(undefined);
                setSearchCityFilter(undefined);
                setSearchQueryFilter('');
                handleNavigate('events');
              } else {
                handleNavigate(page, id);
              }
            }}
            onFilterByCategory={(category) => {
              setSearchCategoryFilter(category);
              setSearchCityFilter(undefined);
              setSearchQueryFilter('');
              handleNavigate('events');
            }}
            onFilterByCity={(city) => {
              setSearchCityFilter(city);
              setSearchCategoryFilter(undefined);
              setSearchQueryFilter('');
              handleNavigate('events');
            }}
          />
        )}

        {/* Trang Khám Phá Sự Kiện (Events) */}
        {currentPage === 'events' && (
          <EventsPage
            onSelectEvent={(id) => handleNavigate('event-detail', id)}
            onBackToHome={() => handleNavigate('home')}
            initialCategory={searchCategoryFilter}
            initialCity={searchCityFilter}
            initialQuery={searchQueryFilter}
          />
        )}

        {/* Trang Chi Tiết Sự Kiện (Event Detail) */}
        {currentPage === 'event-detail' && (
          <EventDetailPage
            event={selectedEvent}
            onBack={() => handleNavigate('events')}
            onSelectTier={(tier) => {
              if (selectedEvent) handlePurchase(selectedEvent, tier);
            }}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
            onShowToast={showToast}
          />
        )}

        {/* Trang Chợ Vé Thứ Cấp (Secondary Marketplace) */}
        {currentPage === 'marketplace' && (
          <MarketplacePage
            onNavigate={handleNavigate}
            walletAddress={walletAddress}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
            onCloseWalletModal={() => setIsWalletModalOpen(false)}
            onShowToast={showToast}
            onTicketsChanged={() => setPurchasedTickets(getStoredPurchasedTickets())}
          />
        )}

        {/* Trang Vé Của Tôi (Solana Explorer: explorer.solana.com/tx, viewOnExplorer, viewPublicVerification) */}
        {currentPage === 'my-tickets' && (
          <MyTicketsPage
            onNavigate={handleNavigate}
            onOpenWalletModal={() => setIsWalletModalOpen(true)}
            onSelectQrTicket={setSelectedQrTicket}
            onSelectTransferTicket={setTransferTicketTarget}
            walletAddress={walletAddress}
            onShowToast={showToast}
          />
        )}

        {currentPage === 'verify' && (
          <VerifyTicketPage
            ticketId={selectedVerifyTicketId}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'check-in' && (
          <CheckInPage
            currentRole={authRole}
            organizerAddress={walletAddress}
            onShowToast={showToast}
            onTicketsChanged={() => setPurchasedTickets(getStoredPurchasedTickets())}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'organizer' && (
          <OrganizerDashboard
            events={events}
            tickets={purchasedTickets}
            onNavigate={handleNavigate}
            organizerWallet={walletAddress}
            onShowToast={showToast}
          />
        )}

        {currentPage === 'organizer-events' && (
          <OrganizerEvents
            events={events}
            onNavigate={handleNavigate}
            organizerWallet={walletAddress}
            eventsLoading={eventsLoading}
            eventsError={eventsError}
            onEventsChanged={(nextEvents) => setEvents(nextEvents)}
          />
        )}

        {currentPage === 'create-event' && (
          <OrganizerEvents
            events={events || []}
            onNavigate={handleNavigate}
            organizerWallet={walletAddress}
            eventsLoading={eventsLoading}
            eventsError={eventsError}
            onEventsChanged={(nextEvents) => setEvents(nextEvents)}
            startInCreate
          />
        )}

        {currentPage === 'access-denied' && (
          <AccessDenied
            authRole={authRole}
            viewMode={viewMode}
            onSwitchToOrganizerView={() => {
              setViewMode('organizer');
              saveStoredViewMode('organizer');
              handleNavigate('organizer');
            }}
            onConnectWallet={() => setIsWalletModalOpen(true)}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      {/* Modal Mã QR Động chống vé giả / chụp màn hình */}
      <DynamicQRModal
        isOpen={Boolean(selectedQrTicket)}
        ticket={selectedQrTicket}
        onClose={() => setSelectedQrTicket(null)}
        onNavigateToVerify={(ticketId) => handleNavigate('verify', ticketId)}
      />

      {/* Modal Chuyển nhượng vé On-chain */}
      <TransferTicketModal
        isOpen={Boolean(transferTicketTarget)}
        ticket={transferTicketTarget}
        currentWallet={walletAddress}
        onClose={() => setTransferTicketTarget(null)}
        onSuccess={(transferredTicket) => {
          const updated = getStoredPurchasedTickets();
          setPurchasedTickets(updated);
          const truncated = `${transferredTicket.customerWallet.slice(0, 4)}...${transferredTicket.customerWallet.slice(-4)}`;
          showToast('success', t('transferModal.transferSuccess', { address: truncated }));
          showToast(
            'info',
            isSupabaseConfigured
              ? 'Vé đã được đồng bộ an toàn lên Cloud Supabase'
              : 'Vé đã lưu vào bộ nhớ cục bộ (Local Mode)'
          );
        }}
      />

      {/* Chân trang toàn cục */}
      <Footer onNavigate={(p) => handleNavigate(p)} />

      {/* Modal Connect Wallet */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={handleCloseWalletModal}
        walletAddress={walletAddress}
        solBalance={solBalance}
        onWalletChange={handleWalletChange}
        onAuthenticated={handleWalletAuthenticated}
        onConnectionCancelled={() => setPendingPurchase(null)}
        onDisconnect={handleDisconnectWallet}
      />

      {/* Modal Tìm kiếm toàn cục */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        events={events}
        onSelectEvent={(id) => handleNavigate('event-detail', id)}
        onViewAllResults={(q) => {
          setSearchQueryFilter(q);
          setSearchCategoryFilter(undefined);
          setSearchCityFilter(undefined);
          handleNavigate('events');
        }}
      />

      {checkoutEvent && checkoutTier && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => handleCloseCheckout(false)}
          onNavigateToMyTickets={() => handleCloseCheckout(true)}
          event={checkoutEvent}
          tier={checkoutTier}
          quantity={1}
          connected={connected || Boolean(walletAddress)}
          walletAddress={walletAddress}
          publicKey={publicKey}
          solBalance={solBalance}
          onSuccess={handleCheckoutSuccess}
          onError={(message) => showToast('error', message)}
          onOpenWalletModal={() => setIsWalletModalOpen(true)}
          onConnectWallet={handleConnectWalletDirect}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onClose={handleCloseToast}
      />

      {/* Nút Back to Top nổi ở góc phải dưới */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label={t('common.scrollToTop')}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-xl shadow-purple-950/60 hover:scale-110 active:scale-95 transition-all animate-bounce duration-300"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default App;
