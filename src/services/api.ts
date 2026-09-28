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
    ticketCode: ticket.ticketCode || `UTK-${ticket.id.slice(-6)}`,
    customer_name: ticket.customerName || 'Khách tham dự',
    customer_email: ticket.customerEmail || 'customer@uniticket.io',
    customer_wallet: ticket.customerWallet || '',
    buyer_name: ticket.customerName || 'Khách tham dự',
    buyer_email: ticket.customerEmail || 'customer@uniticket.io',
    owner_address: ticket.customerWallet || '',
    wallet_address: ticket.customerWallet || '',
    status: ticket.status && (ticket.status === 'checked_in' || ticket.status === 'USED' || ticket.status === 'used') ? 'USED' : 'UNUSED',
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
 * Danh sách vé demo chuẩn để tự động nạp lên Supabase nếu bảng tickets đang rỗng
 */
export function getInitialDemoTickets(): PurchasedTicket[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'tkt-demo-anh-trai-say-hi-01',
      orderId: 'ORD-DEMO-2026-01',
      eventId: 'event-anh-trai-say-hi-2026',
      eventTitle: 'Anh Trai Say Hi - All-Star Concert 2026',
      eventBanner: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
      venue: 'Sân vận động Quân khu 7',
      city: 'TP. Hồ Chí Minh',
      date: '15/11/2026',
      time: '19:00 - 23:00',
      tierId: 'tier-vip-anh-trai',
      tierName: 'VIP Fanzone',
      seat: 'ZONE-VIP-A12',
      priceSol: 0.08,
      ticketCode: 'UTK-ATSH-8921',
      customerName: 'Nguyễn Văn Minh (Demo)',
      customerEmail: 'minh.nguyen@uniticket.io',
      customerWallet: 'CzQCjR6LqZPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcM',
      purchasedAt: nowIso,
      purchaseDate: nowIso,
      status: 'valid',
      isCheckedIn: false,
      isUsed: false,
      qrPayload: JSON.stringify({
        ticketId: 'tkt-demo-anh-trai-say-hi-01',
        ticketCode: 'UTK-ATSH-8921',
        eventId: 'event-anh-trai-say-hi-2026',
        wallet: 'CzQCjR6LqZPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcM',
      }),
      nftTransactionSignature: '5J4mZ9h7K8wPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcMDevnetTxDemo01',
      txSignature: '5J4mZ9h7K8wPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcMDevnetTxDemo01',
    },
    {
      id: 'tkt-demo-solana-vietnam-02',
      orderId: 'ORD-DEMO-2026-02',
      eventId: 'event-solana-vietnam-build-2026',
      eventTitle: 'Solana Vietnam Hacker House & Demo Day',
      eventBanner: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      venue: 'Trung tâm Đổi mới Sáng tạo Quốc gia (NIC Hòa Lạc)',
      city: 'Hà Nội',
      date: '25/10/2026',
      time: '08:30 - 18:00',
      tierId: 'tier-builder-solana',
      tierName: 'Builder All-Access',
      seat: 'DESK-NIC-B04',
      priceSol: 0.02,
      ticketCode: 'UTK-SOLVN-3419',
      customerName: 'Trần Thị Thu Hà (Demo)',
      customerEmail: 'ha.tran@uniticket.io',
      customerWallet: 'CzQCjR6LqZPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcM',
      purchasedAt: nowIso,
      purchaseDate: nowIso,
      status: 'valid',
      isCheckedIn: false,
      isUsed: false,
      qrPayload: JSON.stringify({
        ticketId: 'tkt-demo-solana-vietnam-02',
        ticketCode: 'UTK-SOLVN-3419',
        eventId: 'event-solana-vietnam-build-2026',
        wallet: 'CzQCjR6LqZPvW18q9q2GZ8wPq2xYFm4N7kLm6kFopcM',
      }),
      nftTransactionSignature: '3xN8kLm6kFopcMDevnetTxDemo02PvW18q9q2GZ8wPq2xYFm4N7',
      txSignature: '3xN8kLm6kFopcMDevnetTxDemo02PvW18q9q2GZ8wPq2xYFm4N7',
    },
  ];
}

