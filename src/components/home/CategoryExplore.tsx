import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface CategoryExploreProps {
  onSelectCategory: (categoryName: string) => void;
}

interface CategoryCardItem {
  id: string;
  translationKey: string;
  dbValue: string;
  emoji: string;
  image: string;
  gradient: string;
}

const CATEGORIES: CategoryCardItem[] = [
  {
    id: 'live-music',
    translationKey: 'categoryExplore.categories.liveMusic',
    dbValue: 'Nhạc sống',
    emoji: '🎵',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-purple-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'theater-art',
    translationKey: 'categoryExplore.categories.theaterArt',
    dbValue: 'Sân khấu & Nghệ thuật',
    emoji: '🎭',
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-pink-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'workshop',
    translationKey: 'categoryExplore.categories.workshop',
    dbValue: 'Hội thảo & Workshop',
    emoji: '🎨',
    image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-blue-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'tours',
    translationKey: 'categoryExplore.categories.tours',
    dbValue: 'Tham quan & Trải nghiệm',
    emoji: '🌍',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-emerald-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'sports',
    translationKey: 'categoryExplore.categories.sports',
    dbValue: 'Thể thao',
    emoji: '🏆',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-amber-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'tech',
    translationKey: 'categoryExplore.categories.tech',
    dbValue: 'Công nghệ',
    emoji: '💻',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-cyan-900/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'web3',
    translationKey: 'categoryExplore.categories.web3',
    dbValue: 'Web3',
    emoji: '⛓',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-solana-purple/80 via-black/60 to-[#0F0A28]',
  },
  {
    id: 'other',
    translationKey: 'categoryExplore.categories.other',
    dbValue: 'Khác',
    emoji: '✨',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80',
    gradient: 'from-fuchsia-900/80 via-black/60 to-[#0F0A28]',
  },
];

export const CategoryExplore: React.FC<CategoryExploreProps> = ({ onSelectCategory }) => {
  const { t } = useTranslation();

  return (
    <section className="py-10 sm:py-14 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan mb-2">
              <Sparkles className="w-3.5 h-3.5 text-solana-green" />
              <span>{t('categoryExplore.badge')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('categoryExplore.title')} <span className="text-gradient-solana">{t('categoryExplore.titleGradient')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {t('categoryExplore.subtitle')}
            </p>
          </div>
        </div>

        {/* Categories Grid: 2 cols on mobile, 4 on tablet, 8 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {CATEGORIES.map((cat) => {
            const displayName = t(cat.translationKey);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.dbValue)}
                className="group relative flex flex-col justify-end h-36 sm:h-44 rounded-2xl overflow-hidden border border-white/10 hover:border-solana-purple/60 shadow-lg hover:shadow-purple-950/60 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 text-left p-3.5"
              >
                {/* Card Image */}
                <img
                  src={cat.image}
                  alt={displayName}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />

                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${cat.gradient} opacity-85 group-hover:opacity-95 transition-opacity`} />

                {/* Glow border on hover */}
                <div className="absolute inset-0 ring-1 ring-white/10 group-hover:ring-solana-cyan/40 transition-all rounded-2xl" />

                {/* Content */}
                <div className="relative z-10">
                  <span className="text-2xl mb-1 block filter drop-shadow-md group-hover:scale-125 transition-transform duration-300 origin-left">
                    {cat.emoji}
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-white leading-tight group-hover:text-solana-cyan transition-colors line-clamp-2">
                    {displayName}
                  </h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
