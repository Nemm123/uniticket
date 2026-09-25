import { Router, type Request, type Response } from 'express';
import type { QueryResultRow } from 'pg';
import { pool } from '../db/pool.js';
import { sha256 } from '../auth/crypto.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const ticketsRouter = Router();

interface TicketRow extends QueryResultRow {
  id: string;
  order_id: string;
  event_id: string;
  event_title: string;
  event_banner: string;
  venue: string;
  city: string;
  event_date: string;
  event_time: string;
  tier_id: string;
  tier_name: string;
  seat: string;
  price_sol: string | number;
  ticket_code: string;
  customer_name: string;
  customer_email: string;
  customer_wallet: string;
  status: string;
  is_checked_in: boolean;
  check_in_time: Date | string | null;
  checked_in_by: string | null;
  owner_wallet: string | null;
  nft_status: string;
  nft_mint_address: string | null;
  nft_transaction_signature: string | null;
  nft_metadata_uri: string | null;
  nft_error: string | null;
  expires_at: Date | string | null;
  activated_at: Date | string | null;
  checked_in_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  qr_payload: string;
  qr_token_hash: string | null;
}

interface OrderRow extends QueryResultRow {
  id: string;
  guest_access_token_hash: string | null;
}

function mapTicket(row: TicketRow) {
  const checkInTimeIso = row.check_in_time
    ? (row.check_in_time instanceof Date ? row.check_in_time.toISOString() : new Date(row.check_in_time).toISOString())
    : undefined;

  const purchasedAtIso = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    orderId: row.order_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    eventBanner: row.event_banner,
    venue: row.venue,
    city: row.city,
    date: row.event_date,
    time: row.event_time,
    tierId: row.tier_id,
    tierName: row.tier_name,
    seat: row.seat,
    priceSol: Number(row.price_sol),
    ticketCode: row.ticket_code,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerWallet: row.customer_wallet,
    purchasedAt: purchasedAtIso,
    purchaseDate: purchasedAtIso,
    status: row.status as 'valid' | 'checked_in' | 'transferred' | 'cancelled',
    isCheckedIn: row.is_checked_in,
    checkInTime: checkInTimeIso,
    checkedInBy: row.checked_in_by ?? undefined,
    qrPayload: row.qr_payload,
    ownerWallet: row.owner_wallet ?? undefined,
    nftStatus: row.nft_status as 'PENDING' | 'MINTING' | 'MINTED' | 'MINT_FAILED',
    nftMintAddress: row.nft_mint_address ?? undefined,
    nftTransactionSignature: row.nft_transaction_signature ?? undefined,
    nftMetadataUri: row.nft_metadata_uri ?? undefined,
    nftError: row.nft_error ?? undefined,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : new Date(row.expires_at).toISOString()) : undefined,
    activatedAt: row.activated_at ? (row.activated_at instanceof Date ? row.activated_at.toISOString() : new Date(row.activated_at).toISOString()) : undefined,
    checkedInAt: row.checked_in_at ? (row.checked_in_at instanceof Date ? row.checked_in_at.toISOString() : new Date(row.checked_in_at).toISOString()) : undefined,
  };
}

function mapGuestTicket(row: TicketRow) {
  const purchasedAtIso = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    orderId: row.order_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    eventBanner: row.event_banner,
    venue: row.venue,
    city: row.city,
    date: row.event_date,
    time: row.event_time,
    tierId: row.tier_id,
    tierName: row.tier_name,
    seat: row.seat,
    priceSol: Number(row.price_sol),
    ticketCode: row.ticket_code,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerWallet: row.customer_wallet,
    purchasedAt: purchasedAtIso,
    purchaseDate: purchasedAtIso,
    status: row.status as 'valid' | 'checked_in' | 'transferred' | 'cancelled',
    isCheckedIn: row.is_checked_in,
    checkInTime: row.check_in_time ? (row.check_in_time instanceof Date ? row.check_in_time.toISOString() : new Date(row.check_in_time).toISOString()) : undefined,
    qrPayload: row.qr_payload,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : new Date(row.expires_at).toISOString()) : undefined,
    activatedAt: row.activated_at ? (row.activated_at instanceof Date ? row.activated_at.toISOString() : new Date(row.activated_at).toISOString()) : undefined,
  };
}

