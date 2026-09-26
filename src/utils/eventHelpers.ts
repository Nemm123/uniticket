/**
 * Utility helpers to display formatted categories, cities, and event status
 */

export function formatEventCategory(category?: string): string {
  if (!category) return 'Sự kiện';
  const lower = category.toLowerCase().trim();
  switch (lower) {
    case 'music':
      return 'Âm nhạc';
    case 'tech':
      return 'Công nghệ';
    case 'workshop':
      return 'Workshop';
    case 'entertainment':
      return 'Giải trí';
    default:
      return category;
  }
}

export function formatEventCity(city?: string): string {
  if (!city) return 'Toàn quốc';
  const lower = city.toLowerCase().trim();
  switch (lower) {
    case 'hcm':
      return 'TP. Hồ Chí Minh';
    case 'hanoi':
      return 'Hà Nội';
    case 'danang':
      return 'Đà Nẵng';
    case 'online':
      return 'Trực tuyến';
    default:
      return city;
  }
}

export interface StatusBadgeInfo {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function getEventStatusBadge(status?: string, isSoldOut?: boolean, isUpcomingFallback?: boolean): StatusBadgeInfo | null {
  if (isSoldOut) {
    return {
      label: 'Hết vé',
      bgClass: 'bg-red-600/90',
      textClass: 'text-white',
      borderClass: 'border-red-500/30',
    };
  }

  const s = status?.toLowerCase().trim();
  if (s === 'happening_soon') {
    return {
      label: 'Đang mở bán',
      bgClass: 'bg-emerald-600/90',
      textClass: 'text-emerald-100',
      borderClass: 'border-emerald-500/30',
    };
  }

  if (s === 'upcoming' || isUpcomingFallback) {
    return {
      label: 'Sắp diễn ra',
      bgClass: 'bg-solana-purple/80',
      textClass: 'text-purple-200',
      borderClass: 'border-solana-purple/40',
    };
  }

  if (s === 'completed') {
    return {
      label: 'Đã kết thúc',
      bgClass: 'bg-slate-700/80',
      textClass: 'text-slate-300',
      borderClass: 'border-white/10',
    };
  }

  if (s === 'cancelled') {
    return {
      label: 'Đã hủy',
      bgClass: 'bg-red-900/80',
      textClass: 'text-red-300',
      borderClass: 'border-red-700/40',
    };
  }

  return null;
}
