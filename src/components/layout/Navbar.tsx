import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, CalendarDays, Ticket, Sparkles, Menu, X, PlusCircle, Compass, Home, ScanLine } from 'lucide-react';
import { UserRole } from '../../types';
import { PhantomLogo } from '../common/PhantomLogo';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenWalletModal: () => void;
  currentRole: UserRole | null;
  walletAddress: string | null;
}

const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenWalletModal,
  currentRole,
  walletAddress,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    const desktopMedia = window.matchMedia('(min-width: 1280px)');
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

  const navItems = currentRole === 'organizer'
    ? [
        { id: 'home', label: 'Trang Chủ', icon: Home },
        { id: 'events', label: 'Sự Kiện', icon: Compass },
        { id: 'organizer', label: 'Dashboard', icon: BarChart3 },
        { id: 'organizer-events', label: 'Manage Events', icon: CalendarDays },
        { id: 'create-event', label: 'Create Event', icon: PlusCircle },
        { id: 'check-in', label: 'Check-in', icon: ScanLine },
      ]
    : [
        { id: 'home', label: 'Trang Chủ', icon: Home },
        { id: 'events', label: 'Sự Kiện', icon: Compass },
        { id: 'my-tickets', label: 'Vé Của Tôi', icon: Ticket },
      ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const mobileNavigation = mobileMenuOpen ? createPortal(
    <div
      id="mobile-navigation"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 top-16 z-[70] overflow-y-auto overscroll-contain border-t border-solana-purple/20 bg-[#070412]/95 p-4 backdrop-blur-2xl sm:top-20 sm:p-5 xl:hidden"
    >
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6">
        <div className="space-y-2 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`flex min-h-11 w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left text-base font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-lg shadow-purple-900/40'
                    : 'border border-white/5 text-slate-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 text-solana-cyan" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-auto space-y-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenWalletModal();
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan py-3.5 text-base font-bold text-white shadow-xl shadow-purple-950/60 transition-all active:scale-95"
          >
            <PhantomLogo className="h-5 w-5" />
            <span>{walletAddress ? shortAddress(walletAddress) : 'Kết nối Phantom'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
    <header className="sticky top-0 z-[80] w-full glass-nav transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Brand */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none"
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-solana-purple via-neon-pink to-solana-cyan p-0.5 shadow-lg shadow-solana-purple/30 group-hover:shadow-solana-purple/60 transition-all duration-300">
              <div className="w-full h-full bg-[#0E0924] rounded-[10px] flex items-center justify-center">
                <Ticket className="w-4 h-4 sm:w-5 sm:h-5 text-solana-cyan group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <Sparkles className="w-3 h-3 text-solana-green absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-display">
                  Uni<span className="text-gradient-solana">Ticket</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-solana-purple/20 text-solana-green border border-solana-green/30">
                  SOL
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-300 font-medium tracking-wider uppercase">
                Web3 NFT Ticketing
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1 bg-[#150E35]/80 px-3 py-1.5 rounded-full border border-white/10 shadow-inner backdrop-blur-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs lg:text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-solana-purple to-[#6E1FD6] text-white shadow-md shadow-solana-purple/40'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-solana-cyan' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action: Connect Wallet Button */}
          <div className="hidden xl:flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenWalletModal}
              className="relative group overflow-hidden px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-300 shadow-lg shadow-purple-900/30 hover:shadow-solana-purple/50 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-solana-purple via-neon-pink to-solana-green opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-[1px] bg-[#120B30] rounded-[11px] group-hover:bg-opacity-0 transition-all duration-300" />
              <div className="relative flex items-center gap-2">
                <PhantomLogo className="h-4 w-4" />
                <span className="max-w-[150px] truncate tracking-wide">
                  {walletAddress ? shortAddress(walletAddress) : 'Kết nối Phantom'}
                </span>
              </div>
            </button>
            {currentRole === 'organizer' && (
              <span className="rounded-xl border border-solana-green/40 bg-solana-green/10 px-3 py-1.5 text-xs font-semibold text-solana-green">
                Organizer
              </span>
            )}
          </div>

          {/* Mobile Right Actions */}
          <div className="flex xl:hidden items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenWalletModal}
              aria-label={walletAddress ? `Ví Phantom ${shortAddress(walletAddress)}` : 'Kết nối Phantom'}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-solana-purple/40 bg-solana-purple/20 px-2 text-solana-cyan active:scale-95 transition-transform"
            >
              <PhantomLogo className="h-5 w-5" />
              {walletAddress && <span className="max-w-[88px] truncate text-xs font-bold text-white">{shortAddress(walletAddress)}</span>}
            </button>
            <button
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
              aria-label="Toggle Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white active:scale-95 transition-all"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-neon-pink" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

    </header>
    {mobileNavigation}
    </>
  );
};
