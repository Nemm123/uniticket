import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import viDict from './locales/vi.json';
import enDict from './locales/en.json';

export type Language = 'vi' | 'en';

type TranslationDictionary = typeof viDict;

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (amount?: number) => string;
  formatDate: (dateInput: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number) => string;
}

const STORAGE_KEY = 'uniticket_language';

const dictionaries: Record<Language, TranslationDictionary> = {
  vi: viDict,
  en: enDict,
};

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') {
      return stored;
    }
  } catch {
    // ignore local storage errors
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  }

  return 'vi';
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');
      let currentVal: unknown = dictionaries[language];

      for (const k of keys) {
        if (currentVal && typeof currentVal === 'object' && k in (currentVal as Record<string, unknown>)) {
          currentVal = (currentVal as Record<string, unknown>)[k];
        } else {
          currentVal = undefined;
          break;
        }
      }

      // Fallback sang tiếng Việt nếu thiếu key ở tiếng Anh
      if (typeof currentVal !== 'string') {
        let fallbackVal: unknown = dictionaries.vi;
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && k in (fallbackVal as Record<string, unknown>)) {
            fallbackVal = (fallbackVal as Record<string, unknown>)[k];
          } else {
            fallbackVal = undefined;
            break;
          }
        }
        if (typeof fallbackVal === 'string') {
          currentVal = fallbackVal;
        } else {
          return key;
        }
      }

      let result = currentVal as string;
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          result = result.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(paramVal));
        });
      }

      return result;
    },
    [language]
  );

  const formatCurrency = useCallback(
    (amount?: number): string => {
      if (typeof amount !== 'number' || isNaN(amount)) {
        return language === 'vi' ? 'Chưa cập nhật' : 'TBD';
      }
      if (amount === 0) {
        return language === 'vi' ? 'Miễn phí' : 'Free';
      }
      if (language === 'vi') {
        return `${amount.toLocaleString('vi-VN')} ₫`;
      }
      return `₫${amount.toLocaleString('en-US')}`;
    },
    [language]
  );

  const formatDate = useCallback(
    (dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string => {
      if (!dateInput) return '';
      try {
        let d: Date;
        if (typeof dateInput === 'string') {
          // Xử lý format DD/MM/YYYY
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
            const [day, month, year] = dateInput.split('/').map(Number);
            d = new Date(year, month - 1, day);
          } else {
            d = new Date(dateInput);
          }
        } else {
          d = dateInput;
        }

        if (isNaN(d.getTime())) return String(dateInput);

        if (options) {
          return d.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', options);
        }

        if (language === 'vi') {
          return d.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
        }
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } catch {
        return String(dateInput);
      }
    },
    [language]
  );

  const formatNumber = useCallback(
    (value: number): string => {
      return value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      formatCurrency,
      formatDate,
      formatNumber,
    }),
    [language, setLanguage, t, formatCurrency, formatDate, formatNumber]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
