import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface CityExploreProps {
  onSelectCity: (cityName: string) => void;
}

interface CityItem {
  id: string;
  nameKey: string;
  subtitleKey: string;
  filterValue: string;
  image: string;
  gradient: string;
}

const CITIES: CityItem[] = [
  {
    id: 'hcm',
    nameKey: 'cityExplore.cities.hcm',
    subtitleKey: 'cityExplore.subtitles.hcm',
    filterValue: 'TP. Hồ Chí Minh',
    image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=800&q=80',
    gradient: 'from-[#0D0722] via-[#0D0722]/60 to-transparent',
  },
  {
    id: 'hn',
    nameKey: 'cityExplore.cities.hn',
    subtitleKey: 'cityExplore.subtitles.hn',
    filterValue: 'Hà Nội',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
    gradient: 'from-[#0D0722] via-[#0D0722]/60 to-transparent',
  },
  {
    id: 'dn',
    nameKey: 'cityExplore.cities.dn',
    subtitleKey: 'cityExplore.subtitles.dn',
    filterValue: 'Đà Nẵng',
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
    gradient: 'from-[#0D0722] via-[#0D0722]/60 to-transparent',
  },
  {
    id: 'other',
    nameKey: 'cityExplore.cities.other',
    subtitleKey: 'cityExplore.subtitles.other',
    filterValue: 'Khác',
    image: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=800&q=80',
    gradient: 'from-[#0D0722] via-[#0D0722]/60 to-transparent',
  },
];

export const CityExplore: React.FC<CityExploreProps> = ({ onSelectCity }) => {
  const { t } = useTranslation();

  return (
    <section className="py-10 sm:py-14 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan mb-2">
              <MapPin className="w-3.5 h-3.5 text-neon-pink" />
              <span>{t('cityExplore.badge')}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('cityExplore.title')} <span className="text-gradient-solana">{t('cityExplore.titleGradient')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              {t('cityExplore.subtitle')}
            </p>
          </div>
        </div>

        {/* 4 Cities Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {CITIES.map((city) => {
            const cityName = t(city.nameKey);
            const citySubtitle = t(city.subtitleKey);
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => onSelectCity(city.filterValue)}
                className="group relative h-48 sm:h-60 rounded-2xl overflow-hidden border border-white/10 hover:border-solana-purple/60 shadow-xl hover:shadow-purple-950/60 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 text-left p-5 flex flex-col justify-end"
              >
                {/* City Photo */}
                <img
                  src={city.image}
                  alt={cityName}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Solana-inspired Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A051E] via-[#0A051E]/60 to-transparent opacity-90 group-hover:opacity-95 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-tr from-solana-purple/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Content */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-solana-cyan transition-colors">
                      {cityName}
                    </h3>
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-solana-purple group-hover:scale-110 transition-all">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 font-medium line-clamp-1">
                    {citySubtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
