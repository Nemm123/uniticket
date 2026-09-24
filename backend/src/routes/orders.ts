import { Router, type Request, type Response } from 'express';
import type { PoolClient, QueryResultRow } from 'pg';
import { randomToken, sha256 } from '../auth/crypto.js';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { optionalAuth } from '../middleware/auth.js';
import { getPaymentProvider } from '../services/payment.js';

export const ordersRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reservationTtlMs = env.reservationTtlSeconds * 1_000;
interface OrderRow extends QueryResultRow { id: string; order_code: string; buyer_wallet: string | null; guest_access_token_hash: string | null; customer_name: string; customer_email: string; event_id: string; status: string; subtotal_vnd: number | string; service_fee_vnd: number | string; total_vnd: number | string; currency: 'VND'; payment_method: string; payment_status: string; payment_provider_reference: string | null; payment_verified_at: Date | string | null; expires_at: Date; created_at: Date; }
interface ItemRow extends QueryResultRow { id: string; tier_id: string; quantity: number; unit_price_vnd: number | string; total_price_vnd: number | string; tier_name: string; }
interface TierRow extends QueryResultRow { id: string; event_id: string; name: string; price_vnd: number | string; remaining_quantity: number; }
const error = (response: Response, status: number, message: string) => response.status(status).json({ error: message });
const orderCode = () => `UT-${Date.now().toString(36).toUpperCase()}-${randomToken(5).toUpperCase()}`;
const accessToken = (request: Request) => request.header('x-order-access-token')?.trim() ?? '';

