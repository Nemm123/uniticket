export type ViewMode = 'attendee' | 'organizer';

const VIEW_MODE_KEY = 'uniticket_view_mode';

export function getStoredViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return saved === 'attendee' ? 'attendee' : 'organizer';
  } catch {
    return 'organizer';
  }
}

export function saveStoredViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Best-effort persistence
  }
}
