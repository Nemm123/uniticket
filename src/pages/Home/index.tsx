import React from 'react';
import { HeroSection } from '../../components/home/HeroSection';
import { FeaturedEvents } from '../../components/home/FeaturedEvents';
import { NFTBenefits } from '../../components/home/NFTBenefits';
import { mockEvents } from '../../data/mockEvents';

interface HomePageProps {
  onNavigate: (page: string, eventId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const featuredEvent = mockEvents.find((e) => e.featured) || mockEvents[0];

  const handleSelectEvent = (eventId: string) => {
    onNavigate('event-detail', eventId);
  };

  return (
    <div className="min-h-screen">
      {/* 1. Hero Section với đồng hồ đếm ngược và concert nổi bật */}
      <HeroSection
        featuredEvent={featuredEvent}
        onExploreClick={() => onNavigate('events')}
        onSelectEvent={handleSelectEvent}
      />

      {/* 2. Danh sách các Concert & Sự kiện âm nhạc nổi bật */}
      <FeaturedEvents
        events={mockEvents}
        onSelectEvent={handleSelectEvent}
      />

      {/* 3. Lợi ích của vé NFT trên Solana */}
      <NFTBenefits />
    </div>
  );
};
