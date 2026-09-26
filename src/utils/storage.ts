import { CheckInRecord, CheckInResult, EventItem, PurchasedTicket } from '../types';
import { mockEvents } from '../data/mockEvents';

const INVENTORY_KEY = 'uniticket_events_inventory';
const TICKETS_KEY = 'uniticket_purchased_tickets';
const CHECKIN_HISTORY_KEY = 'uniticket_checkin_history';

function normalizeEvents(events: EventItem[]): EventItem[] {
  const canonicalMap = new Map(mockEvents.map((e) => [e.id, e]));
  let modified = false;

  const normalized: EventItem[] = events.map((event) => {
    const canonical = canonicalMap.get(event.id);
    const tiers = (event.tiers || []).map((tier) => {
      if (typeof tier.priceVnd === 'number' && tier.priceVnd > 0) return tier;
      modified = true;
      const canonicalTier = canonical?.tiers?.find((t) => t.id === tier.id || t.name === tier.name);
      const priceVnd = canonicalTier?.priceVnd ?? (tier.name.toLowerCase().includes('vip') ? 799000 : 499000);
      return { ...tier, priceVnd };
    });

    const prices = tiers.map((t) => t.priceVnd).filter((p): p is number => typeof p === 'number' && p > 0);
    const minPriceVnd = prices.length > 0 ? Math.min(...prices) : (canonical?.minPriceVnd ?? 499000);
    if (event.minPriceVnd !== minPriceVnd) modified = true;

    return { ...event, minPriceVnd, tiers };
  });

  const existingIds = new Set(events.map((e) => e.id));
  for (const canonical of mockEvents) {
    if (!existingIds.has(canonical.id)) {
      normalized.push(canonical);
      modified = true;
    }
  }

  if (modified) {
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(normalized));
    } catch {
      // Best-effort storage sync
    }
  }

  return normalized;
}

/**
 * Đọc danh sách sự kiện và trạng thái tồn kho an toàn từ localStorage
 */
export function getStoredEvents(): EventItem[] {
  try {
    const data = localStorage.getItem(INVENTORY_KEY);
    if (!data) {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(mockEvents));
      return mockEvents;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return normalizeEvents(parsed);
    }
    return mockEvents;
  } catch (error) {
    console.warn('[UniTicket Storage] Lỗi đọc localStorage inventory, sử dụng fallback mockEvents:', error);
    return mockEvents;
  }
}

function isValidEvent(event: EventItem): boolean {
  return Boolean(
    event &&
    typeof event.id === 'string' &&
    event.id.trim() &&
    typeof event.title === 'string' &&
    event.title.trim() &&
    typeof event.description === 'string' &&
    typeof event.venue === 'string' &&
    event.venue.trim() &&
    typeof event.date === 'string' &&
    typeof event.time === 'string' &&
    typeof event.bannerImage === 'string' &&
    typeof event.thumbnailImage === 'string' &&
    Array.isArray(event.tiers) &&
    event.tiers.length > 0 &&
    event.tiers.every((tier) => (
      typeof tier.id === 'string' && tier.id.trim() &&
      typeof tier.name === 'string' && tier.name.trim() &&
      Number.isFinite(tier.priceSol) && tier.priceSol >= 0 &&
      Number.isInteger(tier.totalQuantity) && tier.totalQuantity > 0 &&
      Number.isInteger(tier.remainingQuantity) && tier.remainingQuantity >= 0 &&
      tier.remainingQuantity <= tier.totalQuantity
    ))
  );
}

/** Persists the event inventory without touching purchased tickets or check-in history. */
export function saveStoredEvents(events: EventItem[]): boolean {
  try {
    if (!Array.isArray(events) || !events.every(isValidEvent)) return false;
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error('[UniTicket Storage] Failed to save event inventory:', error);
    return false;
  }
}