interface ParsedQrIdentifier {
  raw: string;
  tokenHash?: string;
  parsedCode?: string;
}

function parseTicketIdentifier(rawInput: unknown): ParsedQrIdentifier {
  if (!rawInput || typeof rawInput !== 'string') return { raw: '' };
  const trimmed = rawInput.trim();
  if (!trimmed) return { raw: '' };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        let tokenHash: string | undefined;
        let parsedCode: string | undefined;

        if (typeof parsed.token === 'string' && parsed.token.trim()) {
          tokenHash = sha256(parsed.token.trim());
        }
        if (typeof parsed.ticketCode === 'string' && parsed.ticketCode.trim()) {
          parsedCode = parsed.ticketCode.trim();
        }
        if (typeof parsed.ticketId === 'string' && parsed.ticketId.trim()) {
          parsedCode = parsed.ticketId.trim();
        }
        return { raw: trimmed, tokenHash, parsedCode };
      }
    } catch {
      // not JSON, continue with raw
    }
  }

  return { raw: trimmed };
}

async function canManageTicketCheckIn(ticket: TicketRow, request: Request): Promise<boolean> {
  if (request.auth!.role === 'admin') return true;

  const eventResult = await pool.query<{ organizer_wallet: string }>(
    'SELECT organizer_wallet FROM events WHERE id::text = $1 LIMIT 1;',
    [ticket.event_id]
  );

  return eventResult.rowCount === 1
    && eventResult.rows[0].organizer_wallet.toLowerCase() === request.auth!.walletAddress.toLowerCase();
}

async function isEligibleForCheckIn(ticket: TicketRow): Promise<boolean> {
  if (ticket.status !== 'valid' || ticket.is_checked_in || (ticket.expires_at && new Date(ticket.expires_at) <= new Date())) return false;
  const order = await pool.query<{ status: string; payment_status: string }>(
    'SELECT status, payment_status FROM orders WHERE id::text = $1 LIMIT 1',
    [ticket.order_id],
  );
  return order.rowCount === 1 && order.rows[0].status === 'TICKET_ACTIVE' && order.rows[0].payment_status === 'PAID';
}

/**
 * POST /api/tickets
 * Bulk or single ticket creation after checkout
 */
ticketsRouter.post('/', requireAuth, (_request: Request, response: Response) => {
  response.status(409).json({ error: 'Ticket issuance is unavailable until the verified order and payment flow is implemented.' });
});

/**
 * GET /api/tickets
 * List tickets filtered by wallet, eventId, or ticketCode
 */
