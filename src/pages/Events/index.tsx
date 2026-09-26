import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Filter, Calendar, MapPin, Tag, RotateCcw, Sparkles, Clock, ArrowLeft } from 'lucide-react';
import { EventItem } from '../../types';
import { EventCard } from '../../components/common/EventCard';
import { listEvents, EventFilterParams } from '../../services/eventsApi';
import { getStoredEvents } from '../../utils/storage';
import { useTranslation } from '../../i18n';

interface EventsPageProps {
  onSelectEvent: (eventId: string) => void;
  onBackToHome?: () => void;
  initialCategory?: string;
  initialCity?: string;
  initialQuery?: string;
}

const TIME_OPTIONS = [
  { id: 'all', labelKey: 'eventsPage.timeOptions.all' },
  { id: 'today', labelKey: 'eventsPage.timeOptions.today' },
  { id: 'this-week', labelKey: 'eventsPage.timeOptions.thisWeek' },
  { id: 'this-month', labelKey: 'eventsPage.timeOptions.thisMonth' },
];

const CATEGORY_OPTIONS = [
  { id: 'all', labelKey: 'eventsPage.categoryOptions.all', dbValue: 'all' },
  { id: 'music', labelKey: 'eventsPage.categoryOptions.music', dbValue: 'Âm nhạc' },
  { id: 'tech', labelKey: 'eventsPage.categoryOptions.tech', dbValue: 'Công nghệ' },
  { id: 'workshop', labelKey: 'eventsPage.categoryOptions.workshop', dbValue: 'Workshop' },
  { id: 'entertainment', labelKey: 'eventsPage.categoryOptions.entertainment', dbValue: 'Giải trí' },
];

const CITY_OPTIONS = [
  { id: 'all', labelKey: 'eventsPage.cityOptions.all', dbValue: 'all' },
  { id: 'hcm', labelKey: 'eventsPage.cityOptions.hcm', dbValue: 'TP. Hồ Chí Minh' },
  { id: 'hanoi', labelKey: 'eventsPage.cityOptions.hanoi', dbValue: 'Hà Nội' },
  { id: 'danang', labelKey: 'eventsPage.cityOptions.danang', dbValue: 'Đà Nẵng' },
  { id: 'online', labelKey: 'eventsPage.cityOptions.online', dbValue: 'Trực tuyến' },
];

const PRICE_OPTIONS = [
  { id: 'all', labelKey: 'eventsPage.priceOptions.all' },
  { id: 'free', labelKey: 'eventsPage.priceOptions.free' },
  { id: 'under01Sol', labelKey: 'eventsPage.priceOptions.under01Sol' },
  { id: 'over01Sol', labelKey: 'eventsPage.priceOptions.over01Sol' },
];

