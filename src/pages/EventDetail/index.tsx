import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Ticket,
  ChevronDown,
  ChevronUp,
  Tag,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { EventItem, TicketTier } from '../../types';
import { useTranslation } from '../../i18n';

interface EventDetailPageProps {
  event: EventItem | null;
  onBack: () => void;
  onSelectTier: (tier: TicketTier) => void;
  onOpenWalletModal?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({
  event,
  onBack,
  onSelectTier,
}) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const scrollToTiers = () => {
    const el = document.getElementById('ticket-tiers-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!event) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-neon-pink/20 border border-neon-pink/40 flex items-center justify-center text-neon-pink">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">{t('eventDetail.notFound')}</h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md">
          {t('eventDetail.notFoundDesc')}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-solana-purple text-white font-semibold text-xs hover:bg-purple-600 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('eventDetail.backToList')}</span>
        </button>
      </div>
    );
  }

  const tiers = event.tiers || [];
  const remainingTickets = tiers.reduce((sum, t) => sum + t.remainingQuantity, 0);
  const isSoldOut = remainingTickets <= 0;

  // Xử lý mô tả rút gọn
  const descriptionText = event.description || '';
  const isLongDesc = descriptionText.length > 320;
  const displayedDescription = isLongDesc && !isDescExpanded
    ? `${descriptionText.slice(0, 320)}...`
    : descriptionText;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn text-left">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t('eventDetail.backToList')}</span>
      </button>

      {/* Main Event Card Container */}
      <div className="rounded-2xl bg-[#120B30] border border-solana-purple/30 overflow-hidden shadow-2xl">
        {/* Banner lớn */}
        <div className="relative h-64 sm:h-96 w-full overflow-hidden bg-black/60">
          <img
            src={event.bannerImage || event.thumbnailImage}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120B30] via-[#120B30]/50 to-transparent" />

          {/* Badges on Banner */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs font-bold shrink-0">
              <Tag className="w-3.5 h-3.5" />
              <span>{event.category}</span>
            </span>

            <div className="flex items-center gap-2">
              {event.featured && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-600/90 text-white text-xs font-bold backdrop-blur-md shadow-md">
                  <Flame className="w-3.5 h-3.5 text-yellow-300" />
                  <span>{t('common.featured')}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-solana-purple/80 border border-solana-cyan/40 text-solana-cyan text-xs font-bold backdrop-blur-md shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-solana-green" />
                <span>{t('common.nftTicket')}</span>
              </span>
            </div>
          </div>

          {/* Title & Info on bottom banner */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 space-y-2 min-w-0">
            <h1 className="text-xl sm:text-4xl font-extrabold text-white break-words line-clamp-2 sm:line-clamp-none">
              {event.title}
            </h1>
            {event.subtitle && (
              <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-2xl break-words">
                {event.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Thông tin nhanh: Thời gian, Địa điểm, Ban tổ chức, Giá & CTA */}
        <div className="p-5 sm:p-8 space-y-8 min-w-0">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 rounded-xl bg-[#1A1040]/80 border border-white/10 min-w-0">
            {/* Thời gian */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-solana-purple/20 text-solana-purple shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-400">{t('eventDetail.timeLabel')}</div>
                <div className="text-xs sm:text-sm font-bold text-white truncate block">{formatDate(event.date)}</div>
                <div className="text-[11px] text-slate-300 truncate block">{event.time || '19:00'}</div>
              </div>
            </div>

            {/* Địa điểm */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-neon-pink/20 text-neon-pink shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-400">{t('eventDetail.venueLabel')}</div>
                <div className="text-xs sm:text-sm font-bold text-white truncate block">{event.venue}</div>
                <div className="text-[11px] text-slate-300 truncate block">{event.city}</div>
              </div>
            </div>

            {/* Ban tổ chức & Blockchain Badge */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-solana-green/20 text-solana-green shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-slate-400">{t('eventDetail.organizerLabel')}</div>
                <div className="text-xs sm:text-sm font-bold text-white truncate block">
                  {event.organizer?.name || 'UniTicket Verified'}
                </div>
                <div className="text-[11px] text-solana-green font-medium flex items-center gap-1 truncate block">
                  <span>{t('common.blockchainVerified')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row: Giá khởi điểm + Nút CTA "Mua vé ngay" */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-solana-purple/15 via-[#1A1040] to-neon-pink/15 border border-solana-purple/40 shadow-lg">
            <div>
              <span className="text-xs text-slate-300">{t('eventDetail.startingPrice')}</span>
              <div className="text-2xl sm:text-3xl font-black text-solana-cyan">
                {formatCurrency(event.minPriceVnd)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isSoldOut ? t('eventDetail.allSoldOut') : t('eventDetail.availableTickets', { count: remainingTickets })}
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToTiers}
              disabled={isSoldOut}
              className={`px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl transition-all duration-200 active:scale-95 ${
                isSoldOut
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan hover:shadow-solana-purple/60 text-white hover:scale-[1.02]'
              }`}
            >
              <Ticket className="w-5 h-5" />
              <span>{isSoldOut ? t('common.soldOut').toUpperCase() : t('eventDetail.buyNow')}</span>
            </button>
          </div>

          {/* Giới thiệu sự kiện (có Xem thêm / Thu gọn) */}
          <div className="space-y-3 min-w-0 pt-2 border-t border-white/10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-solana-cyan shrink-0" />
              <span>{t('eventDetail.aboutEvent')}</span>
            </h3>
            <div className="text-slate-300 leading-relaxed text-sm sm:text-base whitespace-pre-line break-words">
              {displayedDescription}
            </div>
            {isLongDesc && (
              <button
                type="button"
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-solana-cyan hover:underline mt-1 focus:outline-none"
              >
                <span>{isDescExpanded ? t('common.seeLess') : t('common.seeMore')}</span>
                {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Nghệ sĩ Line-up (nếu có) */}
          {event.lineup && event.lineup.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white">{t('eventDetail.lineup')}</h3>
              <div className="flex flex-wrap gap-2">
                {event.lineup.map((artist, i) => (
                  <span
                    key={i}
                    className="px-3.5 py-1.5 rounded-xl bg-[#1C1242] border border-solana-purple/30 text-xs font-semibold text-slate-200 hover:border-solana-cyan/40 transition-colors"
                  >
                    🎵 {artist}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ban tổ chức (Organizer Card) */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-solana-green shrink-0" />
              <span>{t('eventDetail.organizerTitle')}</span>
            </h3>
            <div className="p-4 rounded-xl bg-[#170E38] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={event.organizer?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                  alt={event.organizer?.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-solana-purple/50 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm sm:text-base font-bold text-white">
                      {event.organizer?.name || 'UniTicket Partner'}
                    </h4>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-solana-green/20 text-[10px] font-bold text-solana-green border border-solana-green/40">
                      ✓ {t('common.verified')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('eventDetail.organizerDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bảng Các Hạng Vé Khả Dụng */}
          <div id="ticket-tiers-section" className="space-y-4 pt-6 border-t border-white/10 scroll-mt-24">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{t('eventDetail.ticketTiersTitle')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('eventDetail.ticketTiersDesc')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map((tier) => {
                const tierSoldOut = tier.remainingQuantity <= 0;
                return (
                  <div
                    key={tier.id}
                    className="p-5 rounded-2xl bg-[#170E38] border border-white/10 hover:border-solana-purple/50 flex flex-col justify-between space-y-4 transition-all min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                        <span className="text-sm font-bold text-white break-words min-w-0 flex-1">
                          {tier.name}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                            tierSoldOut
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-solana-green/10 text-solana-green border border-solana-green/30'
                          }`}
                        >
                          {tierSoldOut ? t('common.soldOut').toUpperCase() : t('common.remainingTickets', { count: tier.remainingQuantity })}
                        </span>
                      </div>

                      <div className="text-2xl font-black text-solana-cyan mb-2">
                        {formatCurrency(tier.priceVnd)}
                      </div>

                      {tier.description && (
                        <p className="text-xs text-slate-300 mb-3 break-words">
                          {tier.description}
                        </p>
                      )}

                      {tier.perks && tier.perks.length > 0 && (
                        <ul className="space-y-1.5 text-xs text-slate-300 min-w-0">
                          {tier.perks.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 min-w-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
                              <span className="break-words min-w-0 flex-1">{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTier(tier)}
                      disabled={tierSoldOut}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 ${
                        tierSoldOut
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-solana-purple to-neon-pink hover:shadow-solana-purple/50 text-white'
                      }`}
                    >
                      {tierSoldOut ? t('common.soldOut').toUpperCase() : t('eventDetail.selectTier')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
