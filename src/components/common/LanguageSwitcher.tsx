import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation, Language } from '../../i18n';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation: Escape để đóng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  const labelText = language === 'vi' ? 'VI' : 'EN';
  const flagEmoji = language === 'vi' ? '🇻🇳' : '🇬🇧';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Chọn ngôn ngữ / Select language"
        className={`inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#150E35]/80 px-2.5 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-solana-purple/50 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-solana-cyan/50 active:scale-95 shadow-sm ${
          compact ? 'h-11 min-w-11 justify-center' : ''
        }`}
      >
        <Globe className="h-4 w-4 text-solana-cyan shrink-0" />
        <span className="text-sm shrink-0">{flagEmoji}</span>
        <span className="font-bold tracking-wider">{labelText}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-solana-cyan' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-44 origin-top-right rounded-2xl border border-solana-purple/40 bg-[#0E0924]/95 p-1.5 shadow-2xl shadow-purple-950/80 backdrop-blur-xl z-[90] animate-scaleUp text-left"
        >
          {/* Tiếng Việt */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('vi')}
            className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
              language === 'vi'
                ? 'bg-solana-purple/25 text-solana-cyan border border-solana-cyan/30'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🇻🇳</span>
              <span>Tiếng Việt</span>
            </div>
            {language === 'vi' && <Check className="h-4 w-4 text-solana-green shrink-0" />}
          </button>

          {/* English */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect('en')}
            className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all mt-1 ${
              language === 'en'
                ? 'bg-solana-purple/25 text-solana-cyan border border-solana-cyan/30'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🇬🇧</span>
              <span>English</span>
            </div>
            {language === 'en' && <Check className="h-4 w-4 text-solana-green shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
};