ticketsRouter.get('/', requireAuth, async (request: Request, response: Response) => {
  try {
    const { wallet, eventId, ticketCode } = request.query;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (request.auth!.role !== 'admin') {
      values.push(request.auth!.walletAddress);
      conditions.push(`LOWER(customer_wallet) = LOWER($${values.length})`);
    } else if (typeof wallet === 'string' && wallet.trim()) {
      values.push(wallet.trim());
      conditions.push(`LOWER(customer_wallet) = LOWER($${values.length})`);
    }

    if (typeof eventId === 'string' && eventId.trim()) {
      values.push(eventId.trim());
      conditions.push(`event_id = $${values.length}`);
    }

    if (typeof ticketCode === 'string' && ticketCode.trim()) {
      values.push(ticketCode.trim());
      conditions.push(`ticket_code = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryText = `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT 200;`;

    const result = await pool.query<TicketRow>(queryText, values);
    response.json({ data: result.rows.map(mapTicket) });
  } catch (error) {
    console.error('[UniTicket API] Failed to fetch tickets:', error);
    response.status(500).json({ error: 'Could not fetch tickets from database.' });
  }
});

/**
 * GET /api/tickets/guest
 * Retrieve tickets for a specific order using guest access token.
 * Token is verified by hash comparison against orders.guest_access_token_hash.
 * Returns only tickets belonging to the matched order.
 * Excludes sensitive fields (nft_*, qr_token_hash, owner_wallet, checkedInBy).
 */
ticketsRouter.get('/guest', async (request: Request, response: Response) => {
  try {
    const guestAccessToken = typeof request.query.guestAccessToken === 'string' ? request.query.guestAccessToken.trim() : '';
    if (!guestAccessToken) {
      response.status(400).json({ error: 'guestAccessToken is required.' });
      return;
    }

    const tokenHash = sha256(guestAccessToken);

    const orderResult = await pool.query<OrderRow>('SELECT * FROM orders WHERE guest_access_token_hash = $1 LIMIT 1;', [tokenHash]);
    const order = orderResult.rows[0];
    if (!order) {
      response.status(404).json({ error: 'Order not found.' });
      return;
    }

    const ticketResult = await pool.query<TicketRow>('SELECT * FROM tickets WHERE order_id = $1 ORDER BY created_at DESC;', [order.id]);
    response.json({ data: ticketResult.rows.map(mapGuestTicket) });
  } catch (error) {
    console.error('[UniTicket API] Failed to fetch guest tickets:', error);
    response.status(500).json({ error: 'Could not fetch tickets from database.' });
  }
});

/**
 * POST /api/tickets/verify
 * Safe inspection of ticket validity without state changes
 */
ticketsRouter.post('/verify', requireAuth, requireRole('organizer', 'admin'), async (request: Request, response: Response) => {
  try {
    const { raw, tokenHash, parsedCode } = parseTicketIdentifier(
      request.body?.code ?? request.body?.ticketCode ?? request.body?.qrPayload ?? request.body?.input
    );

    if (!raw && !tokenHash && !parsedCode) {
      response.status(400).json({
        status: 'invalid',
        message: 'Mã QR hoặc mã vé không hợp lệ.',
      });
      return;
    }

    const result = await pool.query<TicketRow>(
      `SELECT * FROM tickets
       WHERE ticket_code = $1
          OR id::text = $1
          OR qr_payload = $1
          OR ($2 <> '' AND ticket_code = $2)
          OR ($2 <> '' AND id::text = $2)
          OR ($3 <> '' AND qr_token_hash = $3)
       LIMIT 1;`,
      [raw, parsedCode || '', tokenHash || '']
    );

    if (result.rowCount === 0) {
      response.status(200).json({
        status: 'invalid',
        message: 'Vé không tồn tại trong hệ thống.',
      });
      return;
    }

    const ticketRow = result.rows[0];
    if (!(await canManageTicketCheckIn(ticketRow, request))) {
      response.status(403).json({ status: 'error', message: 'You do not have access to tickets for this event.' });
      return;
    }
    const ticket = mapTicket(ticketRow);

    if (ticket.isCheckedIn || ticket.status === 'checked_in') {
      const checkInFormatted = ticket.checkInTime
        ? new Date(ticket.checkInTime).toLocaleString('vi-VN')
        : 'trước đó';
      response.status(200).json({
        status: 'used',
        message: `Vé này đã được sử dụng (check-in lúc ${checkInFormatted}).`,
        ticket,
      });
      return;
    }

    if (!(await isEligibleForCheckIn(ticketRow))) {
      response.status(200).json({ status: 'invalid', message: 'Vé chưa được kích hoạt, đã hết hạn hoặc thanh toán chưa được xác nhận.' });
      return;
    }

    response.status(200).json({
      status: 'valid',
      message: 'Vé hợp lệ. Sẵn sàng check-in.',
      ticket,
    });
  } catch (error) {
    console.error('[UniTicket API] Failed to verify ticket:', error);
    response.status(500).json({
      status: 'error',
      message: 'Lỗi kết nối máy chủ khi xác thực vé.',
    });
  }
});

/**
 * POST /api/tickets/check-in
 * Atomic check-in transition with concurrency lock
 */
ticketsRouter.post('/check-in', requireAuth, requireRole('organizer', 'admin'), async (request: Request, response: Response) => {
  try {
    const organizerWallet = request.auth!.walletAddress;
    if (!organizerWallet) {
      response.status(400).json({
        status: 'error',
        message: 'Địa chỉ ví ban tổ chức (organizer wallet) là bắt buộc.',
      });
      return;
    }

    const { raw, tokenHash, parsedCode } = parseTicketIdentifier(
      request.body?.code ?? request.body?.ticketCode ?? request.body?.ticketId ?? request.body?.qrPayload ?? request.body?.input
    );

    if (!raw && !tokenHash && !parsedCode) {
      response.status(400).json({
        status: 'invalid',
        message: 'Mã vé hoặc QR payload không hợp lệ.',
      });
      return;
    }

    const ticketResult = await pool.query<TicketRow>(
      `SELECT * FROM tickets
       WHERE ticket_code = $1
          OR id::text = $1
          OR qr_payload = $1
          OR ($2 <> '' AND ticket_code = $2)
          OR ($2 <> '' AND id::text = $2)
          OR ($3 <> '' AND qr_token_hash = $3)
       LIMIT 1;`,
      [raw, parsedCode || '', tokenHash || '']
    );

    if (ticketResult.rowCount === 0) {
      response.status(200).json({ status: 'invalid', message: 'Ticket was not found.' });
      return;
    }

    const ticketToUpdate = ticketResult.rows[0];

    if (!(await canManageTicketCheckIn(ticketToUpdate, request))) {
      response.status(403).json({ status: 'error', message: 'You do not have access to tickets for this event.' });
      return;
    }
    if (!(await isEligibleForCheckIn(ticketToUpdate))) {
      response.status(200).json({ status: 'invalid', message: 'Vé chưa được kích hoạt, đã hết hạn hoặc thanh toán chưa được xác nhận.' });
      return;
    }

    // Atomic update: only updates if is_checked_in is currently false
    const updateResult = await pool.query<TicketRow>(
      `UPDATE tickets
       SET 
         is_checked_in = TRUE,
         status = 'checked_in',
         check_in_time = NOW(),
         checked_in_at = NOW(),
         checked_in_by = $2,
         updated_at = NOW()
       WHERE id = $1
         AND is_checked_in = FALSE
         AND status = 'valid'
         AND (expires_at IS NULL OR expires_at > NOW())
         AND EXISTS (
           SELECT 1 FROM orders o
           WHERE o.id::text = tickets.order_id
             AND o.status = 'TICKET_ACTIVE'
             AND o.payment_status = 'PAID'
         )
       RETURNING *;`,
      [ticketToUpdate.id, organizerWallet]
    );

    if (updateResult.rowCount && updateResult.rowCount > 0) {
      const updatedTicket = mapTicket(updateResult.rows[0]);
      response.status(200).json({
        status: 'valid',
        message: 'Check-in thành công!',
        ticket: updatedTicket,
      });
      return;
    }

    // 0 rows updated: check whether ticket exists or was already checked in
    const checkResult = await pool.query<TicketRow>(
      `SELECT * FROM tickets WHERE id = $1 LIMIT 1;`,
      [ticketToUpdate.id]
    );

    if (checkResult.rowCount === 0) {
      response.status(200).json({
        status: 'invalid',
        message: 'Vé không tồn tại trong hệ thống.',
      });
      return;
    }

    const existingTicket = mapTicket(checkResult.rows[0]);
    const checkInFormatted = existingTicket.checkInTime
      ? new Date(existingTicket.checkInTime).toLocaleString('vi-VN')
      : 'trước đó';

    response.status(200).json({
      status: 'used',
      message: `Vé này đã được check-in lúc ${checkInFormatted}.`,
      ticket: existingTicket,
    });
  } catch (error) {
    console.error('[UniTicket API] Failed to check in ticket:', error);
    response.status(500).json({
      status: 'error',
      message: 'Lỗi kết nối máy chủ khi thực hiện check-in.',
    });
  }
});
