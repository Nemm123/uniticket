import { CheckInRecord, CheckInResult, EventItem, PurchasedTicket } from '../types';
import { mockEvents } from '../data/mockEvents';

const INVENTORY_KEY = 'uniticket_events_inventory_v2';
const LEGACY_INVENTORY_KEY = 'uniticket_events_inventory';
const TICKETS_KEY = 'uniticket_purchased_tickets';
const CHECKIN_HISTORY_KEY = 'uniticket_checkin_history';

/**
 * Mapping các ID sự kiện cũ/khác định dạng sang ID chuẩn mới
 */
export const EVENT_ID_ALIASES: Record<string, string> = {
  'anh-trai-say-hi-all-star-2026': 'event-anh-trai-say-hi-2026',
  'solana-vietnam-hacker-house-2026': 'event-solana-vietnam-build-2026',
  'monsoon-music-festival-2026': 'event-monsoon-music-festival-2026',
  'da-nang-international-beach-edm-2026': 'event-da-nang-beach-edm-2026',
};

function normalizeEvents(events: EventItem[]): EventItem[] {
  let modified = false;

  // 1. Chuyển đổi các ID cũ sang ID chuẩn nếu cần
  const migratedEvents = events.map((event) => {
    const alias = EVENT_ID_ALIASES[event.id];
    if (alias && alias !== event.id) {
      modified = true;
      return { ...event, id: alias };
    }
    return event;
  });

  const canonicalMap = new Map(mockEvents.map((e) => [e.id, e]));

  // 2. Chuẩn hóa giá VND & Tier của từng sự kiện
  const normalized: EventItem[] = migratedEvents.map((event) => {
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

  // 3. Tự động kiểm tra và gộp (merge) danh sách mockEvents mới nếu trong storage chưa có hoặc thiếu
  const existingIds = new Set(normalized.map((e) => e.id));
  const existingTitles = new Set(normalized.map((e) => e.title.toLowerCase().trim()));

  for (const canonical of mockEvents) {
    const hasId = existingIds.has(canonical.id);
    const hasTitle = existingTitles.has(canonical.title.toLowerCase().trim());

    if (!hasId && !hasTitle) {
      normalized.push(canonical);
      existingIds.add(canonical.id);
      existingTitles.add(canonical.title.toLowerCase().trim());
      modified = true;
    }
  }

  // 4. Lưu lại vào localStorage v2 nếu có thay đổi hoặc v2 chưa được lưu
  if (modified || localStorage.getItem(INVENTORY_KEY) === null) {
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(normalized));
    } catch {
      // Best-effort storage sync
    }
  }

  return normalized;
}

/**
 * Đọc danh sách sự kiện và trạng thái tồn kho an toàn từ localStorage (v2).
 * Tự động migrate dữ liệu từ v1 sang v2 và tự động gộp (merge) danh sách mockEvents mới
 * vào localStorage nếu trong storage chưa có hoặc thiếu các ID sự kiện mới.
 */
export function getStoredEvents(): EventItem[] {
  try {
    let data = localStorage.getItem(INVENTORY_KEY);

    // Nếu v2 chưa có trong storage, kiểm tra key v1 cũ để migrate
    if (!data) {
      const legacyData = localStorage.getItem(LEGACY_INVENTORY_KEY);
      if (legacyData) {
        data = legacyData;
      }
    }

    if (!data) {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(mockEvents));
      return mockEvents;
    }

    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return normalizeEvents(parsed);
    }

    localStorage.setItem(INVENTORY_KEY, JSON.stringify(mockEvents));
    return mockEvents;
  } catch (error) {
    console.warn('[UniTicket Storage] Lỗi đọc localStorage inventory, sử dụng fallback mockEvents:', error);
    return mockEvents;
  }
}

/**
 * Alias getEvents theo đúng yêu cầu
 */