export function updateStoredEvent(event: EventItem): boolean {
  try {
    if (!isValidEvent(event)) return false;
    const events = getStoredEvents();
    const index = events.findIndex((item) => item.id === event.id);
    if (index === -1) return false;
    const updated = [...events];
    updated[index] = event;
    return saveStoredEvents(updated);
  } catch (error) {
    console.error('[UniTicket Storage] Failed to update event:', error);
    return false;
  }
}

export function createStoredEvent(event: EventItem): boolean {
  try {
    if (!isValidEvent(event)) return false;
    const events = getStoredEvents();
    if (events.some((item) => item.id === event.id)) return false;
    return saveStoredEvents([event, ...events]);
  } catch (error) {
    console.error('[UniTicket Storage] Failed to create event:', error);
    return false;
  }
}

/** Events with purchased tickets cannot be deleted, preserving ticket/check-in referential integrity. */
export function deleteStoredEvent(eventId: string): { ok: boolean; message: string } {
  try {
    if (!eventId) return { ok: false, message: 'Event ID is required.' };
    const tickets = getStoredPurchasedTickets();
    if (tickets.some((ticket) => ticket.eventId === eventId)) {
      return { ok: false, message: 'This event has purchased tickets and cannot be deleted in the demo.' };
    }
    const events = getStoredEvents();
    if (!events.some((event) => event.id === eventId)) return { ok: false, message: 'Event not found.' };
    const saved = saveStoredEvents(events.filter((event) => event.id !== eventId));
    return saved
      ? { ok: true, message: 'Event deleted.' }
      : { ok: false, message: 'Could not save event changes.' };
  } catch (error) {
    console.error('[UniTicket Storage] Failed to delete event:', error);
    return { ok: false, message: 'Could not delete event.' };
  }
}

/**
 * Cập nhật tồn kho vé khi mua thành công
 */
export function updateEventInventory(eventId: string, tierId: string, quantityPurchased: number): boolean {
  try {
    const events = getStoredEvents();
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return false;

    const event = events[eventIndex];
    if (!event.tiers) return false;

    const tierIndex = event.tiers.findIndex(t => t.id === tierId);
    if (tierIndex === -1) return false;

    const tier = event.tiers[tierIndex];
    if (tier.remainingQuantity < quantityPurchased) {
      return false; // Vượt quá tồn kho
    }

    tier.remainingQuantity -= quantityPurchased;
    event.soldTickets += quantityPurchased;

    events[eventIndex] = event;
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error('[UniTicket Storage] Lỗi cập nhật tồn kho:', error);
    return false;
  }
}

/**
 * Đọc danh sách vé đã mua từ localStorage
 */
export function getStoredPurchasedTickets(): PurchasedTicket[] {
  try {
    const data = localStorage.getItem(TICKETS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.filter((ticket): ticket is PurchasedTicket => (
        ticket !== null &&
        typeof ticket === 'object' &&
        typeof ticket.id === 'string' &&
        typeof ticket.orderId === 'string' &&
        typeof ticket.eventTitle === 'string' &&
        typeof ticket.tierName === 'string' &&
        typeof ticket.ticketCode === 'string' &&
        typeof ticket.customerWallet === 'string' &&
        typeof ticket.qrPayload === 'string'
      ));
    }
    return [];
  } catch (error) {
    console.warn('[UniTicket Storage] Lỗi đọc vé từ localStorage, sử dụng danh sách rỗng:', error);
    return [];
  }
}

/**
 * Lưu các vé mới mua vào localStorage
 */
