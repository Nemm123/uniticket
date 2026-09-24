import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Sparkles, Flame, ArrowRight, Shield, Zap, Ticket } from 'lucide-react';
import { EventItem } from '../../types';

interface HeroSectionProps {
  featuredEvent: EventItem;
  onExploreClick: () => void;
  onSelectEvent: (eventId: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  featuredEvent,
  onExploreClick,
  onSelectEvent,
}) => {
  // Countdown Timer sống động (đếm ngược thời gian thực tế)
  const [timeLeft, setTimeLeft] = useState({
    days: 38,
    hours: 14,
    minutes: 26,
    seconds: 45,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
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
          <div className="lg:col-span-7 space-y-5 lg:space-y-6 text-left">
            {/* Solana Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-solana-green animate-pulse" />
              <span>CÔNG NGHỆ VÉ NFT TIÊN PHONG TRÊN SOLANA</span>
            </div>

            {/* Main Catchy Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.2] sm:leading-[1.15]">
              Sở Hữu Vé Concert <br className="hidden sm:inline" />
              <span className="text-gradient-solana">Độc Bản NFT</span> Không Lo Vé Giả
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-200 max-w-2xl leading-relaxed font-normal">
              Nền tảng phát hành vé sự kiện & hòa nhạc Web3 thế hệ mới. Vé được bảo chứng bằng hợp đồng thông minh trên Solana, chống đầu cơ gian lận, cho phép sưu tầm kỷ niệm kỹ thuật số vĩnh viễn.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={onExploreClick}
                className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-purple-900/40 hover:shadow-solana-purple/60 hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                <span>Khám Phá Sự Kiện</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectEvent(featuredEvent.id)}
                className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-[#18113B] hover:bg-[#231852] border border-solana-purple/40 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 hover:border-solana-cyan/60 active:scale-95 transition-all duration-200"
              >
                <Ticket className="w-4 h-4 text-solana-cyan" />
                <span>Xem Concert Nổi Bật</span>
              </button>
            </div>

            {/* Live Stats Row */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-white/10 max-w-lg">
              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-white font-display">
                  100%
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Shield className="w-3.5 h-3.5 text-solana-green shrink-0" />
                  <span>Chống vé giả</span>
                </div>
              </div>

              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-solana-green font-display">
                  &lt; 0.5s
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span>Tốc độ Solana</span>
                </div>
              </div>

              <div className="p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent">
                <div className="text-xl sm:text-3xl font-extrabold text-neon-pink font-display">
                  50,000+
                </div>
                <div className="text-[11px] sm:text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                  <Flame className="w-3.5 h-3.5 text-neon-pink shrink-0" />
                  <span>Vé phát hành</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Featured Event Card with Real-time Countdown */}
          <div className="lg:col-span-5 mt-4 lg:mt-0">
            <div className="relative group">
              {/* Outer Neon Glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan rounded-3xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />

              <div className="relative rounded-2xl bg-[#110A2B] border border-white/15 p-4 sm:p-6 shadow-2xl overflow-hidden">
                {/* Event Cover Image */}
                <div className="relative h-48 sm:h-64 rounded-xl overflow-hidden mb-4 sm:mb-5">
                  <img
                    src={featuredEvent.bannerImage}
                    alt={featuredEvent.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-[#110A2B]/40 to-transparent" />

                  {/* Hot Badge */}
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/90 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold shadow-lg">
                    <Flame className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                    <span>SỰ KIỆN NỔI BẬT NHẤT</span>
                  </div>

                  {/* Price Tag */}
                  <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs sm:text-sm font-bold shadow-md">
                    Chỉ từ {featuredEvent.minPriceVnd !== undefined ? `${featuredEvent.minPriceVnd.toLocaleString('vi-VN')} ₫` : 'Chưa cập nhật'}
                  </div>
                </div>

                {/* Event Details */}
                <div className="space-y-3 min-w-0">
                  <h3 className="text-lg sm:text-2xl font-bold text-white leading-snug group-hover:text-solana-cyan transition-colors line-clamp-2 break-words">
                    {featuredEvent.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed break-words">
                    {featuredEvent.subtitle}
                  </p>

                  <div className="flex flex-col gap-1.5 pt-1 text-xs text-slate-300">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-md bg-solana-purple/20 text-solana-purple shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate min-w-0 block font-medium">{featuredEvent.date} • {featuredEvent.time}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-md bg-neon-pink/20 text-neon-pink shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate min-w-0 block font-medium">{featuredEvent.venue}, {featuredEvent.city}</span>
                    </div>
                  </div>

                  {/* Countdown Timer Boxes */}
                  <div className="pt-2 sm:pt-3">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3 h-3 text-yellow-400 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                      <span className="truncate">Thời Gian Đếm Ngược Đến Khai Mạc:</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                      <div className="p-1.5 sm:p-2.5 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                        <span className="block text-base sm:text-2xl font-black text-white font-display truncate">
                          {timeLeft.days}
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-medium block truncate">Ngày</span>
                      </div>
                      <div className="p-1.5 sm:p-2.5 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                        <span className="block text-base sm:text-2xl font-black text-white font-display truncate">
                          {String(timeLeft.hours).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-medium block truncate">Giờ</span>
                      </div>
                      <div className="p-1.5 sm:p-2.5 rounded-xl bg-[#1A1040] border border-solana-purple/30 min-w-0 overflow-hidden">
                        <span className="block text-base sm:text-2xl font-black text-white font-display truncate">
                          {String(timeLeft.minutes).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase text-slate-400 font-medium block truncate">Phút</span>
                      </div>
                      <div className="p-1.5 sm:p-2.5 rounded-xl bg-[#1A1040] border border-solana-green/40 shadow-sm shadow-solana-green/20 min-w-0 overflow-hidden">
                        <span className="block text-base sm:text-2xl font-black text-solana-green font-display truncate">
                          {String(timeLeft.seconds).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] sm:text-[10px] uppercase text-solana-green font-medium block truncate">Giây</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => onSelectEvent(featuredEvent.id)}
                    className="w-full mt-2 sm:mt-3 py-3 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink hover:from-[#8123E5] hover:to-[#E5006C] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 active:scale-95 transition-all duration-200"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Đặt Mua Vé NFT Ngay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