function parseItems(body: unknown): Array<{ tierId: string; quantity: number }> | null {
  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) return null;
  const used = new Set<string>();
  const parsed = items.map((item) => ({ tierId: typeof item?.tierId === 'string' ? item.tierId : '', quantity: Number(item?.quantity) }));
  return parsed.some((item) => !UUID.test(item.tierId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || used.has(item.tierId) || !used.add(item.tierId)) ? null : parsed;
}
async function loadOrder(client: PoolClient, id: string): Promise<{ order: OrderRow; items: ItemRow[] } | null> {
  const order = (await client.query<OrderRow>('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
  if (!order) return null;
  const items = await client.query<ItemRow>('SELECT oi.id,oi.tier_id,oi.quantity,oi.unit_price_vnd,oi.total_price_vnd,t.name AS tier_name FROM order_items oi JOIN event_ticket_tiers t ON t.id=oi.tier_id WHERE oi.order_id=$1 ORDER BY oi.created_at', [id]);
  return { order, items: items.rows };
}
function responseFor(loaded: { order: OrderRow; items: ItemRow[] }, guestAccessToken?: string) {
  const { order, items } = loaded;
  const subtotalVnd = Number(order.subtotal_vnd); const totalVnd = Number(order.total_vnd);
  return { id: order.id, orderCode: order.order_code, eventId: order.event_id, customerName: order.customer_name, customerEmail: order.customer_email, status: order.status, currency: 'VND', subtotalVnd, serviceFeeVnd: Number(order.service_fee_vnd), totalVnd, subtotal: subtotalVnd, total: totalVnd, paymentMethod: order.payment_method, paymentStatus: order.payment_status, paymentProviderReference: order.payment_provider_reference, paymentVerifiedAt: order.payment_verified_at ? (order.payment_verified_at instanceof Date ? order.payment_verified_at.toISOString() : new Date(order.payment_verified_at).toISOString()) : undefined, expiresAt: order.expires_at.toISOString(), createdAt: order.created_at.toISOString(), guestAccessToken: guestAccessToken ?? undefined, items: items.map((item) => ({ id: item.id, tierId: item.tier_id, tierName: item.tier_name, quantity: item.quantity, unitPriceVnd: Number(item.unit_price_vnd), totalPriceVnd: Number(item.total_price_vnd) })) };
}
async function expireReservations(client: PoolClient): Promise<void> {
  const expired = await client.query<OrderRow>("SELECT * FROM orders WHERE status = 'PAYMENT_PENDING' AND expires_at <= NOW() FOR UPDATE");
  for (const order of expired.rows) {
    const items = await client.query<{ tier_id: string; quantity: number }>('SELECT tier_id,quantity FROM order_items WHERE order_id=$1', [order.id]);
    for (const item of items.rows) await client.query('UPDATE event_ticket_tiers SET remaining_quantity=remaining_quantity+$1,reserved_quantity=reserved_quantity-$1,updated_at=NOW() WHERE id=$2', [item.quantity, item.tier_id]);
    await client.query("UPDATE orders SET status='EXPIRED',payment_status='FAILED',updated_at=NOW() WHERE id=$1", [order.id]);
  }
}
function mayAccess(order: OrderRow & { guest_access_token_hash: string | null }, request: Request): boolean {
  if (request.auth?.walletAddress && order.buyer_wallet?.toLowerCase() === request.auth.walletAddress.toLowerCase()) return true;
  const token = accessToken(request);
  return Boolean(token && order.guest_access_token_hash && sha256(token) === order.guest_access_token_hash);
}

ordersRouter.post('/', optionalAuth, async (request, response) => {
  const eventId = typeof request.body?.eventId === 'string' ? request.body.eventId : '';
  const items = parseItems(request.body); const key = request.header('idempotency-key')?.trim() ?? '';
  if (!UUID.test(eventId) || !items || key.length < 8 || key.length > 200) return error(response, 422, 'eventId, valid items, and an Idempotency-Key are required.');

  const customerName = typeof request.body?.customerName === 'string' ? request.body.customerName.trim() : '';
  const customerEmail = typeof request.body?.customerEmail === 'string' ? request.body.customerEmail.trim() : '';
  if (!customerName || customerName.length < 2) return error(response, 422, 'customerName is required (minimum 2 characters).');
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return error(response, 422, 'customerEmail is required and must be a valid email address.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await expireReservations(client);
    const event = await client.query<{ id: string }>("SELECT id FROM events WHERE id=$1 AND status='published' FOR KEY SHARE", [eventId]);
    if (!event.rows[0]) { await client.query('ROLLBACK'); return error(response, 404, 'Published event was not found.'); }
    const tiers = await client.query<TierRow>('SELECT id,event_id,name,price_vnd,remaining_quantity FROM event_ticket_tiers WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [items.map((item) => item.tierId)]);
    if (tiers.rows.length !== items.length || tiers.rows.some((tier) => tier.event_id !== eventId)) { await client.query('ROLLBACK'); return error(response, 422, 'Ticket tiers must belong to the selected event.'); }
    const quantities = new Map(items.map((item) => [item.tierId, item.quantity]));
    if (tiers.rows.some((tier) => tier.remaining_quantity < (quantities.get(tier.id) ?? 0))) { await client.query('ROLLBACK'); return error(response, 409, 'Insufficient ticket inventory.'); }
    let subtotalVnd = 0;
    for (const tier of tiers.rows) {
      const quantity = quantities.get(tier.id)!; const unitPriceVnd = Number(tier.price_vnd); const totalPriceVnd = unitPriceVnd * quantity; subtotalVnd += totalPriceVnd;
    }
    const serviceFeeVnd = env.serviceFeeVnd;
    const totalVnd = subtotalVnd + serviceFeeVnd;
    const guestAccessToken = request.auth ? undefined : randomToken(32);
    const created = await client.query<OrderRow>("INSERT INTO orders (order_code,buyer_wallet,guest_access_token_hash,event_id,customer_name,customer_email,status,subtotal,total,subtotal_vnd,service_fee_vnd,total_vnd,currency,payment_method,payment_status,idempotency_key,expires_at) VALUES ($1,$2,$3,$4,$5,$6,'PAYMENT_PENDING',$7::numeric,$7::numeric,$7::bigint,$8::bigint,$9::bigint,'VND','DEMO_PAYMENT','PENDING',$10,$11) RETURNING *", [orderCode(), request.auth?.walletAddress ?? null, guestAccessToken ? sha256(guestAccessToken) : null, eventId, customerName, customerEmail, subtotalVnd, serviceFeeVnd, totalVnd, key, new Date(Date.now() + reservationTtlMs)]);
    for (const tier of tiers.rows) {
      const quantity = quantities.get(tier.id)!;
      await client.query('UPDATE event_ticket_tiers SET remaining_quantity=remaining_quantity-$1,reserved_quantity=reserved_quantity+$1,updated_at=NOW() WHERE id=$2', [quantity, tier.id]);
      const unitPriceVnd = Number(tier.price_vnd); const totalPriceVnd = unitPriceVnd * quantity;
      await client.query('INSERT INTO order_items (order_id,tier_id,quantity,unit_price,subtotal,unit_price_vnd,total_price_vnd) VALUES ($1,$2,$3,0,0,$4,$5)', [created.rows[0].id, tier.id, quantity, unitPriceVnd, totalPriceVnd]);
    }
    const loaded = await loadOrder(client, created.rows[0].id); await client.query('COMMIT'); response.status(201).json({ data: responseFor(loaded!, guestAccessToken) });
  } catch (cause) { await client.query('ROLLBACK'); console.error('[UniTicket Orders] Failed to create order:', cause); error(response, 503, 'Could not create a ticket order.'); } finally { client.release(); }
});

ordersRouter.post('/:id/demo-pay', optionalAuth, async (request, response) => {
  const orderId = typeof request.params.id === 'string' ? request.params.id : '';
  if (!UUID.test(orderId)) return error(response, 404, 'Order was not found.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await expireReservations(client);
    const result = await client.query<OrderRow>('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    const order = result.rows[0];
    if (!order || !mayAccess(order, request)) { await client.query('ROLLBACK'); return error(response, 404, 'Order was not found.'); }
    if (order.status === 'EXPIRED') { await client.query('ROLLBACK'); return error(response, 409, 'Reservation has expired.'); }
    if (order.status === 'TICKET_ACTIVE') { const loaded = await loadOrder(client, order.id); await client.query('COMMIT'); return response.json({ data: responseFor(loaded!) }); }
    if (order.status !== 'PAYMENT_PENDING') { await client.query('ROLLBACK'); return error(response, 409, 'Order cannot be paid in its current state.'); }
    const paymentProvider = getPaymentProvider(order.payment_method as import('../services/payment.js').PaymentMethod);
    const verified = await paymentProvider.verifyPayment({ orderId: order.id, totalVnd: Number(order.total_vnd) });
    await client.query("UPDATE orders SET status='PAID',payment_status='PAID',payment_provider_reference=$2,payment_verified_at=$3,updated_at=NOW() WHERE id=$1", [order.id, verified.providerReference, verified.verifiedAt]);
    const loaded = await loadOrder(client, order.id);
    const event = await client.query<{ title: string; banner_image: string; venue: string; city: string; event_date: string; event_time: string }>('SELECT title,banner_image,venue,city,event_date,event_time FROM events WHERE id=$1', [order.event_id]);
    for (const item of loaded!.items) for (let sequence = 1; sequence <= item.quantity; sequence += 1) {
      const rawQrToken = randomToken(32); const ticketCode = `UTD-${order.order_code}-${item.id.slice(0, 8)}-${sequence}`;
      await client.query("INSERT INTO tickets (order_id,event_id,event_title,event_banner,venue,city,event_date,event_time,tier_id,tier_name,seat,price_sol,ticket_code,customer_name,customer_email,customer_wallet,owner_wallet,status,is_checked_in,qr_payload,qr_token_hash,nft_status,activated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$15,'valid',FALSE,$16,$17,'PENDING',NOW())", [order.id,order.event_id,event.rows[0].title,event.rows[0].banner_image,event.rows[0].venue,event.rows[0].city,String(event.rows[0].event_date),event.rows[0].event_time,item.tier_id,item.tier_name,`GENERAL-${sequence}`,ticketCode,order.customer_name,order.customer_email,order.buyer_wallet,JSON.stringify({ version: 'v1', token: rawQrToken }),sha256(rawQrToken)]);
      await client.query('UPDATE event_ticket_tiers SET reserved_quantity=reserved_quantity-1,updated_at=NOW() WHERE id=$1', [item.tier_id]);
    }
    await client.query("UPDATE orders SET status='TICKET_ACTIVE',updated_at=NOW() WHERE id=$1", [order.id]);
    const complete = await loadOrder(client, order.id); await client.query('COMMIT'); response.json({ data: responseFor(complete!, accessToken(request) || undefined) });
  } catch (cause) { await client.query('ROLLBACK'); console.error('[UniTicket Orders] Demo payment failed:', cause); error(response, 503, 'Could not verify demo payment.'); } finally { client.release(); }
});