/**
 * Truy vấn danh sách vé từ Supabase theo cột customer_wallet.
 * Nếu không có cấu hình Supabase hoặc gặp lỗi mạng, fallback về localStorage.
 * Nếu bảng tickets trên Supabase đang rỗng, tự động đẩy dữ liệu vé demo lên bảng.
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
        if (data.length > 0) {
          const rawTickets = data.map(supabaseRowToTicket);
          // Lọc loại bỏ vé trùng lặp theo id hoặc ticketCode
          const seen = new Set<string>();
          const tickets: PurchasedTicket[] = [];
          for (const t of rawTickets) {
            const key = t.ticketCode || t.id;
            if (key && !seen.has(key)) {
              seen.add(key);
              tickets.push(t);
            }
          }
          // Đồng bộ vào localStorage để duy trì cache cục bộ
          storage.savePurchasedTickets(tickets);
          return tickets;
        }

        // Bảng tickets trên Supabase đang rỗng -> Tự động nạp vé demo lên Cloud
        if (data.length === 0) {
          console.log('[Supabase Hydration] Bảng tickets đang rỗng, tự động nạp vé demo mẫu lên Cloud...');
          const demoTickets = getInitialDemoTickets();
          if (walletAddress) {
            demoTickets.forEach((t) => {
              t.customerWallet = walletAddress;
            });
          }
          const demoRows = demoTickets.map(ticketToSupabaseRow);
          const { data: insertedData, error: insertError } = await supabase
            .from('tickets')
            .insert(demoRows)
            .select();

          if (!insertError && insertedData && insertedData.length > 0) {
            const insertedTickets = insertedData.map(supabaseRowToTicket);
            storage.savePurchasedTickets(insertedTickets);
            return insertedTickets;
          } else {
            console.warn('[Supabase Hydration] Không thể chèn vé demo:', insertError?.message);
            storage.savePurchasedTickets(demoTickets);
            return demoTickets;
          }
        }
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
      const ticketsToInsert = tickets.map((t) => ({
        id: t.id,
        order_id: t.orderId || `ORD-${Date.now()}`,
        event_id: t.eventId || '',
        event_title: t.eventTitle || '',
        tier_id: t.tierId || '',
        tier_name: t.tierName || '',
        seat: t.seat || '',
        price_sol: Number(t.priceSol) || 0,
        ticket_code: t.ticketCode,
        ticketCode: t.ticketCode,
        owner_address: t.customerWallet || '',
        wallet_address: t.customerWallet || '',
        customer_wallet: t.customerWallet || '',
        buyer_name: t.customerName || 'Khách tham dự',
        customer_name: t.customerName || 'Khách tham dự',
        buyer_email: t.customerEmail || 'customer@uniticket.io',
        customer_email: t.customerEmail || 'customer@uniticket.io',
        status: 'UNUSED',
        price: t.priceSol,
        created_at: t.purchasedAt || new Date().toISOString(),
        qr_payload: t.qrPayload || '',
      }));
      await supabase.from('tickets').insert(tickets.map((t: any) => ({
        id: t.id,
        ticket_code: t.ticketCode || t.ticket_code,
        event_id: t.eventId || t.event_id,
        tier_id: t.tierId || t.tier_id,
        owner_address: t.ownerAddress || t.walletAddress || t.owner_address || t.customerWallet,
        buyer_name: t.buyerName || t.customerName || t.buyer_name,
        buyer_email: t.buyerEmail || t.customerEmail || t.buyer_email,
        status: 'UNUSED',
        price: t.price || t.priceSol,
        created_at: new Date().toISOString()
      })));
      const { error } = await supabase.from('tickets').insert(ticketsToInsert);
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

  // 1. Kiểm tra qua storage trước
  const localResult = storage.validateTicketForCheckIn(input);
  if (
    localResult.status === 'valid' ||
    localResult.status === 'used' ||
    (localResult.status === 'error' && localResult.message.includes('hết hạn'))
  ) {
    return localResult;
  }

  // 2. Nếu local không tìm thấy và Supabase đang bật, kiểm tra trên Supabase
  if (isSupabaseConfigured) {
    try {
      let target = input.trim();
      let timestamp: number | undefined;
      try {
        const parsed = JSON.parse(input);
        if (parsed && typeof parsed === 'object') {
          target = parsed.ticketCode || parsed.ticketId || parsed.id || target;
          timestamp = parsed.timestamp;
        }
      } catch {}

      if (typeof timestamp === 'number' && Date.now() - timestamp > 60000) {
        return {
          status: 'error',
          message: 'Mã QR đã hết hạn! Vui lòng mở ứng dụng UniTicket trực tiếp',
        };
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`id.eq.${target},ticket_code.eq.${target},signature.eq.${target}`)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const ticket = supabaseRowToTicket(data);
        const isUsed = Boolean(data.is_used || data.is_checked_in || data.status === 'checked_in');
        if (isUsed) {
          return {
            status: 'used',
            message: 'Vé đã được sử dụng! (Cảnh báo vé giả/quét trùng)',
            ticket,
          };
        }
        return {
          status: 'valid',
          message: 'Hợp lệ - Cho phép qua cổng',
          ticket,
        };
      }
    } catch (err) {
      console.warn('[Supabase API] Lỗi xác thực vé:', err);
    }
  }

  return localResult;
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