export const EventsPage: React.FC<EventsPageProps> = ({
  onSelectEvent,
  onBackToHome,
  initialCategory,
  initialCity,
  initialQuery = '',
}) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EventItem[]>(() => getStoredEvents());
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // States bộ lọc
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedTime, setSelectedTime] = useState<string>('all');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory && initialCategory !== 'All' ? initialCategory : 'all'
  );
  const [selectedCity, setSelectedCity] = useState<string>(
    initialCity && initialCity !== 'All' ? initialCity : 'all'
  );
  const [selectedPrice, setSelectedPrice] = useState<string>('all');

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load events từ API với filters
  const fetchFilteredEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);

    const apiFilters: EventFilterParams = {};
    if (debouncedSearch.trim()) apiFilters.q = debouncedSearch.trim();
    if (selectedCategory !== 'all') apiFilters.category = selectedCategory;
    if (selectedCity !== 'all') {
      apiFilters.city = selectedCity === 'Thành phố khác' ? 'Khác' : selectedCity;
    }
    if (selectedTime !== 'all') {
      apiFilters.timeRange = selectedTime as EventFilterParams['timeRange'];
    }

    if (selectedPrice === 'free') {
      apiFilters.minPrice = 0;
      apiFilters.maxPrice = 0;
    } else if (selectedPrice === 'under01Sol' || selectedPrice === 'under-500k') {
      apiFilters.minPrice = 0;
      apiFilters.maxPrice = 499999;
    } else if (selectedPrice === 'over01Sol' || selectedPrice === 'over-1m') {
      apiFilters.minPrice = 500000;
    }

    try {
      const remoteEvents = await listEvents(apiFilters);
      if (remoteEvents.length > 0) {
        setEvents(remoteEvents);
      } else {
        // Fallback filter trên stored events nếu server trả rỗng hoặc offline
        const local = getStoredEvents();
        setEvents(local);
      }
    } catch {
      // Khi API lỗi, lọc client-side trên stored events
      setEvents(getStoredEvents());
      setEventsError('Đang hiển thị dữ liệu lưu cục bộ.');
    } finally {
      setEventsLoading(false);
    }
  }, [debouncedSearch, selectedCategory, selectedCity, selectedTime, selectedPrice]);

  useEffect(() => {
    void fetchFilteredEvents();
  }, [fetchFilteredEvents]);

  // Client-side filter fallback & custom date filter
  const displayedEvents = useMemo(() => {
    return events.filter((evt) => {
      // 1. Text Search
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesText =
          evt.title.toLowerCase().includes(q) ||
          (evt.subtitle && evt.subtitle.toLowerCase().includes(q)) ||
          evt.venue.toLowerCase().includes(q) ||
          evt.city.toLowerCase().includes(q) ||
          (evt.lineup && evt.lineup.some((a) => a.toLowerCase().includes(q)));
        if (!matchesText) return false;
      }

      // 2. Category
      if (selectedCategory !== 'all') {
        const catLower = selectedCategory.toLowerCase();
        const matchesCategory =
          evt.category.toLowerCase() === catLower ||
          (catLower === 'âm nhạc' && (evt.category.toLowerCase().includes('nhạc') || evt.category.toLowerCase().includes('music') || evt.category === 'Concert' || evt.category === 'EDM Festival' || evt.category === 'Rock Arena' || evt.category === 'DJ Night')) ||
          (catLower === 'công nghệ' && (evt.category.toLowerCase().includes('công nghệ') || evt.category.toLowerCase().includes('tech') || evt.category === 'Web3 Hackathon' || evt.category === 'Web3')) ||
          (catLower === 'workshop' && (evt.category.toLowerCase().includes('workshop') || evt.category.toLowerCase().includes('hội thảo'))) ||
          (catLower === 'giải trí' && (evt.category.toLowerCase().includes('giải trí') || evt.category.toLowerCase().includes('entertainment') || evt.category === 'Concert' || evt.category === 'Comedy Show'));
        if (!matchesCategory) return false;
      }

      // 3. City
      if (selectedCity !== 'all') {
        if (selectedCity === 'Trực tuyến' || selectedCity.toLowerCase() === 'online') {
          const isOnline = evt.city.toLowerCase().includes('online') || evt.city.toLowerCase().includes('trực tuyến') || evt.venue.toLowerCase().includes('online');
          if (!isOnline) return false;
        } else {
          if (!evt.city.toLowerCase().includes(selectedCity.toLowerCase())) return false;
        }
      }

      // 4. Custom date picker
      if (selectedCustomDate) {
        // date format in event is DD/MM/YYYY or YYYY-MM-DD
        const formattedCustom = selectedCustomDate.split('-').reverse().join('/'); // YYYY-MM-DD -> DD/MM/YYYY
        if (!evt.date.includes(formattedCustom) && !evt.date.includes(selectedCustomDate)) {
          return false;
        }
      }

      // 5. Price
      if (selectedPrice === 'free') {
        if (evt.minPriceVnd && evt.minPriceVnd > 0) return false;
      } else if (selectedPrice === 'under01Sol' || selectedPrice === 'under-500k') {
        if (evt.minPriceVnd !== undefined && evt.minPriceVnd >= 500000) return false;
      } else if (selectedPrice === 'over01Sol' || selectedPrice === 'over-1m') {
        if (evt.minPriceVnd !== undefined && evt.minPriceVnd < 500000) return false;
      }

      return true;
    });
  }, [events, debouncedSearch, selectedCategory, selectedCity, selectedCustomDate, selectedPrice]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedTime('all');
    setSelectedCustomDate('');
    setSelectedCategory('all');
    setSelectedCity('all');
    setSelectedPrice('all');
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    selectedTime !== 'all' ||
    selectedCustomDate ||
    selectedCategory !== 'all' ||
    selectedCity !== 'all' ||
    selectedPrice !== 'all'
  );

  return (
    <div className="min-h-screen py-8 sm:py-14 cyber-grid-bg relative z-10 text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-fadeIn">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan mb-3 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('eventsPage.backToHome')}</span>
              </button>
            )}
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('eventsPage.title')} <span className="text-gradient-solana">{t('eventsPage.titleGradient')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {t('eventsPage.subtitle')}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-xs font-semibold text-solana-cyan shrink-0 self-start sm:self-auto">
            <Sparkles className="w-4 h-4 text-solana-green" />
            <span>{t('eventsPage.showingCount', { count: displayedEvents.length })}</span>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="p-4 sm:p-6 rounded-2xl bg-[#120B30]/90 border border-white/10 shadow-2xl space-y-4">
          {/* Main search input */}
          <div className="relative">
            <Search className="w-5 h-5 text-solana-cyan absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('eventsPage.searchPlaceholder')}
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-[#0B0620] border border-white/10 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-400 transition-colors shadow-inner"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                {t('eventsPage.clearSearch')}
              </button>
            )}
          </div>

          {/* Filter dropdowns 4 cột */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* 1. Lọc Thời gian */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-solana-cyan" />
                <span>{t('eventsPage.timeFilter')}</span>
              </label>
              <select
                value={selectedTime}
                onChange={(e) => {
                  setSelectedTime(e.target.value);
                  setSelectedCustomDate('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-[#120B30]">
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Lọc Thể loại */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-solana-purple" />
                <span>{t('eventsPage.categoryFilter')}</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.id} value={cat.dbValue} className="bg-[#120B30]">
                    {t(cat.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Lọc Địa điểm / Thành phố */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neon-pink" />
                <span>{t('eventsPage.cityFilter')}</span>
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                {CITY_OPTIONS.map((city) => (
                  <option key={city.id} value={city.dbValue} className="bg-[#120B30]">
                    {t(city.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Lọc Giá */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-solana-green" />
                <span>{t('eventsPage.priceFilter')}</span>
              </label>
              <select
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                {PRICE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#120B30]">
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Chọn ngày tùy chỉnh & Nút Xóa bộ lọc */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-solana-purple" />
                <span>{t('eventsPage.specificDate')}</span>
              </span>
              <input
                type="date"
                value={selectedCustomDate}
                onChange={(e) => {
                  setSelectedCustomDate(e.target.value);
                  setSelectedTime('all');
                }}
                className="px-2.5 py-1 rounded-lg bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-solana-cyan hover:text-white transition-colors py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('eventsPage.resetFilters')}</span>
              </button>
            )}
          </div>
        </div>

        {eventsError && (
          <div role="alert" className="rounded-xl border border-neon-pink/40 bg-neon-pink/10 px-4 py-3 text-xs text-pink-100">
            {eventsError}
          </div>
        )}

        {/* Loading Skeletons */}
        {eventsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/5 bg-[#110A2B]/60 p-4 space-y-4 animate-pulse"
              >
                <div className="h-48 rounded-xl bg-white/5" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : displayedEvents.length > 0 ? (
          /* Event Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {displayedEvents.map((evt) => (
              <EventCard
                key={evt.id}
                event={evt}
                onClick={onSelectEvent}
              />
            ))}
          </div>
        ) : (
          /* Empty State phong cách UniTicket */
          <div className="py-16 text-center space-y-4 rounded-2xl bg-[#120B30]/60 border border-white/10 p-8 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-solana-purple/20 border border-solana-purple/40 flex items-center justify-center mx-auto text-solana-cyan">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">{t('eventsPage.emptyTitle')}</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {t('eventsPage.emptyDesc')}
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink text-white font-bold text-xs hover:shadow-solana-purple/50 shadow-lg active:scale-95 transition-all"
            >
              {t('eventsPage.resetFiltersButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