export function savePurchasedTickets(newTickets: PurchasedTicket[]): boolean {
  try {
    const data = localStorage.getItem(TICKETS_KEY);
    const currentTickets = data ? JSON.parse(data) : [];
    if (!Array.isArray(currentTickets)) return false;
    // Đưa các vé mới lên đầu danh sách
    const updated = [...newTickets, ...currentTickets];
    localStorage.setItem(TICKETS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('[UniTicket Storage] Lỗi lưu vé mới vào localStorage:', error);
    return false;
  }
}

/**
 * Cập nhật tồn kho và lưu vé như một thao tác duy nhất ở mức localStorage.
 * Nếu một trong hai lần ghi thất bại, dữ liệu trước thao tác được khôi phục.
 */
export function savePurchaseAtomically(
  eventId: string,
  tierId: string,
  quantityPurchased: number,
  newTickets: PurchasedTicket[],
): boolean {
  let previousInventory: string | null = null;
  let previousTickets: string | null = null;
  let hasInventorySnapshot = false;
  let hasTicketsSnapshot = false;

  try {
    if (
      !eventId ||
      !tierId ||
      !Number.isInteger(quantityPurchased) ||
      quantityPurchased <= 0 ||
      !Array.isArray(newTickets) ||
      newTickets.length !== quantityPurchased
    ) {
      return false;
    }

    // localStorage is only demo persistence, so take snapshots before either write.
    previousInventory = localStorage.getItem(INVENTORY_KEY);
    hasInventorySnapshot = true;
    previousTickets = localStorage.getItem(TICKETS_KEY);
    hasTicketsSnapshot = true;
    const events = getStoredEvents();
    const event = events.find((item) => item.id === eventId);
    const tier = event?.tiers?.find((item) => item.id === tierId);

    if (!event || !tier) {
      return false;
    }
    if (tier.remainingQuantity < quantityPurchased) {
      return false;
    }

    const existingData = localStorage.getItem(TICKETS_KEY);
    const existingTickets = existingData ? JSON.parse(existingData) : [];
    if (!Array.isArray(existingTickets)) return false;

    tier.remainingQuantity -= quantityPurchased;
    event.soldTickets += quantityPurchased;
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(events));
    localStorage.setItem(TICKETS_KEY, JSON.stringify([...newTickets, ...existingTickets]));
    return true;
  } catch (error) {
    console.error('[UniTicket Storage] Lỗi lưu đơn hàng, khôi phục dữ liệu trước đó:', error);
    if (hasInventorySnapshot) restoreStorageValue(INVENTORY_KEY, previousInventory);
    if (hasTicketsSnapshot) restoreStorageValue(TICKETS_KEY, previousTickets);
    return false;
  }
}

function restoreStorageValue(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    // A browser can reject storage again (for example quota/private browsing).
    // Do not let a failed best-effort rollback crash the UI.
    console.error('[UniTicket Storage] Kh\u00f4ng th\u1ec3 kh\u00f4i ph\u1ee5c localStorage:', error);
  }
}

/**
 * Kiểm tra QR payload hoặc ticketCode và cập nhật trạng thái sử dụng một lần.
 * Đây chỉ là dữ liệu mô phỏng phía frontend, không phải cơ chế chống gian lận.
 */
interface MockQrPayload {
  ticketId: string;
  orderId: string;
  eventId: string;
  tierId: string;
  ticketCode: string;
  signatureVersion: 'mock-v1';
}

function isCheckedIn(ticket: PurchasedTicket): boolean {
  return ticket.isCheckedIn || ticket.checkInStatus === 'checked-in' || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN';
}

