import { EventItem, PurchasedTicket, CheckInResult } from '../types';
import * as storage from '../utils/storage';
import { getWalletSession } from './authSession';
import { supabase, isSupabaseConfigured } from './supabase';

const MOCK_DELAY = 100; // ms

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chuyển đổi dữ liệu vé giữa PurchasedTicket của Frontend và Record của Supabase
 */
export function ticketToSupabaseRow(ticket: PurchasedTicket) {
  const nowIso = new Date().toISOString();
  return {
    id: ticket.id,
    order_id: ticket.orderId || `ORD-${Date.now()}`,
    event_id: ticket.eventId || '',
    event_title: ticket.eventTitle || '',
    event_banner: ticket.eventBanner || '',
    venue: ticket.venue || '',
    city: ticket.city || '',
    event_date: ticket.date || '',
    event_time: ticket.time || '',
    tier_id: ticket.tierId || '',
    tier_name: ticket.tierName || '',
    seat: ticket.seat || '',
    price_sol: Number(ticket.priceSol) || 0,
    ticket_code: ticket.ticketCode || `UTK-${ticket.id.slice(-6)}`,
    customer_name: ticket.customerName || 'Khách tham dự',
    customer_email: ticket.customerEmail || 'customer@uniticket.io',
    customer_wallet: ticket.customerWallet || '',
    status: ticket.status ? String(ticket.status).toLowerCase() : (ticket.isCheckedIn ? 'checked_in' : 'valid'),
    is_checked_in: Boolean(ticket.isCheckedIn || ticket.isUsed),
    is_used: Boolean(ticket.isUsed || ticket.isCheckedIn),
    check_in_time: ticket.checkInTime || null,
    checked_in_at: ticket.checkInTime || null,
    checked_in_by: ticket.checkedInBy || null,
    transferred_at: ticket.transferredAt || null,
    transferred_to: ticket.transferredTo || null,
    transferred_from: ticket.transferredFrom || null,
    qr_payload: ticket.qrPayload || '',
    created_at: ticket.purchasedAt || nowIso,
    updated_at: nowIso,
  };
}

export function supabaseRowToTicket(row: any): PurchasedTicket {
  const isCheckedIn = Boolean(row.is_checked_in || row.is_used || row.status === 'checked_in');
  return {
    id: String(row.id),
    orderId: row.order_id || '',
    eventId: row.event_id || '',
    eventTitle: row.event_title || '',
    eventBanner: row.event_banner || '',
    venue: row.venue || '',
    city: row.city || '',
    date: row.event_date || row.date || '',
    time: row.event_time || row.time || '',
    tierId: row.tier_id || '',
    tierName: row.tier_name || '',
    seat: row.seat || '',
    priceSol: Number(row.price_sol) || 0,
    ticketCode: row.ticket_code || '',
    customerName: row.customer_name || '',
    customerEmail: row.customer_email || '',
    customerWallet: row.customer_wallet || '',
    purchasedAt: row.created_at || row.purchased_at || new Date().toISOString(),
    purchaseDate: row.created_at || row.purchase_date || new Date().toISOString(),
    status: isCheckedIn ? 'checked_in' : (row.status || 'valid'),
    isCheckedIn,
    isUsed: Boolean(row.is_used || row.is_checked_in),
    checkInTime: row.check_in_time || row.checked_in_at || undefined,
    checkedInBy: row.checked_in_by || undefined,
    transferredAt: row.transferred_at || undefined,
    transferredTo: row.transferred_to || undefined,
    transferredFrom: row.transferred_from || undefined,
    qrPayload: row.qr_payload || '',
    txSignature: row.tx_signature || row.signature || undefined,
    signature: row.tx_signature || row.signature || undefined,
    nftTransactionSignature: row.tx_signature || undefined,
    nftMintAddress: row.nft_mint_address || undefined,
    nftStatus: row.nft_status || 'MINTED',
  };
}

