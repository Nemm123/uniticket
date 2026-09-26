import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  CalendarDays,
  Ticket,
  Sparkles,
  Menu,
  X,
  PlusCircle,
  Compass,
  Home,
  ScanLine,
  Eye,
  LayoutDashboard,
  Search,
  Coins,
  LogOut,
  ExternalLink,
  Loader2,
  ChevronDown,
  Globe
} from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode } from '../../utils/viewMode';
import { PhantomLogo } from '../common/PhantomLogo';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { useTranslation } from '../../i18n';
import { formatSolBalance, SOLANA_DEVNET_FAUCET_URL } from '../../services/solanaClient';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenWalletModal: () => void;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
  onOpenSearch?: () => void;
  authRole: UserRole | null;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  walletAddress: string | null;
  solBalance?: number | null;
  isConnectingWallet?: boolean;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenWalletModal,
  onConnectWallet,
  onDisconnectWallet,
  onOpenSearch,
  authRole,
  viewMode,
  onToggleViewMode,
  walletAddress,
  solBalance,
  isConnectingWallet,
}) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manageDropdownOpen, setManageDropdownOpen] = useState(false);
  const manageDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown Quản lý khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (manageDropdownRef.current && !manageDropdownRef.current.contains(e.target as Node)) {
        setManageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khóa cuộn body khi menu mobile đang mở
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => {
      if (desktopMedia.matches) setMobileMenuOpen(false);
    };
    if (desktopMedia.addEventListener) {
      desktopMedia.addEventListener('change', closeOnDesktop);
    } else {
      desktopMedia.addListener(closeOnDesktop);
    }
    closeOnDesktop();
    return () => {
      if (desktopMedia.removeEventListener) {
        desktopMedia.removeEventListener('change', closeOnDesktop);
      } else {
        desktopMedia.removeListener(closeOnDesktop);
      }
    };
  }, []);

  const isOrganizerView =
    currentPage === 'organizer' ||
    currentPage === 'organizer-events' ||
    currentPage === 'create-event' ||
    currentPage === 'check-in' ||
    (authRole === 'organizer' && viewMode === 'organizer');

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const mobileNavigation = mobileMenuOpen ? createPortal(
    <div
      id="mobile-navigation"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation drawer"
      className="fixed inset-0 z-[100] md:hidden"
    >
      {/* Lớp phủ mờ (Backdrop Overlay) */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Ngăn kéo Sidebar trượt từ cạnh trái (chiếm ~80% chiều rộng màn hình) */}
      <aside
        className="fixed inset-y-0 left-0 w-[82vw] max-w-[320px] bg-[#0A061E] border-r border-solana-purple/30 z-[101] p-4 sm:p-5 flex flex-col shadow-2xl overflow-y-auto animate-slide-left"
      >
        {/* Đầu Sidebar: Logo UniTicket + Nút Đóng X */}
        <div className="flex items-center justify-between">
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-solana-purple via-neon-pink to-solana-cyan p-0.5 shadow-lg shadow-solana-purple/30">
              <div className="w-full h-full bg-[#0E0924] rounded-[10px] flex items-center justify-center">
                <Ticket className="w-4 h-4 text-solana-cyan" />
              </div>
              <Sparkles className="w-2 h-2 text-solana-green absolute -top-0.5 -right-0.5 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white font-display">
                Uni<span className="text-gradient-solana">Ticket</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-solana-purple/20 text-solana-cyan border border-solana-cyan/30">
                Devnet
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Đóng menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X className="w-4 h-4 text-neon-pink" />
          </button>
        </div>

        {/* Thẻ thông tin không gian (Workspace Card) */}
        <div className="mt-3 px-3 py-2 rounded-xl bg-gradient-to-r from-solana-purple/15 to-solana-cyan/10 border border-solana-purple/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse" />
            <span className="font-semibold text-white">UniTicket Devnet</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-solana-cyan/15 text-solana-cyan border border-solana-cyan/30">
            Không gian sự kiện
          </span>
        </div>

        {/* Ô tìm kiếm nhanh trên Mobile (nếu có) */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenSearch();
            }}
            className="mt-3 flex min-h-10 w-full items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-solana-cyan" />
              <span>{t('nav.searchPlaceholder')}</span>
            </div>
            <kbd className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-slate-400 border border-white/10">{t('nav.searchShortcut')}</kbd>
          </button>
        )}

        {/* NHÓM 1: ĐIỀU HƯỚNG CHÍNH (MAIN NAVIGATION) */}
        <div className="mt-4">
          <div className="px-1 mb-1.5 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
            ĐIỀU HƯỚNG CHÍNH
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'home'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Home className="h-4 w-4 text-solana-cyan shrink-0" />
              <span>{t('nav.home')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('events')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'events'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Compass className="h-4 w-4 text-solana-cyan shrink-0" />
              <span>{t('nav.events')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('my-tickets')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'my-tickets'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Ticket className="h-4 w-4 text-solana-cyan shrink-0" />
              <span>{t('nav.myTickets')}</span>
            </button>
          </div>
        </div>

        {/* NHÓM 2: DÀNH CHO BAN TỔ CHỨC (FOR ORGANIZERS) */}
        <div className="mt-4">
          <div className="px-1 mb-1.5 flex items-center justify-between text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
            <span>DÀNH CHO BAN TỔ CHỨC</span>
            <span className="text-[9px] font-bold text-solana-green px-1.5 py-0.2 rounded bg-solana-green/15 border border-solana-green/30">
              BTC
            </span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('organizer')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'organizer'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <BarChart3 className="h-4 w-4 text-solana-green shrink-0" />
              <span>{t('nav.dashboard')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('create-event')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'create-event'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <PlusCircle className="h-4 w-4 text-neon-pink shrink-0" />
              <span>{t('nav.createEvent')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('check-in')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all ${
                currentPage === 'check-in'
                  ? 'bg-gradient-to-r from-solana-purple/30 to-solana-cyan/20 border border-solana-purple/40 text-solana-cyan font-bold shadow-sm'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ScanLine className="h-4 w-4 text-solana-cyan shrink-0" />
              <span>{t('nav.checkIn')}</span>
            </button>
          </div>
        </div>

        {/* NHÓM 3: TÀI KHOẢN & MẠNG LƯỚI (ACCOUNT & NETWORK) */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          <div className="px-1 mb-1 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
            TÀI KHOẢN & MẠNG LƯỚI
          </div>

          {/* Chi tiết ví kết nối nếu có */}
          {walletAddress ? (
            <div className="rounded-xl border border-solana-purple/35 bg-[#120B30] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PhantomLogo className="h-4 w-4 shrink-0" />
                  <span className="font-mono text-xs font-bold text-white">{shortAddress(walletAddress)}</span>
                </div>
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-solana-purple/20 border border-solana-purple/40 text-[9px] font-bold text-solana-cyan">
                  <span className="w-1.5 h-1.5 rounded-full bg-solana-green animate-pulse" />
                  <span>Devnet</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-white/5 pt-1.5">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Coins className="w-3 h-3 text-solana-cyan" />
                  <span>Số dư:</span>
                </span>
                <span className="font-mono text-xs font-bold text-solana-green">{formatSolBalance(solBalance)}</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (onConnectWallet) {
                  onConnectWallet();
                } else {
                  onOpenWalletModal();
                }
              }}
              disabled={isConnectingWallet}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan px-3 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition-all disabled:opacity-70 disabled:cursor-wait"
            >
              {isConnectingWallet ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <PhantomLogo className="h-4 w-4" />
              )}
              <span>{isConnectingWallet ? t('walletModal.connecting') : t('nav.connectWallet')}</span>
            </button>
          )}

          {/* Ngôn ngữ (VI / EN) */}
          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-2.5 text-slate-300 font-medium">
              <Globe className="w-4 h-4 text-solana-cyan shrink-0" />
              <span>Ngôn ngữ (VI / EN)</span>
            </div>
            <LanguageSwitcher />
          </div>

          {/* Nhận SOL / USDC test (Faucet Devnet) */}
          <a
            href={SOLANA_DEVNET_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Nhận SOL test (Faucet)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          </a>

          {/* Ngắt kết nối ví (nếu đã kết nối) */}
          {walletAddress && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onDisconnectWallet?.();
              }}
              className="flex w-full items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                <span>Ngắt kết nối ví</span>
              </div>
              <span className="font-mono text-[10px] text-red-300/80">{shortAddress(walletAddress)}</span>
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  ) : null;

  return (
    <>
    <header className="sticky top-0 z-[80] w-full glass-nav transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Bên trái: Icon Menu Hamburger (Mobile) + Logo Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger Button on Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="inline-flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all shrink-0"
            >
              <Menu className="w-5 h-5 text-solana-cyan" />
            </button>

            {/* Logo Brand */}
            <div
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none shrink-0"
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-solana-purple via-neon-pink to-solana-cyan p-0.5 shadow-lg shadow-solana-purple/30 group-hover:shadow-solana-purple/60 transition-all duration-300">
                <div className="w-full h-full bg-[#0E0924] rounded-[10px] flex items-center justify-center">
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-solana-cyan group-hover:rotate-12 transition-transform duration-300" />
                </div>
                <Sparkles className="w-2.5 h-2.5 text-solana-green absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-extrabold tracking-tight text-white font-display">
                    Uni<span className="text-gradient-solana">Ticket</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 rounded bg-solana-purple/20 text-solana-cyan border border-solana-cyan/30">
                    Devnet
                  </span>
                </div>
                <p className="text-[8px] sm:text-[9px] text-slate-300 font-medium tracking-wider uppercase hidden sm:block">
                  Web3 NFT Ticketing
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-[#150E35]/80 px-2.5 py-1.5 rounded-full border border-white/10 shadow-inner backdrop-blur-md">
            <button
              onClick={() => handleNavClick('home')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                currentPage === 'home'
                  ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Home className={`w-3.5 h-3.5 ${currentPage === 'home' ? 'text-solana-cyan' : 'text-slate-400'}`} />
              <span>{t('nav.home')}</span>
            </button>

            <button
              onClick={() => handleNavClick('events')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                currentPage === 'events'
                  ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${currentPage === 'events' ? 'text-solana-cyan' : 'text-slate-400'}`} />
              <span>{t('nav.events')}</span>
            </button>

            {isOrganizerView ? (
              <>
                <button
                  onClick={() => handleNavClick('organizer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                    currentPage === 'organizer'
                      ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BarChart3 className={`w-3.5 h-3.5 ${currentPage === 'organizer' ? 'text-solana-cyan' : 'text-slate-400'}`} />
                  <span>{t('nav.dashboard')}</span>
                </button>

                {/* Dropdown "Quản lý" gom gọn các tính năng quản lý */}
                <div className="relative" ref={manageDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setManageDropdownOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                      ['organizer-events', 'create-event', 'check-in'].includes(currentPage)
                        ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-solana-cyan" />
                    <span>Quản lý</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${manageDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {manageDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-solana-purple/40 bg-[#0E0924]/95 p-1.5 shadow-2xl shadow-purple-950/80 backdrop-blur-xl z-[90] animate-scaleUp text-left">
                      <button
                        onClick={() => {
                          setManageDropdownOpen(false);
                          handleNavClick('organizer-events');
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                          currentPage === 'organizer-events'
                            ? 'bg-solana-purple/25 text-solana-cyan'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 text-solana-cyan shrink-0" />
                        <span>{t('nav.manageEvents')}</span>
                      </button>

                      <button
                        onClick={() => {
                          setManageDropdownOpen(false);
                          handleNavClick('create-event');
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all mt-0.5 ${
                          currentPage === 'create-event'
                            ? 'bg-solana-purple/25 text-solana-cyan'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-solana-green shrink-0" />
                        <span>{t('nav.createEvent')}</span>
                      </button>

                      <button
                        onClick={() => {
                          setManageDropdownOpen(false);
                          handleNavClick('check-in');
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all mt-0.5 ${
                          currentPage === 'check-in'
                            ? 'bg-solana-purple/25 text-solana-cyan'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <ScanLine className="w-3.5 h-3.5 text-neon-pink shrink-0" />
                        <span>{t('nav.checkIn')}</span>
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      <button
                        onClick={() => {
                          setManageDropdownOpen(false);
                          onToggleViewMode();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-solana-cyan shrink-0" />
                        <span>{t('nav.switchToAttendee')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => handleNavClick('my-tickets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                  currentPage === 'my-tickets'
                    ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Ticket className={`w-3.5 h-3.5 ${currentPage === 'my-tickets' ? 'text-solana-cyan' : 'text-slate-400'}`} />
                <span>{t('nav.myTickets')}</span>
              </button>
            )}
          </nav>

          {/* Right Action (Desktop): Search, Language, Organizer Switch & Cụm Ví */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#150E35]/80 hover:bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-95 shadow-inner"
                title={t('search.title')}
              >
                <Search className="h-3.5 w-3.5 text-solana-cyan" />
                <span className="hidden xl:inline">{t('nav.searchPlaceholder')}</span>
                <kbd className="rounded bg-black/40 px-1 py-0.5 text-[9px] text-slate-400 border border-white/10">{t('nav.searchShortcut')}</kbd>
              </button>
            )}

            <LanguageSwitcher />

            {/* Nút chuyển đổi Chế độ BTC / Về trang người dùng cạnh cụm Ví */}
            {isOrganizerView ? (
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 hover:bg-solana-cyan/20 px-2.5 py-1.5 text-xs font-semibold text-solana-cyan transition-all active:scale-95 shadow-sm"
                title="Quay về trang người dùng"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>Về trang người dùng</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('organizer')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-solana-green/40 bg-solana-green/10 hover:bg-solana-green/20 px-2.5 py-1.5 text-xs font-semibold text-solana-green transition-all active:scale-95 shadow-sm"
                title="Chuyển sang Chế độ Ban Tổ Chức"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-solana-green shrink-0" />
                <span>Chế độ BTC</span>
              </button>
            )}

            {/* CỤM VÍ GÓC PHẢI: Chỉ hiển thị [Chấm xanh Devnet | {balance} SOL] và Nút Địa chỉ ví */}
            {walletAddress ? (
              <div className="flex items-center gap-1.5">
                {/* [Chấm xanh Devnet | {balance} SOL] */}
                <div
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#120B30] border border-solana-purple/40 text-xs font-mono shadow-inner select-none"
                  title="Solana Devnet"
                >
                  <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-solana-cyan">Devnet</span>
                  <span className="text-slate-600">|</span>
                  <span className="font-bold text-white tracking-tight">{formatSolBalance(solBalance)}</span>
                </div>

                {/* Connected Wallet Address Button */}
                <button
                  type="button"
                  onClick={onOpenWalletModal}
                  title={`Ví: ${walletAddress} (Click để xem chi tiết)`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-solana-purple/40 bg-[#120B30] hover:bg-white/10 text-xs font-mono font-bold text-white transition-all shadow-md active:scale-95"
                >
                  <PhantomLogo className="h-3.5 w-3.5 shrink-0" />
                  <span>{shortAddress(walletAddress)}</span>
                </button>

                {/* Disconnect Button */}
                <button
                  type="button"
                  onClick={onDisconnectWallet}
                  title="Ngắt kết nối ví Phantom"
                  aria-label={t('walletModal.disconnect')}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onConnectWallet) {
                    onConnectWallet();
                  } else {
                    onOpenWalletModal();
                  }
                }}
                disabled={isConnectingWallet}
                className="relative group overflow-hidden px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-300 shadow-lg shadow-purple-900/30 hover:shadow-solana-purple/50 active:scale-95 disabled:opacity-75 disabled:cursor-wait"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-solana-purple via-neon-pink to-solana-green opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-[1px] bg-[#120B30] rounded-[11px] group-hover:bg-opacity-0 transition-all duration-300" />
                <div className="relative flex items-center gap-1.5">
                  {isConnectingWallet ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-solana-cyan" />
                  ) : (
                    <PhantomLogo className="h-3.5 w-3.5" />
                  )}
                  <span className="tracking-wide">
                    {isConnectingWallet ? t('walletModal.connecting') : t('nav.connectWallet')}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* Mobile Right Actions: Ngôn ngữ & Nút Ví Phantom */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <div className="scale-90 origin-right">
              <LanguageSwitcher />
            </div>

            {walletAddress ? (
              <button
                type="button"
                onClick={onOpenWalletModal}
                aria-label={`${t('nav.connectedWallet')} ${shortAddress(walletAddress)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-solana-purple/40 bg-[#120B30] px-2 text-white active:scale-95 transition-transform"
                title={`Ví: ${walletAddress}`}
              >
                <PhantomLogo className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-xs font-bold text-white">{shortAddress(walletAddress)}</span>
                <span className="text-[10px] font-mono text-solana-green font-bold pl-1 border-l border-white/10">
                  {formatSolBalance(solBalance)}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onConnectWallet) {
                    onConnectWallet();
                  } else {
                    onOpenWalletModal();
                  }
                }}
                disabled={isConnectingWallet}
                aria-label={t('nav.connectWallet')}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-solana-purple/40 bg-gradient-to-r from-solana-purple to-solana-cyan px-2.5 text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-75"
              >
                {isConnectingWallet ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-solana-cyan" />
                ) : (
                  <PhantomLogo className="h-3.5 w-3.5" />
                )}
                <span>{t('nav.connectWallet')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
    {mobileNavigation}
    </>
  );
};
