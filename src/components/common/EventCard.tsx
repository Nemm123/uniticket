import React from 'react';
import { Calendar, MapPin, Sparkles, Flame, ArrowUpRight } from 'lucide-react';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';

interface EventCardProps {
  event: EventItem;
  onClick: (eventId: string) => void;
  priority?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const remainingTickets = event.tiers?.reduce((sum, t) => sum + t.remainingQuantity, 0) ?? (event.totalTickets - event.soldTickets);
  const isSoldOut = remainingTickets <= 0 || event.soldTickets >= event.totalTickets;

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
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#110A2B]/85 p-3.5 sm:p-4 text-left shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-solana-purple/50 hover:bg-[#180E3D] hover:shadow-2xl hover:shadow-purple-950/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-solana-cyan/50"
    >
      {/* Background glow orb on hover */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-solana-purple/10 blur-2xl transition-all duration-500 group-hover:bg-solana-purple/25" />

      <div>
        {/* Event Thumbnail with badges */}
        <div className="relative mb-3.5 h-44 sm:h-52 w-full overflow-hidden rounded-xl bg-black/40">
          <img
            src={event.thumbnailImage || event.bannerImage}
            alt={event.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-transparent to-black/30" />

          {/* Badges top left */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
            {/* Category */}
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-solana-cyan backdrop-blur-md border border-white/15">
              {event.category}
            </span>

            {/* Featured badge */}
            {event.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md shadow-sm">
                <Flame className="h-3 w-3 text-yellow-300" />
                <span>{t('common.featured')}</span>
              </span>
            )}
          </div>

          {/* Badges top right: NFT Ticket badge */}
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-solana-purple/80 px-2.5 py-1 text-[10px] font-bold text-solana-cyan backdrop-blur-md border border-solana-cyan/30 shadow-md">
              <Sparkles className="h-3 w-3 text-solana-green" />
              <span>{t('common.nftTicket')}</span>
            </span>
          </div>

          {/* Badges bottom */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
            {isSoldOut ? (
              <span className="rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">
                {t('common.soldOut')}
              </span>
            ) : isUpcoming ? (
              <span className="rounded-lg bg-solana-purple/70 px-2 py-0.5 text-[11px] font-semibold text-purple-200 backdrop-blur-md border border-solana-purple/30">
                {t('common.upcoming')}
              </span>
            ) : null}

            <span className="ml-auto rounded-lg bg-black/85 px-2.5 py-1 text-xs font-bold text-solana-green shadow-md backdrop-blur-md border border-solana-green/40">
              {t('hero.startingFrom')} {formatPrice(event.minPriceVnd, event.minPriceSol)}
            </span>
          </div>
        </div>

        {/* Title & subtitle */}
        <div className="space-y-1.5 min-w-0">
          <h3 className="line-clamp-2 break-words text-base font-bold text-white transition-colors duration-200 group-hover:text-solana-cyan sm:text-lg">
            {event.title}
          </h3>
          <p className="line-clamp-2 break-words text-xs leading-relaxed text-slate-300">
            {event.subtitle || event.description}
          </p>
        </div>

        {/* Event metadata */}
        <div className="mt-3 space-y-1.5 text-xs text-slate-300">
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
            <span className="truncate font-medium text-slate-200">{event.venue}, {event.city}</span>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          {event.organizer?.name ? `${t('hero.organizedBy')}: ${event.organizer.name}` : 'UniTicket Web3'}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-solana-purple group-hover:text-solana-cyan transition-colors">
          <span>{t('common.viewDetails')}</span>
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </article>
  );
};
