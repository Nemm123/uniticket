import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Clock, Flame, MapPin, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { EventItem } from '../../types';
import { useTranslation } from '../../i18n';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventItem[];
  onSelectEvent: (eventId: string) => void;
  onViewAllResults: (query: string) => void;
}

const RECENT_SEARCHES_KEY = 'uniticket_recent_searches';
const POPULAR_SEARCHES = [
  'Solana',
  'Nhạc sống',
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'EDM',
  'Web3 Hackathon',
  'Vũ Cát Tường',
  'Martin Cyber',
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  events,
  onSelectEvent,
  onViewAllResults,
}) => {
  const { t, formatCurrency, formatDate } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : ['Solana Cyber Rave', 'Concert Hà Nội'];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input khi mở modal
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setSearchTerm('');
      setDebouncedTerm('');
    }
  }, [isOpen]);

  // Debounce 300ms tránh search lại mỗi keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const saveRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  // Tìm kiếm sự kiện theo: tên sự kiện, category, venue, city, organizer, lineup/nghệ sĩ, tags
  const searchResults = useMemo(() => {
    if (!debouncedTerm) return [];
    const q = debouncedTerm.toLowerCase();
    return events.filter((evt) => {
      return (
        evt.title.toLowerCase().includes(q) ||
        evt.subtitle?.toLowerCase().includes(q) ||
        evt.category?.toLowerCase().includes(q) ||
        evt.venue.toLowerCase().includes(q) ||
        evt.city.toLowerCase().includes(q) ||
        evt.organizer?.name?.toLowerCase().includes(q) ||
        (evt.lineup && evt.lineup.some((artist) => artist.toLowerCase().includes(q))) ||
        (evt.tags && evt.tags.some((tag) => tag.toLowerCase().includes(tag)))
      );
    });
  }, [events, debouncedTerm]);

  if (!isOpen) return null;

  const handleSelect = (eventId: string) => {
    if (debouncedTerm) saveRecentSearch(debouncedTerm);
    onSelectEvent(eventId);
    onClose();
  };

  const handleApplyTerm = (term: string) => {
    setSearchTerm(term);
    saveRecentSearch(term);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debouncedTerm) {
      saveRecentSearch(debouncedTerm);
      onViewAllResults(debouncedTerm);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-3 sm:p-6 pt-16 sm:pt-20 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0E0924] border border-solana-purple/50 shadow-2xl shadow-purple-950/80 overflow-hidden flex flex-col max-h-[85vh] z-10 text-left">
        {/* Search Input Header */}
        <form onSubmit={handleFormSubmit} className="relative flex items-center border-b border-white/10 px-4 py-3.5 bg-[#140D33]/90">
          <Search className="h-5 w-5 text-solana-cyan shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search.inputPlaceholder')}
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 mr-2"
              aria-label={t('eventsPage.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
          >
            Esc
          </button>
        </form>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {/* Khi chưa nhập từ khóa: Hiển thị Recent searches + Popular searches */}
          {!debouncedTerm ? (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                    <span className="flex items-center gap-1.5 text-solana-cyan">
                      <Clock className="h-3.5 w-3.5" />
                      {t('search.recentSearches')}
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecent}
                      className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                    >
                      {t('search.clearAll')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => handleApplyTerm(term)}
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#170F3B] hover:border-solana-purple/50 px-3 py-1.5 text-xs text-slate-200 hover:text-white transition-colors cursor-pointer group"
                      >
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="text-slate-500 group-hover:text-slate-300 hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Searches */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-neon-pink" />
                  <span>{t('search.popularSearches')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleApplyTerm(term)}
                      className="rounded-full border border-solana-purple/30 bg-solana-purple/15 hover:bg-solana-purple/30 px-3 py-1.5 text-xs font-medium text-purple-200 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3 w-3 text-solana-green" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Khi đã có từ khóa: Hiển thị kết quả tìm kiếm */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {t('search.resultsFor', { query: debouncedTerm, count: searchResults.length })}
                </span>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      saveRecentSearch(debouncedTerm);
                      onViewAllResults(debouncedTerm);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 text-solana-cyan hover:underline font-semibold"
                  >
                    <span>{t('search.viewAllResults')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {searchResults.length === 0 ? (
                <div className="py-12 text-center space-y-3 rounded-xl border border-white/5 bg-[#120B30]/50 p-6">
                  <Search className="h-8 w-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-white">{t('search.noResults')}</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {t('search.noResultsHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {searchResults.slice(0, 6).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleSelect(event.id)}
                      role="button"
                      tabIndex={0}
                      className="flex items-center gap-3.5 p-3 rounded-xl border border-white/5 bg-[#140D33]/70 hover:bg-[#1C1247] hover:border-solana-purple/40 transition-all cursor-pointer group"
                    >
                      <img
                        src={event.thumbnailImage || event.bannerImage}
                        alt={event.title}
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-solana-cyan">
                            {event.category}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {formatDate(event.date)}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white group-hover:text-solana-cyan transition-colors truncate">
                          {event.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0 text-neon-pink" />
                          {event.venue}, {event.city}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-solana-green block">
                          {formatCurrency(event.minPriceVnd)}
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-solana-purple">
                          {t('common.viewDetails')} →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
