import React from 'react';
import { ArrowRight } from 'lucide-react';
import { EventItem } from '../../types';
import { EventCard } from '../common/EventCard';
import { useTranslation } from '../../i18n';

interface EventSectionGroupProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'purple' | 'cyan' | 'pink' | 'green';
  events: EventItem[];
  onSelectEvent: (eventId: string) => void;
  onViewAll?: () => void;
}

export const EventSectionGroup: React.FC<EventSectionGroupProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'purple',
  events,
  onSelectEvent,
  onViewAll,
}) => {
  const { t } = useTranslation();

  if (events.length === 0) return null;

  const badgeStyles = {
    purple: 'bg-solana-purple/20 border-solana-purple/40 text-solana-cyan',
    cyan: 'bg-solana-cyan/20 border-solana-cyan/40 text-solana-cyan',
    pink: 'bg-neon-pink/20 border-neon-pink/40 text-pink-300',
    green: 'bg-solana-green/20 border-solana-green/40 text-solana-green',
  }[badgeColor];

  return (
    <section className="py-8 sm:py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
          <div>
            {badge && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[11px] font-semibold mb-2 ${badgeStyles}`}>
                <span>{badge}</span>
              </div>
            )}
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-solana-cyan hover:text-white transition-colors group self-start sm:self-auto py-1"
            >
              <span>{t('eventSections.viewAll', { count: events.length })}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {events.slice(0, 8).map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={onSelectEvent}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
