import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { WalletModal, getPhantomProvider, safeConnectPhantom, logPhantomDebug, extractWalletErrorMessage } from './components/common/WalletModal';
import { PhantomLogo } from './components/common/PhantomLogo';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { ToastContainer } from './components/common/Toast';
import { HomePage } from './pages/Home';
import { EventsPage } from './pages/Events';
import { EventDetailPage } from './pages/EventDetail';
import { CheckInPage } from './pages/CheckIn';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { OrganizerEvents } from './pages/OrganizerEvents';
import { AccessDenied } from './pages/AccessDenied';
import { SearchModal } from './components/common/SearchModal';
import { 
  ArrowLeft, 
  Ticket, 
  PlusCircle, 
  ArrowUp, 
  Sparkles,
  ExternalLink,
  X,
  Send,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { TransferTicketModal } from './components/tickets/TransferTicketModal';
import { EventItem, PurchasedTicket, TicketTier, ToastMessage, UserRole } from './types';
import { getStoredEvents, getStoredPurchasedTickets, saveStoredEvents, savePurchasedTickets } from './utils/storage';
import { useWallet } from '@solana/wallet-adapter-react';
import { getEvent as getEventFromApi, isApiEventId, listEvents } from './services/eventsApi';

import * as api from './services/api';
import { clearWalletSession, getWalletSession, setWalletSession, WalletSession } from './services/authSession';
import { logoutWalletSession } from './services/authApi';
import { getWalletSolBalance, SOLANA_TREASURY_WALLET_STR } from './services/solanaClient';
import { clearUserRole, getUserRole, setUserRole } from './utils/role';
import { ViewMode, getStoredViewMode, saveStoredViewMode } from './utils/viewMode';
import { useTranslation } from './i18n';

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
  const { t, formatDate } = useTranslation();
  const [currentPage, setCurrentPage] = useState<string>(() => getPageFromPathname(window.location.pathname) ?? 'home');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('eventId'));
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [events, setEvents] = useState<EventItem[]>(() => getStoredEvents());
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedApiEvent, setSelectedApiEvent] = useState<EventItem | null>(null);
  const initialSession = getWalletSession();
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('wallet_disconnected') === 'true') {
      return null;
    }
    return initialSession?.walletAddress ?? null;
  });
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<UserRole | null>(() => {
    if (!initialSession || (typeof window !== 'undefined' && localStorage.getItem('wallet_disconnected') === 'true')) return null;
    return initialSession.role === 'organizer' || initialSession.role === 'admin' ? 'organizer' : 'attendee';
  });

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

  // Tự động chọn Phantom adapter nếu phát hiện ví trong danh sách wallets (trừ khi người dùng vừa chủ động ngắt kết nối)
  useEffect(() => {
    if (localStorage.getItem('wallet_disconnected') === 'true' || sessionStorage.getItem('user_explicitly_disconnected') === 'true') return;
    if (!connected && wallets.length > 0) {
      const phantom = wallets.find((w) => w.adapter.name.toLowerCase().includes('phantom'));
      if (phantom) {
        select(phantom.adapter.name);
      }
    }
  }, [connected, wallets, select]);

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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const isOrg = initialSession?.role === 'organizer' || initialSession?.role === 'admin';
    if (!isOrg) return 'attendee';
    return getStoredViewMode();
  });
  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicket[]>(() => getStoredPurchasedTickets());
  const [guestAccessToken, setGuestAccessToken] = useState<string>(() => localStorage.getItem('guest_access_token') ?? '');
  const [selectedQrTicket, setSelectedQrTicket] = useState<PurchasedTicket | null>(null);
  const [transferTicketTarget, setTransferTicketTarget] = useState<PurchasedTicket | null>(null);

  const myTickets = useMemo(() => {
    if (!walletAddress) return purchasedTickets;
    return purchasedTickets.filter((ticket) => {
      if (!ticket.customerWallet) return true;
      return ticket.customerWallet.toLowerCase() === walletAddress.toLowerCase();
    });
  }, [purchasedTickets, walletAddress]);
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

  // Backend is the source of truth for events when available, merged with mockEvents.
  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const stored = getStoredEvents();
        setEvents(stored);

        const remoteEvents = await listEvents();
        if (cancelled) return;
        if (remoteEvents.length > 0) {
          // Luôn đảm bảo nạp đè và giữ trọn vẹn 4 sự kiện mới từ mockEvents
          const merged = [...remoteEvents];
          for (const m of stored) {
            if (!merged.some((r) => r.id === m.id || r.title.toLowerCase().trim() === m.title.toLowerCase().trim())) {
              merged.push(m);
            }
          }
          setEvents(merged);
          saveStoredEvents(merged);
        } else {
          setEvents(getStoredEvents());
        }
      } catch (error) {
        if (cancelled) return;
        setEventsError(error instanceof Error ? error.message : 'Could not load events from the API.');
        setEvents(getStoredEvents());
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    void loadEvents();
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
    try {
      let remoteTickets: PurchasedTicket[] = [];
      if (walletAddress) {
        remoteTickets = await api.fetchMyTickets({ wallet: walletAddress });
      } else {
        remoteTickets = await api.fetchMyTickets();
      }
      setPurchasedTickets(remoteTickets);
      return remoteTickets;
    } catch (err) {
      console.warn('[UniTicket App] Could not load tickets from API:', err);
      return [];
    }
  }, [walletAddress]);

  useEffect(() => {
    if (currentPage === 'my-tickets' || walletAddress || guestAccessToken) {
      void fetchMyTickets();
    }
  }, [currentPage, walletAddress, guestAccessToken, fetchMyTickets]);

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
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (page: string, eventId?: string) => {
    if (ORGANIZER_PAGES.includes(page)) {
      setAuthRole('organizer');
      setUserRole('organizer');
      setViewMode('organizer');
      saveStoredViewMode('organizer');
    } else if (page === 'home') {
      setViewMode('attendee');
      saveStoredViewMode('attendee');
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
      resetWalletSession();

      // 3. Xóa sạch localStorage liên quan đến ví
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('connectedWallet');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('uniticket_wallet_session');
      localStorage.removeItem('walletName');

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
    setPurchasedTickets(storedTickets.length > 0 ? storedTickets : tickets);
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
    <div className="min-h-screen bg-[#070412] text-slate-100 flex flex-col selection:bg-solana-purple selection:text-white font-sans relative">
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
                onClick={() => setIsWalletModalOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-4 py-2 text-xs font-semibold text-solana-cyan transition-colors hover:bg-solana-purple/30 shrink-0"
              >
                <PhantomLogo className="h-4 w-4" />
                {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : t('myTickets.connectWalletNotice')}
              </button>
            </div>

            {myTickets.length === 0 ? (
              <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#120B30] p-8 text-center shadow-2xl">
                <Ticket className="mx-auto mb-3 h-10 w-10 text-solana-cyan" />
                <h2 className="text-xl font-bold text-white">{t('myTickets.emptyTitle')}</h2>
                <p className="mt-2 text-sm text-slate-300">{t('myTickets.emptySubtitle')}</p>
                <button
                  onClick={() => handleNavigate('events')}
                  className="mt-5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white"
                >
                  {t('myTickets.exploreBtn')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {myTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-xl">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="min-w-0">
                        <h2 className="break-words text-base font-bold text-white">{ticket.eventTitle}</h2>
                        <p className="mt-1 text-xs text-solana-cyan">{ticket.tierName}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-solana-green/40 bg-solana-green/15 px-2 py-1 text-[10px] font-bold text-solana-green">
                        {ticket.isCheckedIn || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN' ? t('myTickets.statusCheckedIn') : t('myTickets.statusUnused')}
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
                            onClick={() => setSelectedQrTicket(ticket)}
                            className="min-h-11 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-2 text-xs font-bold text-solana-cyan hover:bg-solana-cyan/20 transition-colors flex items-center gap-1.5"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>{t('myTickets.showQr')}</span>
                          </button>

                          {/* Nút Chuyển nhượng vé chỉ khả dụng khi vé chưa check-in */}
                          {!ticket.isCheckedIn && !ticket.isUsed && ticket.status !== 'checked_in' && ticket.status !== 'CHECKED_IN' && (
                            <button
                              onClick={() => setTransferTicketTarget(ticket)}
                              className="min-h-11 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-3.5 py-2 text-xs font-bold text-purple-200 hover:bg-solana-purple/35 hover:text-white hover:border-solana-cyan/40 transition-colors flex items-center gap-1.5"
                              title="Chuyển nhượng vé cho ví Solana khác"
                            >
                              <Send className="h-3.5 w-3.5 text-solana-cyan" />
                              <span>{t('myTickets.transferTicket')}</span>
                            </button>
                          )}
                        </div>
                        {ticket.isCheckedIn && ticket.checkInTime && <span className="text-[11px] text-solana-green">{t('myTickets.checkedInAt', { time: formatDate(ticket.checkInTime, { dateStyle: 'short', timeStyle: 'short' }) })}</span>}
                      </div>
                    </div>
                    {ticket.nftTransactionSignature && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-solana-cyan/20 bg-solana-cyan/5 px-3 py-2 text-xs">
                        <span className="text-slate-400">Solana Devnet:</span>
                        <a
                          href={`https://explorer.solana.com/tx/${ticket.nftTransactionSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-solana-cyan hover:underline"
                        >
                          <span>{ticket.nftTransactionSignature.slice(0, 8)}...{ticket.nftTransactionSignature.slice(-8)}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    <p className="mt-4 border-t border-dashed border-white/10 pt-3 text-[11px] text-slate-400">
                      {t('myTickets.order')} {ticket.orderId} · {t('myTickets.qrDemoNotice')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentPage === 'check-in' && (
          <CheckInPage
            currentRole={authRole}
            organizerAddress={walletAddress}
            onShowToast={showToast}
            onTicketsChanged={() => setPurchasedTickets(getStoredPurchasedTickets())}
          />
        )}

        {currentPage === 'organizer' && (
          <OrganizerDashboard events={events} tickets={purchasedTickets} onNavigate={handleNavigate} />
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
            events={events}
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

        {/* Trang Tạo Sự Kiện (Create Event Preview) */}
        {false && currentPage === 'create-event' && (
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

      {selectedQrTicket && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <button aria-label={t('common.close')} className="absolute inset-0" onClick={() => setSelectedQrTicket(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 text-center shadow-2xl sm:p-6">
            <button aria-label={t('common.close')} onClick={() => setSelectedQrTicket(null)} className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <h2 className="pr-10 text-left text-lg font-bold text-white">{t('qrModal.title')}</h2>
            <p className="mt-1 text-left text-xs text-slate-300">{selectedQrTicket.eventTitle}</p>
            <div className="mx-auto mt-5 inline-flex max-w-full rounded-2xl bg-white p-3"><QRCodeSVG value={selectedQrTicket.qrPayload} size={240} level="M" /></div>
            <p className="mt-4 text-xs text-solana-cyan">{t('qrModal.showToStaff')}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{t('qrModal.securityNotice')}</p>
          </div>
        </div>
      )}

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
          walletAddress={walletAddress}
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
