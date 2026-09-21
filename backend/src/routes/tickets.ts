import { Router, type Request, type Response } from 'express';
import type { QueryResultRow } from 'pg';
import { pool } from '../db/pool.js';

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
  qr_payload: string;
  created_at: Date | string;
  updated_at: Date | string;
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
  };
}

function extractIdentifier(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Attempt to parse as JSON QR payload
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.ticketCode === 'string' && parsed.ticketCode.trim()) {
          return parsed.ticketCode.trim();
        }
        if (typeof parsed.ticketId === 'string' && parsed.ticketId.trim()) {
          return parsed.ticketId.trim();
        }
      }
    } catch {
      // Not JSON, continue with raw string
    }
  }

  return trimmed;
}

/**
 * POST /api/tickets
 * Bulk or single ticket creation after checkout
 */
ticketsRouter.post('/', async (request: Request, response: Response) => {
  const client = await pool.connect();
  try {
    const body = request.body;
    const rawTickets = Array.isArray(body?.tickets)
      ? body.tickets
      : (body ? [body] : []);

    if (rawTickets.length === 0) {
      response.status(400).json({ error: 'At least one ticket must be provided.' });
      return;
    }

    await client.query('BEGIN');

    const createdTickets: TicketRow[] = [];

    for (let i = 0; i < rawTickets.length; i++) {
      const item = rawTickets[i];
      const customerWallet = String(item.customerWallet || '').trim();
      const customerName = String(item.customerName || '').trim();
      const customerEmail = String(item.customerEmail || '').trim();
      const eventId = String(item.eventId || '').trim();
      const orderId = String(item.orderId || `ORD-${Date.now()}-${i + 1}`).trim();

      if (!customerWallet || !customerName || !eventId) {
        throw new Error(`Ticket at index ${i} requires customerWallet, customerName and eventId.`);
      }

      // Generate or use ticketCode
      let ticketCode = String(item.ticketCode || '').trim();
      if (!ticketCode) {
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        ticketCode = `UT-SOL-${Date.now().toString(36).toUpperCase()}-${rand}`;
      }

      const eventTitle = String(item.eventTitle || '').trim();
      const eventBanner = String(item.eventBanner || '').trim();
      const venue = String(item.venue || '').trim();
      const city = String(item.city || '').trim();
      const eventDate = String(item.date || item.eventDate || '').trim();
      const eventTime = String(item.time || item.eventTime || '').trim();
      const tierId = String(item.tierId || '').trim();
      const tierName = String(item.tierName || 'Standard Ticket').trim();
      const seat = String(item.seat || `GA-${i + 1}`).trim();
      const priceSol = Number(item.priceSol ?? 0);

      // Construct safe standardized QR payload
      const qrPayloadObj = {
        ticketCode,
        orderId,
        eventId,
        tierId,
        customerWallet,
        customerName,
        seat,
        timestamp: Date.now(),
        signatureVersion: 'mock-v1',
      };
      const qrPayload = item.qrPayload || JSON.stringify(qrPayloadObj);

      const insertResult = await client.query<TicketRow>(
        `INSERT INTO tickets (
          order_id, event_id, event_title, event_banner, venue, city,
          event_date, event_time, tier_id, tier_name, seat, price_sol,
          ticket_code, customer_name, customer_email, customer_wallet,
          status, is_checked_in, qr_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          'valid', FALSE, $17
        ) RETURNING *;`,
        [
          orderId, eventId, eventTitle, eventBanner, venue, city,
          eventDate, eventTime, tierId, tierName, seat, priceSol,
          ticketCode, customerName, customerEmail, customerWallet,
          qrPayload
        ]
      );

      createdTickets.push(insertResult.rows[0]);
    }

    await client.query('COMMIT');

    response.status(201).json({
      data: createdTickets.map(mapTicket),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UniTicket API] Failed to create tickets:', error);
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Could not create tickets in database.',
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/tickets
 * List tickets filtered by wallet, eventId, or ticketCode
 */
ticketsRouter.get('/', async (request: Request, response: Response) => {
  try {
    const { wallet, eventId, ticketCode } = request.query;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (typeof wallet === 'string' && wallet.trim()) {
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
 * POST /api/tickets/verify
 * Safe inspection of ticket validity without state changes
 */
ticketsRouter.post('/verify', async (request: Request, response: Response) => {
  try {
    const identifier = extractIdentifier(
      request.body?.code ?? request.body?.ticketCode ?? request.body?.qrPayload ?? request.body?.input
    );

    if (!identifier) {
      response.status(400).json({
        status: 'invalid',
        message: 'Mã QR hoặc mã vé không hợp lệ.',
      });
      return;
    }

    const result = await pool.query<TicketRow>(
      `SELECT * FROM tickets WHERE ticket_code = $1 OR id::text = $1 LIMIT 1;`,
      [identifier]
    );

    if (result.rowCount === 0) {
      response.status(200).json({
        status: 'invalid',
        message: 'Vé không tồn tại trong hệ thống.',
      });
      return;
    }

    const ticketRow = result.rows[0];
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
ticketsRouter.post('/check-in', async (request: Request, response: Response) => {
  try {
    const organizerWallet = String(request.body?.organizerWallet || '').trim();
    if (!organizerWallet) {
      response.status(400).json({
        status: 'error',
        message: 'Địa chỉ ví ban tổ chức (organizer wallet) là bắt buộc.',
      });
      return;
    }

    const identifier = extractIdentifier(
      request.body?.code ?? request.body?.ticketCode ?? request.body?.ticketId ?? request.body?.input
    );

    if (!identifier) {
      response.status(400).json({
        status: 'invalid',
        message: 'Mã vé hoặc QR payload không hợp lệ.',
      });
      return;
    }

    // Atomic update: only updates if is_checked_in is currently false
    const updateResult = await pool.query<TicketRow>(
      `UPDATE tickets
       SET 
         is_checked_in = TRUE,
         status = 'checked_in',
         check_in_time = NOW(),
         checked_in_by = $2,
         updated_at = NOW()
       WHERE (ticket_code = $1 OR id::text = $1)
         AND is_checked_in = FALSE
       RETURNING *;`,
      [identifier, organizerWallet]
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
      `SELECT * FROM tickets WHERE ticket_code = $1 OR id::text = $1 LIMIT 1;`,
      [identifier]
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