// -------------------------------------
// TICKETS (SUPABASE + LOCALSTORAGE FALLBACK)
// -------------------------------------

/**
 * Truy vấn danh sách vé từ Supabase theo cột customer_wallet.
 * Nếu không có cấu hình Supabase hoặc gặp lỗi mạng, fallback về localStorage.
 */
export async function getPurchasedTickets(walletAddress?: string): Promise<PurchasedTicket[]> {
  await delay(MOCK_DELAY);

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (walletAddress) {
        query = query.ilike('customer_wallet', walletAddress);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const tickets = data.map(supabaseRowToTicket);
        // Đồng bộ vào localStorage để duy trì cache cục bộ
        if (tickets.length > 0) {
          storage.savePurchasedTickets(tickets);
        }
        return tickets;
      }
      if (error) {
        console.warn('[Supabase API] Lỗi truy vấn bảng tickets, dùng fallback localStorage:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase API] Ngoại lệ khi truy vấn tickets:', err);
    }
  }

  // Fallback an toàn về localStorage
  const localTickets = storage.getStoredPurchasedTickets();
  if (!walletAddress) return localTickets;
  return localTickets.filter(
    (t) => t.customerWallet?.toLowerCase() === walletAddress.toLowerCase()
  );
}

/**
 * Tương thích ngược với các components đang gọi fetchMyTickets
 */
export async function fetchMyTickets(params?: { wallet?: string; eventId?: string; ticketCode?: string }): Promise<PurchasedTicket[]> {
  const allTickets = await getPurchasedTickets(params?.wallet);
  if (!params) return allTickets;

  return allTickets.filter((t) => {
    let match = true;
    if (params.wallet && t.customerWallet?.toLowerCase() !== params.wallet.toLowerCase()) match = false;
    if (params.eventId && t.eventId !== params.eventId) match = false;
    if (params.ticketCode && t.ticketCode !== params.ticketCode) match = false;
    return match;
  });
}

/**
 * Thêm dòng mới vào bảng tickets trên Supabase sau khi mint thành công on-chain.
 */
export async function createTicket(ticketData: PurchasedTicket): Promise<{ ok: boolean; ticket?: PurchasedTicket; error?: string }> {
  // Đồng bộ lưu vào localStorage để đảm bảo dữ liệu luôn sẵn sàng
  storage.savePurchasedTickets([ticketData]);

  if (isSupabaseConfigured) {
    try {
      const row = ticketToSupabaseRow(ticketData);
      const { data, error } = await supabase
        .from('tickets')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.warn('[Supabase API] Lỗi chèn vé vào Supabase:', error.message);
        return { ok: false, error: error.message, ticket: ticketData };
      }
      return { ok: true, ticket: data ? supabaseRowToTicket(data) : ticketData };
    } catch (err: any) {
      console.warn('[Supabase API] Ngoại lệ tạo vé Supabase:', err);
      return { ok: false, error: err?.message || 'Lỗi mạng', ticket: ticketData };
    }
  }

  return { ok: true, ticket: ticketData };
}

/**
 * Lưu danh sách nhiều vé khi mua nhiều số lượng
 */
export async function createTickets(
  eventId: string,
  tierId: string,
  quantity: number,
  tickets: PurchasedTicket[]
): Promise<boolean> {
  await delay(MOCK_DELAY);
  const localSaved = storage.savePurchaseAtomically(eventId, tierId, quantity, tickets);

  if (isSupabaseConfigured) {
    try {
      const rows = tickets.map(ticketToSupabaseRow);
      const { error } = await supabase.from('tickets').insert(rows);
      if (error) {
        console.warn('[Supabase API] Lỗi chèn nhiều vé Supabase:', error.message);
      }
    } catch (err) {
      console.warn('[Supabase API] Ngoại lệ chèn nhiều vé Supabase:', err);
    }
  }

  return localSaved;
}

