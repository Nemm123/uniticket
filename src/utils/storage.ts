import { CheckInRecord, CheckInResult, EventItem, PurchasedTicket } from '../types';
import { mockEvents } from '../data/mockEvents';

const INVENTORY_KEY = 'uniticket_events_inventory';
const TICKETS_KEY = 'uniticket_purchased_tickets';
const CHECKIN_HISTORY_KEY = 'uniticket_checkin_history';

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
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return mockEvents;
  } catch (error) {
    console.warn('[UniTicket Storage] Lỗi đọc localStorage inventory, sử dụng fallback mockEvents:', error);
    return mockEvents;
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
