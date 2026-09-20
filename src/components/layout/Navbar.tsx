import React, { useState, useEffect } from 'react';
import { BarChart3, CalendarDays, Ticket, Sparkles, Menu, X, Wallet, PlusCircle, Compass, Home, ScanLine } from 'lucide-react';
import { UserRole } from '../../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenWalletModal: () => void;
  onOpenRoleSelection: () => void;
  currentRole: UserRole | null;
  walletAddress: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onOpenWalletModal,
  onOpenRoleSelection,
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

  return (
    <header className="sticky top-0 z-50 w-full glass-nav transition-all duration-300">
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
                <Wallet className="w-4 h-4 text-solana-cyan group-hover:text-white transition-colors" />
                <span className="max-w-[150px] truncate tracking-wide">
                  {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Connect Wallet'}
                </span>
              </div>
            </button>
            {currentRole && (
              <button
                onClick={onOpenRoleSelection}
                className="rounded-xl border border-solana-cyan/30 bg-solana-cyan/10 px-3 py-2 text-xs font-semibold text-solana-cyan hover:bg-solana-cyan/20"
              >
                Switch Role
              </button>
            )}
          </div>

          {/* Mobile Right Actions */}
          <div className="flex xl:hidden items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenWalletModal}
              aria-label="Connect Wallet"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-solana-purple/40 bg-solana-purple/20 text-solana-cyan active:scale-95 transition-transform"
            >
              <Wallet className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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

      {/* Mobile Drawer Menu với Backdrop Blur cao cấp */}
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="xl:hidden fixed inset-x-0 top-16 sm:top-20 bottom-0 bg-[#070412]/95 backdrop-blur-2xl z-40 p-4 sm:p-5 space-y-3 overflow-y-auto overscroll-contain animate-fadeIn border-t border-solana-purple/20">
          <div className="space-y-2 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base font-semibold text-left transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-lg shadow-purple-900/40'
                      : 'text-slate-200 hover:text-white hover:bg-white/5 border border-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 text-solana-cyan" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-6 border-t border-white/10 space-y-3">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenWalletModal();
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 active:scale-95 transition-all"
            >
              <Wallet className="w-5 h-5 text-white" />
              <span>Connect Wallet (Solana)</span>
            </button>
            {currentRole && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenRoleSelection();
                }}
                className="w-full rounded-xl border border-solana-cyan/30 bg-solana-cyan/10 py-3.5 text-base font-bold text-solana-cyan active:scale-95"
              >
                Switch Role ({currentRole === 'organizer' ? 'Organizer' : 'Attendee'})
              </button>
            )}
            <p className="text-center text-xs text-slate-400">
              Giao diện Frontend Phase 1 • Cuộc thi UniHackFest
            </p>
          </div>
        </div>
      )}
    </header>
  );
};
