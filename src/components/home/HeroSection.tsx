import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, MapPin, Sparkles, Flame, ArrowRight, Shield, Zap, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';

interface HeroSectionProps {
  featuredEvents?: EventItem[];
  featuredEvent?: EventItem;
  onExploreClick: () => void;
  onSelectEvent: (eventId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  featuredEvents,
  featuredEvent,
  onExploreClick,
  onSelectEvent,
}) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  // Lấy danh sách sự kiện nổi bật cho carousel (nếu truyền mảng thì dùng mảng, fallback về 1 event)
  const items = featuredEvents && featuredEvents.length > 0
    ? featuredEvents
    : featuredEvent
      ? [featuredEvent]
      : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const activeEvent = items[currentIndex] || featuredEvent;

  const nextSlide = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevSlide = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  // Auto slide mỗi 5s khi không hover
  useEffect(() => {
    if (isPaused || items.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, items.length]);

  // Swipe gesture trên mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) {
      nextSlide();
    } else if (distance < -50) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Live countdown timer trang trí cho Web3 vibe
  const [timeLeft, setTimeLeft] = useState({
    days: 38,
    hours: 14,
    minutes: 26,
    seconds: 45,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden pt-4 pb-12 sm:pt-6 sm:pb-16 lg:py-20 cyber-grid-bg">
      {/* Background Neon Glow Orbs */}
      <div className="ambient-glow-purple -top-10 -left-20" />
      <div className="ambient-glow-pink top-1/2 -right-20" />
      <div className="ambient-glow-cyan -bottom-20 left-1/3" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Heading & Call to action */}
          <div className="lg:col-span-6 space-y-5 lg:space-y-6 text-left">
            {/* Solana Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-solana-green animate-pulse" />
              <span>{t('hero.badge')}</span>
            </div>

            {/* Main Catchy Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.2] sm:leading-[1.15]">
              {t('hero.title1')} <br className="hidden sm:inline" />
              <span className="text-gradient-solana">{t('hero.titleGradient')}</span> {t('hero.title2')}
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-200 max-w-xl leading-relaxed font-normal">
              {t('hero.subtitle')}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={onExploreClick}
                className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-purple-900/40 hover:shadow-solana-purple/60 hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                <span>{t('hero.exploreEvents')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {activeEvent && (
                <button
                  onClick={() => onSelectEvent(activeEvent.id)}
                  className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-[#18113B] hover:bg-[#231852] border border-solana-purple/40 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 hover:border-solana-cyan/60 active:scale-95 transition-all duration-200"
                >
                  <Ticket className="w-4 h-4 text-solana-cyan" />
                  <span>{t('hero.viewDetails')}</span>
                </button>
              )}
            </div>

            {/* Live Stats Row */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-white/10 max-w-lg">
              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-white font-display">
                  100%
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Shield className="w-3.5 h-3.5 text-solana-green shrink-0" />
                  <span>{t('hero.antiScalping')}</span>
                </div>
              </div>

              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-solana-green font-display">
                  &lt; 0.5s
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>{t('hero.speed')}</span>
                </div>
              </div>

              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-neon-pink font-display">
                  50,000+
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Flame className="w-3.5 h-3.5 text-neon-pink shrink-0" />
                  <span>{t('hero.ticketsIssued')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Carousel sự kiện nổi bật */}
          <div className="lg:col-span-6 mt-4 lg:mt-0">
            {activeEvent && (
              <div
                className="relative group"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Outer Neon Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan rounded-3xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />

                <div className="relative rounded-2xl bg-[#110A2B] border border-white/15 p-4 sm:p-6 shadow-2xl overflow-hidden text-left">
                  {/* Event Cover Image */}
                  <div className="relative h-52 sm:h-64 rounded-xl overflow-hidden mb-4 sm:mb-5 bg-black/50">
                    <img
                      src={activeEvent.bannerImage || activeEvent.thumbnailImage}
                      alt={activeEvent.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-[#110A2B]/40 to-transparent" />

                    {/* Hot Badge */}
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold shadow-lg">
                      <Flame className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                      <span>{t('hero.featuredBadge')}</span>
                    </div>

                    {/* Price Tag */}
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs sm:text-sm font-bold shadow-md">
                      {t('hero.startingFrom')} {formatCurrency(activeEvent.minPriceVnd)}
                    </div>

                    {/* Previous / Next buttons */}
                    {items.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-solana-purple/80 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all opacity-80 hover:opacity-100 active:scale-95"
                          aria-label="Previous slide"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 hover:bg-solana-purple/80 text-white flex items-center justify-center backdrop-blur-md border border-white/15 transition-all opacity-80 hover:opacity-100 active:scale-95"
                          aria-label="Next slide"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-solana-purple/30 border border-solana-purple/40 text-xs font-semibold text-solana-cyan">
                        {activeEvent.category}
                      </span>
                      {activeEvent.organizer?.name && (
                        <span className="text-[11px] text-slate-400">
                          {t('hero.organizedBy')}: <strong className="text-white">{activeEvent.organizer.name}</strong>
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-2xl font-bold text-white leading-snug group-hover:text-solana-cyan transition-colors line-clamp-2 break-words">
                      {activeEvent.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed break-words">
                      {activeEvent.subtitle || activeEvent.description}
                    </p>

                    <div className="flex flex-col gap-1.5 pt-1 text-xs text-slate-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-md bg-solana-purple/20 text-solana-purple shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate min-w-0 block font-medium">{formatDate(activeEvent.date)} {activeEvent.time ? `• ${activeEvent.time}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-md bg-neon-pink/20 text-neon-pink shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate min-w-0 block font-medium">{activeEvent.venue}, {activeEvent.city}</span>
                      </div>
                    </div>

                    {/* Countdown Timer Boxes */}
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 min-w-0">
                        <Sparkles className="w-3 h-3 text-yellow-400 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                        <span className="truncate">{t('hero.countdownTitle')}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                          <span className="block text-base sm:text-xl font-black text-white font-display truncate">
                            {timeLeft.days}
                          </span>
                          <span className="text-[9px] uppercase text-slate-400 font-medium block truncate">{t('hero.days')}</span>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                          <span className="block text-base sm:text-xl font-black text-white font-display truncate">
                            {String(timeLeft.hours).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] uppercase text-slate-400 font-medium block truncate">{t('hero.hours')}</span>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                          <span className="block text-base sm:text-xl font-black text-white font-display truncate">
                            {String(timeLeft.minutes).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] uppercase text-slate-400 font-medium block truncate">{t('hero.minutes')}</span>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-[#1A1040] border border-solana-green/40 shadow-sm shadow-solana-green/20 min-w-0 overflow-hidden">
                          <span className="block text-base sm:text-xl font-black text-solana-green font-display truncate">
                            {String(timeLeft.seconds).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] uppercase text-solana-green font-medium block truncate">{t('hero.seconds')}</span>
                        </div>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={() => onSelectEvent(activeEvent.id)}
                      className="w-full mt-2 sm:mt-3 py-3 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink hover:from-[#8123E5] hover:to-[#E5006C] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 active:scale-95 transition-all duration-200"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>{t('hero.bookTicket')}</span>
                    </button>

                    {/* Pagination Dots */}
                    {items.length > 1 && (
                      <div className="flex items-center justify-center gap-1.5 pt-2">
                        {items.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Go to slide ${idx + 1}`}
                            className={`h-2 rounded-full transition-all duration-300 ${
                              currentIndex === idx
                                ? 'w-6 bg-gradient-to-r from-solana-purple to-solana-cyan'
                                : 'w-2 bg-white/20 hover:bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
