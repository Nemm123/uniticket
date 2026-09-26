import React, { useState, useMemo } from 'react';
import { Sparkles, ArrowRight, Ticket } from 'lucide-react';
import { HeroSection } from '../../components/home/HeroSection';
import { CategoryExplore } from '../../components/home/CategoryExplore';
import { CityExplore } from '../../components/home/CityExplore';
import { EventSectionGroup } from '../../components/home/EventSectionGroup';
import { NFTBenefits } from '../../components/home/NFTBenefits';
import { EventCard } from '../../components/common/EventCard';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';

interface HomePageProps {
  events: EventItem[];
  onNavigate: (page: string, eventId?: string) => void;
  onFilterByCategory?: (category: string) => void;
  onFilterByCity?: (city: string) => void;
}

type TabId = 'all' | 'music' | 'web3' | 'art' | 'workshop';

interface TabItem {
  id: TabId;
  labelKey: string;
}

const TABS: TabItem[] = [
  { id: 'all', labelKey: 'eventSections.allTab' },
  { id: 'music', labelKey: 'eventSections.musicTab' },
  { id: 'web3', labelKey: 'eventSections.web3Tab' },
  { id: 'art', labelKey: 'eventSections.artTab' },
  { id: 'workshop', labelKey: 'eventSections.workshopTab' },
];

const isMusicCategory = (cat?: string): boolean => {
  if (!cat) return false;
  const c = cat.toLowerCase().trim();
  return (
    c === 'nhạc sống' ||
    c === 'concert' ||
    c === 'edm festival' ||
    c === 'rock arena' ||
    c === 'dj night' ||
    c === 'music' ||
    c === 'live music'
  );
};

const isWeb3Category = (cat?: string): boolean => {
  if (!cat) return false;
  const c = cat.toLowerCase().trim();
  return (
    c === 'web3' ||
    c === 'công nghệ' ||
    c === 'web3 hackathon' ||
    c === 'tech' ||
    c === 'technology'
  );
};

const isArtCategory = (cat?: string): boolean => {
  if (!cat) return false;
  const c = cat.toLowerCase().trim();
  return (
    c === 'sân khấu & nghệ thuật' ||
    c === 'sân khấu' ||
    c === 'nghệ thuật' ||
    c === 'theater & art' ||
    c === 'theater' ||
    c === 'art'
  );
};

const isWorkshopCategory = (cat?: string): boolean => {
  if (!cat) return false;
  const c = cat.toLowerCase().trim();
  return (
    c === 'hội thảo & workshop' ||
    c === 'hội thảo' ||
    c === 'workshop' ||
    c === 'seminar' ||
    c === 'seminars'
  );
};

export const HomePage: React.FC<HomePageProps> = ({
  events,
  onNavigate,
  onFilterByCategory,
  onFilterByCity,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Sự kiện nổi bật (deduplicate theo ID, giới hạn 4 cards)
  const featuredEvents = useMemo(() => {
    const list = events.filter((e) => e.featured);
    const selected = list.length > 0 ? list : events;
    const seen = new Set<string>();
    const unique: EventItem[] = [];
    for (const item of selected) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique;
  }, [events]);

  // Tabbed Event Discovery Showcase (Lọc client-side thuần túy, deduplicate theo ID)
  const tabFilteredEvents = useMemo(() => {
    let filtered: EventItem[] = [];
    switch (activeTab) {
      case 'music':
        filtered = events.filter((e) => isMusicCategory(e.category));
        break;
      case 'web3':
        filtered = events.filter((e) => isWeb3Category(e.category));
        break;
      case 'art':
        filtered = events.filter((e) => isArtCategory(e.category));
        break;
      case 'workshop':
        filtered = events.filter((e) => isWorkshopCategory(e.category));
        break;
      case 'all':
      default:
        filtered = events;
        break;
    }

    const seen = new Set<string>();
    const unique: EventItem[] = [];
    for (const item of filtered) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique;
  }, [events, activeTab]);

  const handleSelectEvent = (eventId: string) => {
    onNavigate('event-detail', eventId);
  };

  const handleCategoryClick = (categoryName: string) => {
    if (onFilterByCategory) {
      onFilterByCategory(categoryName);
    } else {
      onNavigate('events');
    }
  };

  const handleCityClick = (cityName: string) => {
    if (onFilterByCity) {
      onFilterByCity(cityName);
    } else {
      onNavigate('events');
    }
  };

  return (
    <div className="min-h-screen">
      {/* 1. Hero Section với banner carousel các sự kiện nổi bật */}
      <HeroSection
        featuredEvents={featuredEvents}
        featuredEvent={featuredEvents[0] || events[0]}
        onExploreClick={() => onNavigate('events')}
        onSelectEvent={handleSelectEvent}
      />

      {/* 2. Khám phá theo thể loại (8 categories) */}
      <CategoryExplore onSelectCategory={handleCategoryClick} />

      {/* 3. Khám phá theo thành phố (TP. HCM, Hà Nội, Đà Nẵng, Khác) */}
      <CityExplore onSelectCity={handleCityClick} />

      {/* 4. Section: Sự kiện nổi bật */}
      {featuredEvents.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.featuredTitle')}
          subtitle={t('eventSections.featuredSubtitle')}
          badge={t('eventSections.featuredBadge')}
          badgeColor="pink"
          events={featuredEvents}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => onNavigate('events')}
        />
      )}

      {/* 5. Event Discovery Showcase (Tabs) */}
      <section id="event-showcase-section" className="py-8 sm:py-12 relative z-10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header with Tabs */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[11px] font-semibold mb-2 bg-solana-cyan/20 border-solana-cyan/40 text-solana-cyan">
                <Sparkles className="w-3.5 h-3.5 text-solana-green" />
                <span>{t('eventSections.showcaseBadge')}</span>
              </div>
              <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                {t('eventSections.showcaseTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                {t('eventSections.showcaseSubtitle')}
              </p>
            </div>

            {/* Tab Bar: Horizontal scrollable on mobile, wrapping on sm+ */}
            <div
              role="tablist"
              aria-label="Event categories"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-solana-cyan/50 ${
                      isActive
                        ? 'bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-lg shadow-purple-900/40 border border-transparent'
                        : 'bg-[#150E35] text-slate-300 hover:text-white hover:bg-[#20154F] border border-white/10'
                    }`}
                  >
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content: Event Cards Grid or Empty State */}
          {tabFilteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {tabFilteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={handleSelectEvent}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 px-4 rounded-2xl border border-white/10 bg-[#120B30]/60 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-solana-purple/20 text-solana-cyan flex items-center justify-center mx-auto">
                <Ticket className="w-6 h-6" />
              </div>
              <p className="text-sm text-slate-300 font-medium">
                {t('eventSections.emptyCategory')}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="px-4 py-2 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/40 text-solana-cyan text-xs font-semibold border border-solana-purple/40 transition-colors"
              >
                {t('eventSections.allTab')}
              </button>
            </div>
          )}

          {/* Footer View All CTA */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate('events')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 hover:bg-solana-cyan/20 text-solana-cyan hover:text-white text-xs sm:text-sm font-semibold transition-all duration-200 group"
            >
              <span>{t('eventSections.viewAllEvents')}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. NFT Benefits Section */}
      <NFTBenefits />
    </div>
  );
};