/**
 * Soát vé và check-in vé trên Supabase (cập nhật is_used = true, is_checked_in = true, checked_in_at = new Date())
 */
export async function checkInTicket(ticketId: string, operatorWallet?: string): Promise<CheckInResult> {
  await delay(MOCK_DELAY);
  const session = getWalletSession();
  const checkedInBy = operatorWallet || session?.walletAddress || 'Organizers';
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update({
          is_used: true,
          is_checked_in: true,
          checked_in_at: nowIso,
          check_in_time: nowIso,
          checked_in_by: checkedInBy,
          status: 'checked_in',
          updated_at: nowIso,
        })
        .or(`id.eq.${ticketId},ticket_code.eq.${ticketId}`)
        .select()
        .single();

      if (!error && data) {
        storage.confirmTicketCheckIn(ticketId, checkedInBy);
        return {
          status: 'valid',
          message: 'Hợp lệ - Cho phép qua cổng',
          ticket: supabaseRowToTicket(data),
        };
      }
    } catch (err) {
      console.warn('[Supabase API] Lỗi check-in vé trên Supabase:', err);
    }
  }

  // Fallback về localStorage
  return storage.confirmTicketCheckIn(ticketId, checkedInBy);
}

// Alias cho confirmCheckIn để đảm bảo tương thích ngược
export const confirmCheckIn = checkInTicket;

/**
 * Xác thực vé trước khi check-in
 */
export async function verifyTicketCheckIn(input: string): Promise<CheckInResult> {
  await delay(MOCK_DELAY);
  return storage.validateTicketForCheckIn(input);
}

/**
 * Chuyển nhượng vé on-chain P2P:
 * Cập nhật customer_wallet = toWalletAddress, lưu transferred_at trên Supabase
 */
export async function transferTicket(
  ticketId: string,
  toWalletAddress: string
): Promise<{ ok: boolean; message: string; ticket?: PurchasedTicket }> {
  await delay(MOCK_DELAY);
  const nowIso = new Date().toISOString();
  const trimmedWallet = toWalletAddress.trim();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .update({
          customer_wallet: trimmedWallet,
          transferred_at: nowIso,
          transferred_to: trimmedWallet,
          status: 'valid',
          is_checked_in: false,
          is_used: false,
          updated_at: nowIso,
        })
        .or(`id.eq.${ticketId},ticket_code.eq.${ticketId}`)
        .select()
        .single();

      if (!error && data) {
        storage.transferStoredTicket(ticketId, trimmedWallet);
        return {
          ok: true,
          message: 'Chuyển nhượng vé thành công!',
          ticket: supabaseRowToTicket(data),
        };
      }
    } catch (err) {
      console.warn('[Supabase API] Lỗi cập nhật chuyển nhượng vé trên Supabase:', err);
    }
  }

  // Fallback về localStorage
  return storage.transferStoredTicket(ticketId, trimmedWallet);
}

/**
 * Tra cứu vé theo ID hoặc TicketCode (cho trang /verify/:ticketId)
 */
export async function getTicketById(identifier: string): Promise<PurchasedTicket | null> {
  await delay(MOCK_DELAY);
  const trimmed = identifier.trim();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`id.eq.${trimmed},ticket_code.eq.${trimmed},order_id.eq.${trimmed}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return supabaseRowToTicket(data);
      }
    } catch (err) {
      console.warn('[Supabase API] Lỗi tra cứu vé theo ID trên Supabase:', err);
    }
  }

  return storage.getStoredTicketById(trimmed);
}

// -------------------------------------
// EVENTS
// -------------------------------------

export async function fetchEvents(): Promise<EventItem[]> {
  await delay(MOCK_DELAY);
  return storage.getStoredEvents();
}

export async function updateEvent(event: EventItem): Promise<boolean> {
  await delay(MOCK_DELAY);
  return storage.updateStoredEvent(event);
}