/** Validates a QR payload against the stored ticket without changing ticket state. */
export function validateTicketForCheckIn(input: string): CheckInResult {
  if (!input.trim()) return { status: 'invalid', message: 'Invalid QR code.' };

  let payload: MockQrPayload;
  try {
    payload = JSON.parse(input) as MockQrPayload;
  } catch {
    return { status: 'invalid', message: 'Invalid QR code.' };
  }

  if (
    !payload ||
    typeof payload.ticketId !== 'string' ||
    typeof payload.orderId !== 'string' ||
    typeof payload.eventId !== 'string' ||
    typeof payload.tierId !== 'string' ||
    typeof payload.ticketCode !== 'string' ||
    payload.signatureVersion !== 'mock-v1'
  ) {
    return { status: 'invalid', message: 'Invalid QR code.' };
  }

  try {
    const rawTickets = localStorage.getItem(TICKETS_KEY);
    const tickets = rawTickets ? JSON.parse(rawTickets) : [];
    if (!Array.isArray(tickets)) return { status: 'error', message: 'Could not read demo ticket storage.' };

    const ticket = tickets.find((item): item is PurchasedTicket => item?.id === payload.ticketId);
    if (!ticket) return { status: 'invalid', message: 'Ticket not found.' };
    if (
      ticket.orderId !== payload.orderId ||
      ticket.ticketCode !== payload.ticketCode ||
      ticket.eventId !== payload.eventId ||
      ticket.tierId !== payload.tierId
    ) {
      return { status: 'invalid', message: 'Ticket verification failed.' };
    }
    if (isCheckedIn(ticket)) return { status: 'used', message: 'This ticket has already been checked in.', ticket };

    return { status: 'valid', message: 'Ticket verified. Please confirm check-in.', ticket };
  } catch (error) {
    console.error('[UniTicket Storage] Failed to validate demo ticket:', error);
    return { status: 'error', message: 'Could not read demo ticket storage.' };
  }
}

/** Re-reads storage and changes a ticket only after an organizer confirms it. */
export function confirmTicketCheckIn(ticketId: string, checkedInBy: string): CheckInResult {
  let previousTickets: string | null = null;
  let previousHistory: string | null = null;
  let hasTicketsSnapshot = false;
  let hasHistorySnapshot = false;

  try {
    if (!ticketId || !checkedInBy) return { status: 'error', message: 'Organizer wallet is required.' };

    previousTickets = localStorage.getItem(TICKETS_KEY);
    hasTicketsSnapshot = true;
    previousHistory = localStorage.getItem(CHECKIN_HISTORY_KEY);
    hasHistorySnapshot = true;
    const tickets = previousTickets ? JSON.parse(previousTickets) : [];
    const history = previousHistory ? JSON.parse(previousHistory) : [];
    if (!Array.isArray(tickets) || !Array.isArray(history)) return { status: 'error', message: 'Could not read demo ticket storage.' };

    const ticketIndex = tickets.findIndex((item) => item?.id === ticketId);
    if (ticketIndex === -1) return { status: 'invalid', message: 'Ticket not found.' };
    const ticket = tickets[ticketIndex] as PurchasedTicket;
    if (isCheckedIn(ticket)) return { status: 'used', message: 'This ticket has already been checked in.', ticket };

    const checkedInAt = new Date().toISOString();
    const checkedInAtTimestamp = Date.now();
    const updatedTicket: PurchasedTicket = {
      ...ticket,
      isCheckedIn: true,
      status: 'checked_in',
      checkInTime: checkedInAt,
      checkedInBy,
      checkInStatus: 'checked-in',
      checkedInAt: checkedInAtTimestamp,
    };
    const updatedTickets = [...tickets];
    updatedTickets[ticketIndex] = updatedTicket;
    const historyRecord: CheckInRecord = {
      ticketId: updatedTicket.id,
      ticketCode: updatedTicket.ticketCode,
      checkedInAt,
      checkedInBy,
    };

    localStorage.setItem(TICKETS_KEY, JSON.stringify(updatedTickets));
    localStorage.setItem(CHECKIN_HISTORY_KEY, JSON.stringify([historyRecord, ...history]));
    return { status: 'valid', message: 'Check-in confirmed.', ticket: updatedTicket };
  } catch (error) {
    console.error('[UniTicket Storage] Failed to confirm check-in:', error);
    if (hasTicketsSnapshot) restoreStorageValue(TICKETS_KEY, previousTickets);
    if (hasHistorySnapshot) restoreStorageValue(CHECKIN_HISTORY_KEY, previousHistory);
    return { status: 'error', message: 'Could not save demo check-in.' };
  }
}

// Backwards-compatible validation entry point. It intentionally does not check in a ticket.
export const checkInTicket = validateTicketForCheckIn;

export function getStoredCheckInHistory(): CheckInRecord[] {
  try {
    const data = localStorage.getItem(CHECKIN_HISTORY_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
