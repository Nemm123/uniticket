import React, { useMemo } from 'react';
import { HeroSection } from '../../components/home/HeroSection';
import { CategoryExplore } from '../../components/home/CategoryExplore';
import { CityExplore } from '../../components/home/CityExplore';
import { EventSectionGroup } from '../../components/home/EventSectionGroup';
import { NFTBenefits } from '../../components/home/NFTBenefits';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';

interface HomePageProps {
  events: EventItem[];
  onNavigate: (page: string, eventId?: string) => void;
  onFilterByCategory?: (category: string) => void;
  onFilterByCity?: (city: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  events,
  onNavigate,
  onFilterByCategory,
  onFilterByCity,
}) => {
  const { t } = useTranslation();

  // Nhóm sự kiện
  const featuredEvents = useMemo(() => {
    const list = events.filter((e) => e.featured);
    return list.length > 0 ? list : events.slice(0, 3);
  }, [events]);

  const liveMusicEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.category === 'Nhạc sống' ||
        e.category === 'Concert' ||
        e.category === 'EDM Festival' ||
        e.category === 'Rock Arena' ||
        e.category === 'DJ Night'
    );
  }, [events]);

  const theaterAndArtEvents = useMemo(() => {
    return events.filter((e) => e.category === 'Sân khấu & Nghệ thuật');
  }, [events]);

  const workshopEvents = useMemo(() => {
    return events.filter((e) => e.category === 'Hội thảo & Workshop');
  }, [events]);

  const toursEvents = useMemo(() => {
    return events.filter((e) => e.category === 'Tham quan & Trải nghiệm');
  }, [events]);

  const techWeb3Events = useMemo(() => {
    return events.filter(
      (e) =>
        e.category === 'Web3' ||
        e.category === 'Công nghệ' ||
        e.category === 'Web3 Hackathon'
    );
  }, [events]);

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

      {/* 5. Section: Nhạc sống & Concert */}
      {liveMusicEvents.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.liveMusicTitle')}
          subtitle={t('eventSections.liveMusicSubtitle')}
          badge={t('eventSections.liveMusicBadge')}
          badgeColor="purple"
          events={liveMusicEvents}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => handleCategoryClick('Nhạc sống')}
        />
      )}

      {/* 6. Section: Web3 & Công nghệ */}
      {techWeb3Events.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.web3Title')}
          subtitle={t('eventSections.web3Subtitle')}
          badge={t('eventSections.web3Badge')}
          badgeColor="cyan"
          events={techWeb3Events}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => handleCategoryClick('Web3')}
        />
      )}

      {/* 7. Section: Sân khấu & Nghệ thuật (nếu có sự kiện) */}
      {theaterAndArtEvents.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.theaterTitle')}
          subtitle={t('eventSections.theaterSubtitle')}
          badge={t('eventSections.theaterBadge')}
          badgeColor="green"
          events={theaterAndArtEvents}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => handleCategoryClick('Sân khấu & Nghệ thuật')}
        />
      )}

      {/* 8. Section: Hội thảo & Workshop (nếu có sự kiện) */}
      {workshopEvents.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.workshopTitle')}
          subtitle={t('eventSections.workshopSubtitle')}
          badge={t('eventSections.workshopBadge')}
          badgeColor="purple"
          events={workshopEvents}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => handleCategoryClick('Hội thảo & Workshop')}
        />
      )}

      {/* 9. Section: Tham quan & Trải nghiệm (nếu có sự kiện) */}
      {toursEvents.length > 0 && (
        <EventSectionGroup
          title={t('eventSections.toursTitle')}
          subtitle={t('eventSections.toursSubtitle')}
          badge={t('eventSections.toursBadge')}
          badgeColor="green"
          events={toursEvents}
          onSelectEvent={handleSelectEvent}
          onViewAll={() => handleCategoryClick('Tham quan & Trải nghiệm')}
        />
      )}

      {/* 10. Section: Tất cả sự kiện sắp diễn ra */}
      <EventSectionGroup
        title={t('eventSections.upcomingTitle')}
        subtitle={t('eventSections.upcomingSubtitle')}
        badge={t('eventSections.upcomingBadge')}
        badgeColor="cyan"
        events={events}
        onSelectEvent={handleSelectEvent}
        onViewAll={() => onNavigate('events')}
      />

      {/* 11. NFT Benefits Section */}
      <NFTBenefits />
    </div>
  );
};
