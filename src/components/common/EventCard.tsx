import React from 'react';
import { Calendar, MapPin, Sparkles, Flame, ArrowUpRight, Clock } from 'lucide-react';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';
import { formatEventCategory, formatEventCity, getEventStatusBadge } from '../../utils/eventHelpers';

interface EventCardProps {
  event: EventItem;
  onClick: (eventId: string) => void;
  priority?: boolean;
  onNavigateMarketplace?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick, onNavigateMarketplace }) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const remainingTickets = event.tiers?.reduce((sum, t) => sum + t.remainingQuantity, 0) ?? (event.totalTickets - event.soldTickets);
  const isHotSoldOut = event.id === 'event-anh-trai-say-hi-2026' || (event.title && event.title.toLowerCase().includes('anh trai say hi')) || event.status === 'sold_out';
  const isSoldOut = remainingTickets <= 0 || event.soldTickets >= event.totalTickets || isHotSoldOut;

  // Tính khoảng cách thời gian FOMO đến ngày bắt đầu sự kiện
  const countdownText = React.useMemo(() => {
    const rawDate = event.date || (event as any).start_date || (event as any).startDate;
    if (!rawDate) return null;
    try {
      const target = new Date(rawDate).getTime();
      if (isNaN(target)) return null;
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) return 'Đang diễn ra';
      const diffHours = Math.floor(diff / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) {
        return `⏳ Còn ${diffDays} ngày`;
      }
      if (diffHours > 0) {
        return `⏳ Bắt đầu sau ${diffHours} giờ`;
      }
      const diffMins = Math.floor(diff / (1000 * 60));
      return `⏳ Bắt đầu sau ${Math.max(1, diffMins)} phút`;
    } catch {
      return null;
    }
  }, [event.date]);

  // Kiểm tra thời gian xem event có upcoming không (sau ngày hôm nay)
  const isUpcoming = Boolean(event.date);

  const formatPrice = (priceVnd?: number, priceSol?: number) => {
    if (typeof priceVnd === 'number' && priceVnd > 0) {
      return formatCurrency(priceVnd);
    }
    if (typeof priceSol === 'number' && priceSol > 0) {
      return `${priceSol} SOL`;
    }
    return t('common.free');
  };

  return (
    <article
      onClick={() => onClick(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(event.id);
        }
      }}
      className="group relative h-full flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#110A2B]/85 text-left shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-solana-purple/50 hover:bg-[#180E3D] hover:shadow-2xl hover:shadow-purple-950/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-solana-cyan/50"
    >
      {/* Background glow orb on hover */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-solana-purple/10 blur-2xl transition-all duration-500 group-hover:bg-solana-purple/25" />

      {/* Khung ảnh Thumbnail cố định tỷ lệ aspect-video */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        <img
          src={event.thumbnailImage || event.bannerImage}
          alt={event.title}
          loading="lazy"
          className={`h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105 ${
            isSoldOut ? 'opacity-65 grayscale-[25%]' : ''
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-transparent to-black/30" />

        {/* Badges top left */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
          {/* Category */}
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-solana-cyan backdrop-blur-md border border-white/15">
            {formatEventCategory(event.category)}
          </span>

          {/* Featured badge */}
          {event.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md shadow-sm">
              <Flame className="h-3 w-3 text-yellow-300" />
              <span>{t('common.featured')}</span>
            </span>
          )}

          {/* FOMO Countdown badge */}
          {countdownText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-900/90 px-2 py-0.5 text-[10px] font-bold text-yellow-300 backdrop-blur-md border border-yellow-400/40 shadow-sm animate-pulse">
              <Clock className="h-2.5 w-2.5 text-yellow-300" />
              <span>{countdownText}</span>
            </span>
          )}
        </div>

        {/* Badges top right: Huy hiệu SOLD OUT hoặc NFT Ticket */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {isSoldOut ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-lg shadow-red-950/60 backdrop-blur-md border border-red-400/50 animate-pulse"
              title="HẾT VÉ (SOLD OUT)"
            >
              <span>🔥 SOLD OUT</span>
              <span className="sr-only">HẾT VÉ (SOLD OUT)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-solana-purple/80 px-2.5 py-1 text-[10px] font-bold text-solana-cyan backdrop-blur-md border border-solana-cyan/30 shadow-md">
              <Sparkles className="h-3 w-3 text-solana-green" />
              <span>{t('common.nftTicket')}</span>
            </span>
          )}
        </div>

        {/* Badges bottom */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          {(() => {
            const badge = getEventStatusBadge(event.status, isSoldOut, isUpcoming);
            if (!badge) return null;
            return (
              <span className={`rounded-lg ${badge.bgClass} ${badge.textClass} px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md border ${badge.borderClass}`}>
                {badge.label}
              </span>
            );
          })()}

          <span className="ml-auto rounded-lg bg-black/85 px-2.5 py-1 text-xs font-bold text-solana-green shadow-md backdrop-blur-md border border-solana-green/40">
            {t('hero.startingFrom')} {formatPrice(event.minPriceVnd, event.minPriceSol)}
          </span>
        </div>
      </div>

      {/* Nội dung thông tin sự kiện căn chỉnh đều nhau */}
      <div className="flex-1 flex flex-col justify-between p-4">
        {/* Title & Description with line-clamp */}
        <div className="space-y-1.5 min-w-0">
          <h3 className="h-14 line-clamp-2 font-bold break-words text-base text-white transition-colors duration-200 group-hover:text-solana-cyan sm:text-lg">
            {event.title}
          </h3>
          <p className="h-10 line-clamp-2 text-sm text-gray-400 break-words leading-relaxed">
            {event.subtitle || event.description}
          </p>
        </div>

        {/* Ghìm chân thẻ xuống đáy: Metadata & Footer CTA */}
        <div className="mt-4 flex flex-col justify-end">
          {/* Event metadata */}
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-solana-purple/20 text-solana-purple">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <span className="truncate font-medium text-slate-200">{formatDate(event.date)} {event.time ? `• ${event.time}` : ''}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neon-pink/20 text-neon-pink">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="truncate font-medium text-slate-200">{event.venue}, {formatEventCity(event.city)}</span>
            </div>
          </div>

          {/* Footer CTA: Đồng nhất 1 dòng duy nhất cho mọi thẻ */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs gap-2">
            <span className="text-[11px] text-slate-400 truncate">
              {event.organizer?.name ? `${t('hero.organizedBy')}: ${event.organizer.name}` : 'UniTicket Web3'}
            </span>
            {isSoldOut ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigateMarketplace) {
                    onNavigateMarketplace();
                  } else if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('uniticket-navigate', { detail: 'marketplace' }));
                    window.location.hash = '#/marketplace';
                  }
                }}
                className="inline-flex items-center gap-1 font-semibold text-neon-pink hover:text-pink-300 transition-colors shrink-0"
                title="Săn vé trên Chợ Vé →"
              >
                <span>Săn vé Chợ</span>
                <span className="sr-only">Săn vé trên Chợ Vé →</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-solana-purple group-hover:text-solana-cyan transition-colors shrink-0">
                <span>{t('common.viewDetails')}</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