export const getEvents = getStoredEvents;

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
    const targetId = EVENT_ID_ALIASES[event.id] || event.id;
    const events = getStoredEvents();
    const index = events.findIndex((item) => item.id === targetId || item.id === event.id);
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
    const targetId = EVENT_ID_ALIASES[event.id] || event.id;
    const events = getStoredEvents();
    if (events.some((item) => item.id === targetId || item.id === event.id)) return false;
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
    const targetId = EVENT_ID_ALIASES[eventId] || eventId;
    const tickets = getStoredPurchasedTickets();
    if (tickets.some((ticket) => ticket.eventId === targetId || ticket.eventId === eventId)) {
      return { ok: false, message: 'This event has purchased tickets and cannot be deleted in the demo.' };
    }
    const events = getStoredEvents();
    if (!events.some((event) => event.id === targetId || event.id === eventId)) return { ok: false, message: 'Event not found.' };
    const saved = saveStoredEvents(events.filter((event) => event.id !== targetId && event.id !== eventId));
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
    const targetId = EVENT_ID_ALIASES[eventId] || eventId;
    const events = getStoredEvents();
    const eventIndex = events.findIndex(e => e.id === targetId || e.id === eventId);
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

/**
 * Chuyển quyền sở hữu vé (P2P Transfer) sang địa chỉ ví mới
 */
export function transferStoredTicket(
  ticketId: string,
  toWalletAddress: string
): { ok: boolean; message: string; ticket?: PurchasedTicket } {
  try {
    if (!ticketId || !toWalletAddress) {
      return { ok: false, message: 'Mã vé và địa chỉ ví người nhận là bắt buộc.' };
    }

    const trimmedWallet = toWalletAddress.trim();
    if (trimmedWallet.length < 32 || trimmedWallet.length > 44) {
      return { ok: false, message: 'Địa chỉ ví Solana không hợp lệ (cần 32-44 ký tự Base58).' };
    }

    const tickets = getStoredPurchasedTickets();
    const index = tickets.findIndex((t) => t.id === ticketId || t.ticketCode === ticketId);
    if (index === -1) {
      return { ok: false, message: 'Không tìm thấy vé trong hệ thống.' };
    }

    const ticket = tickets[index];

    // Kiểm tra xem vé đã check-in hay chưa
    const isAlreadyUsed = Boolean(
      ticket.isUsed ||
      ticket.isCheckedIn ||
      ticket.status === 'checked_in' ||
      ticket.status === 'CHECKED_IN'
    );
    if (isAlreadyUsed) {
      return { ok: false, message: 'Vé đã được check-in/sử dụng, không thể chuyển nhượng.' };
    }

    // Không cho chuyển cho chính ví hiện tại nếu trùng
    if (ticket.customerWallet && ticket.customerWallet.trim().toLowerCase() === trimmedWallet.toLowerCase()) {
      return { ok: false, message: 'Không thể chuyển nhượng cho chính địa chỉ ví hiện tại.' };
    }

    const previousOwner = ticket.customerWallet;
    const nowIso = new Date().toISOString();
    const updatedTicket: PurchasedTicket = {
      ...ticket,
      customerWallet: trimmedWallet,
      status: 'valid',
      isCheckedIn: false,
      isUsed: false,
      transferredAt: nowIso,
      transferredTo: trimmedWallet,
      transferredFrom: previousOwner,
      qrPayload: JSON.stringify({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        eventId: ticket.eventId,
        tierId: ticket.tierId,
        wallet: trimmedWallet,
        transferredAt: nowIso,
        v: 'p2p-v2',
      }),
    };

    const updatedTickets = [...tickets];
    updatedTickets[index] = updatedTicket;

    localStorage.setItem(TICKETS_KEY, JSON.stringify(updatedTickets));

    return {
      ok: true,
      message: 'Chuyển nhượng vé thành công!',
      ticket: updatedTicket,
    };
  } catch (error) {
    console.error('[UniTicket Storage] Lỗi chuyển nhượng vé:', error);
    return { ok: false, message: 'Đã xảy ra lỗi khi lưu thông tin chuyển nhượng.' };
  }
}
