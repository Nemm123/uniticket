import { Router, type Response } from 'express';
import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_STATUSES = new Set(['draft', 'published', 'cancelled']);

type EventStatus = 'draft' | 'published' | 'cancelled';

interface EventTierInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  priceSol?: unknown;
  priceVnd?: unknown;
  perks?: unknown;
  totalQuantity?: unknown;
  remainingQuantity?: unknown;
  colorHex?: unknown;
}

interface EventInput {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  category?: unknown;
  bannerImage?: unknown;
  thumbnailImage?: unknown;
  date?: unknown;
  eventDate?: unknown;
  time?: unknown;
  eventTime?: unknown;
  venue?: unknown;
  city?: unknown;
  status?: unknown;
  featured?: unknown;
  tags?: unknown;
  lineup?: unknown;
  tiers?: unknown;
}

interface ValidatedTier {
  id: string | undefined;
  name: string;
  description: string;
  priceSol: number;
  priceVnd: number;
  perks: string[];
  totalQuantity: number;
  remainingQuantity: number;
  colorHex: string | null;
}

interface ValidatedEvent {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  bannerImage: string;
  thumbnailImage: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  status: EventStatus;
  featured: boolean;
  tags: string[];
  lineup: string[];
  tiers: ValidatedTier[];
}

interface EventRow extends QueryResultRow {
  id: string;
  organizer_wallet: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  banner_image: string;
  thumbnail_image: string;
  event_date: string | Date;
  event_time: string;
  venue: string;
  city: string;
  status: EventStatus;
  featured: boolean;
  tags: string[];
  lineup: string[];
  created_at: string | Date;
  updated_at: string | Date;
  tiers: Array<{
    id: string;
    name: string;
    description: string;
    price_sol: string | number;
    price_vnd: string | number;
    perks: string[];
    total_quantity: number;
    remaining_quantity: number;
    color_hex: string | null;
  }>;
}

const eventsRouter = Router();

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const stringList = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value.map((item) => item.trim()).filter(Boolean);
};

function validateTier(value: unknown, index: number): ValidatedTier {
  if (!value || typeof value !== 'object') throw new Error(`tiers[${index}] must be an object.`);
  const tier = value as EventTierInput;
  const name = text(tier.name);
  const description = text(tier.description);
  const priceSol = typeof tier.priceSol === 'number' ? tier.priceSol : Number(tier.priceSol);
  const priceVnd = typeof tier.priceVnd === 'number' ? tier.priceVnd : Number(tier.priceVnd);
  const totalQuantity = typeof tier.totalQuantity === 'number' ? tier.totalQuantity : Number(tier.totalQuantity);
  const remainingQuantity = typeof tier.remainingQuantity === 'number' ? tier.remainingQuantity : Number(tier.remainingQuantity);
  const perks = stringList(tier.perks ?? []);
  const id = typeof tier.id === 'string' && UUID_PATTERN.test(tier.id) ? tier.id : undefined;

  if (!name) throw new Error(`tiers[${index}].name is required.`);
  if (!Number.isFinite(priceSol) || priceSol < 0) throw new Error(`tiers[${index}].priceSol must be a non-negative number.`);
  const managedPriceVnd = Number.isInteger(priceVnd) && priceVnd >= 0
    ? priceVnd
    : (name.toLowerCase().includes('vip') ? 799000 : 499000);
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) throw new Error(`tiers[${index}].totalQuantity must be a positive integer.`);
  if (!Number.isInteger(remainingQuantity) || remainingQuantity < 0 || remainingQuantity > totalQuantity) throw new Error(`tiers[${index}].remainingQuantity must be between 0 and totalQuantity.`);
  if (!perks) throw new Error(`tiers[${index}].perks must be an array of strings.`);

  return { id, name, description, priceSol, priceVnd: managedPriceVnd, perks, totalQuantity, remainingQuantity, colorHex: text(tier.colorHex) || null };
}

function validateEvent(body: unknown): ValidatedEvent {
  if (!body || typeof body !== 'object') throw new Error('Request body must be a JSON object.');
  const input = body as EventInput;
  const title = text(input.title);
  const subtitle = text(input.subtitle);
  const description = text(input.description);
  const category = text(input.category);
  const bannerImage = text(input.bannerImage);
  const thumbnailImage = text(input.thumbnailImage) || bannerImage;
  const date = text(input.date ?? input.eventDate);
  const time = text(input.time ?? input.eventTime);
  const venue = text(input.venue);
  const city = text(input.city);
  const status = text(input.status || 'draft') as EventStatus;
  const tags = stringList(input.tags ?? []);
  const lineup = stringList(input.lineup ?? []);
  const tiers = Array.isArray(input.tiers) ? input.tiers.map(validateTier) : null;

  if (!title || !description || !category || !bannerImage || !date || !time || !venue || !city) throw new Error('title, description, category, images, date, time, venue and city are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error('date must use YYYY-MM-DD format.');
  if (!EVENT_STATUSES.has(status)) throw new Error('status must be draft, published or cancelled.');
  if (typeof input.featured !== 'undefined' && typeof input.featured !== 'boolean') throw new Error('featured must be a boolean.');
  if (!tags || !lineup) throw new Error('tags and lineup must be arrays of strings.');
  if (!tiers || tiers.length === 0) throw new Error('At least one ticket tier is required.');

  return { title, subtitle, description, category, bannerImage, thumbnailImage, date, time, venue, city, status, featured: input.featured === true, tags, lineup, tiers };
}

const eventSelect = `
  SELECT
    e.id, e.organizer_wallet, e.title, e.subtitle, e.description, e.category,
    e.banner_image, e.thumbnail_image, e.event_date, e.event_time, e.venue, e.city,
    e.status, e.featured, e.tags, e.lineup, e.created_at, e.updated_at,
    COALESCE(json_agg(json_build_object(
      'id', t.id, 'name', t.name, 'description', t.description,
      'price_sol', t.price_sol, 'price_vnd', t.price_vnd, 'perks', t.perks,
      'total_quantity', t.total_quantity, 'remaining_quantity', t.remaining_quantity,
      'color_hex', t.color_hex
    ) ORDER BY t.created_at) FILTER (WHERE t.id IS NOT NULL), '[]') AS tiers
  FROM events e
  LEFT JOIN event_ticket_tiers t ON t.event_id = e.id
`;

function dateValue(value: string | Date): string {
  // PostgreSQL DATE has no timezone. pg may materialize it as a local Date;
  // using toISOString() would shift the calendar day in UTC+ timezones.
  if (typeof value === 'string') return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventResponse(row: EventRow) {
  const tiers = row.tiers.map((tier) => ({ id: tier.id, name: tier.name, description: tier.description, priceSol: Number(tier.price_sol), priceVnd: Number(tier.price_vnd), perks: tier.perks, totalQuantity: tier.total_quantity, remainingQuantity: tier.remaining_quantity, colorHex: tier.color_hex ?? undefined }));
  const totalTickets = tiers.reduce((total, tier) => total + tier.totalQuantity, 0);
  const soldTickets = tiers.reduce((total, tier) => total + tier.totalQuantity - tier.remainingQuantity, 0);
  return {
    id: row.id,
    organizerWallet: row.organizer_wallet,
    organizer: { name: row.organizer_wallet, avatar: '', verified: false },
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    category: row.category,
    bannerImage: row.banner_image,
    thumbnailImage: row.thumbnail_image,
    date: dateValue(row.event_date),
    time: row.event_time,
    venue: row.venue,
    city: row.city,
    status: row.status,
    featured: row.featured,
    tags: row.tags,
    lineup: row.lineup,
    tiers,
    minPriceSol: tiers.length ? Math.min(...tiers.map((tier) => tier.priceSol)) : 0,
    totalTickets,
    soldTickets,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchEvent(client: PoolClient, id: string): Promise<EventRow | null> {
  const result = await client.query<EventRow>(`${eventSelect} WHERE e.id = $1 GROUP BY e.id`, [id]);
  return result.rows[0] ?? null;
}

async function insertTiers(client: PoolClient, eventId: string, tiers: ValidatedTier[]): Promise<void> {
  for (const tier of tiers) {
    await client.query(
      `INSERT INTO event_ticket_tiers (id, event_id, name, description, price_sol, price_vnd, perks, total_quantity, remaining_quantity, color_hex)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tier.id ?? null, eventId, tier.name, tier.description, tier.priceSol, tier.priceVnd, tier.perks, tier.totalQuantity, tier.remainingQuantity, tier.colorHex],
    );
  }
}

function sendError(response: Response, status: number, message: string): void {
  response.status(status).json({ error: message });
}

eventsRouter.get('/', async (_request, response) => {
  try {
    const result = await pool.query<EventRow>(`${eventSelect} GROUP BY e.id ORDER BY e.created_at DESC`);
    response.json({ data: result.rows.map(eventResponse) });
  } catch (error) {
    console.error('[UniTicket Events] Failed to list events:', error);
    sendError(response, 500, 'Could not load events.');
  }
});

eventsRouter.get('/:id', async (request, response) => {
  if (!UUID_PATTERN.test(request.params.id)) return sendError(response, 400, 'Invalid event id.');
  try {
    const result = await pool.query<EventRow>(`${eventSelect} WHERE e.id = $1 GROUP BY e.id`, [request.params.id]);
    const event = result.rows[0];
    if (!event) return sendError(response, 404, 'Event not found.');
    response.json({ data: eventResponse(event) });
  } catch (error) {
    console.error('[UniTicket Events] Failed to load event:', error);
    sendError(response, 500, 'Could not load event.');
  }
});

eventsRouter.post('/', requireAuth, requireRole('organizer', 'admin'), async (request, response) => {
  let input: ValidatedEvent;
  try { input = validateEvent(request.body); } catch (error) { return sendError(response, 400, error instanceof Error ? error.message : 'Invalid event payload.'); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const eventResult = await client.query<{ id: string }>(
      `INSERT INTO events (organizer_wallet, title, subtitle, description, category, banner_image, thumbnail_image, event_date, event_time, venue, city, status, featured, tags, lineup)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [request.auth!.walletAddress, input.title, input.subtitle, input.description, input.category, input.bannerImage, input.thumbnailImage, input.date, input.time, input.venue, input.city, input.status, input.featured, input.tags, input.lineup],
    );
    await insertTiers(client, eventResult.rows[0].id, input.tiers);
    const event = await fetchEvent(client, eventResult.rows[0].id);
    await client.query('COMMIT');
    response.status(201).json({ data: event ? eventResponse(event) : null });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UniTicket Events] Failed to create event:', error);
    sendError(response, 500, 'Could not create event.');
  } finally { client.release(); }
});

eventsRouter.put('/:id', requireAuth, requireRole('organizer', 'admin'), async (request, response) => {
  const eventId = typeof request.params.id === 'string' ? request.params.id : '';
  if (!UUID_PATTERN.test(eventId)) return sendError(response, 400, 'Invalid event id.');
  let existing: EventRow | null;
  try { existing = (await pool.query<EventRow>(`${eventSelect} WHERE e.id = $1 GROUP BY e.id`, [eventId])).rows[0] ?? null; } catch (error) { console.error('[UniTicket Events] Failed to read event before update:', error); return sendError(response, 500, 'Could not update event.'); }
  if (!existing) return sendError(response, 404, 'Event not found.');
  if (request.auth!.role !== 'admin' && existing.organizer_wallet !== request.auth!.walletAddress) return sendError(response, 403, 'You can only edit events you own.');
  let input: ValidatedEvent;
  try { input = validateEvent(request.body); } catch (error) { return sendError(response, 400, error instanceof Error ? error.message : 'Invalid event payload.'); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lockedEvent = await client.query<{ organizer_wallet: string }>('SELECT organizer_wallet FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    if (!lockedEvent.rows[0]) { await client.query('ROLLBACK'); return sendError(response, 404, 'Event not found.'); }
    if (request.auth!.role !== 'admin' && lockedEvent.rows[0].organizer_wallet !== request.auth!.walletAddress) { await client.query('ROLLBACK'); return sendError(response, 403, 'You can only edit events you own.'); }
    const issuedTickets = await client.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM tickets WHERE event_id = $1) AS exists', [eventId]);
    if (issuedTickets.rows[0]?.exists) { await client.query('ROLLBACK'); return sendError(response, 409, 'Events with issued tickets cannot have ticket tiers replaced.'); }
    await client.query(
      `UPDATE events SET title=$1, subtitle=$2, description=$3, category=$4, banner_image=$5, thumbnail_image=$6, event_date=$7, event_time=$8, venue=$9, city=$10, status=$11, featured=$12, tags=$13, lineup=$14, updated_at=NOW() WHERE id=$15`,
      [input.title, input.subtitle, input.description, input.category, input.bannerImage, input.thumbnailImage, input.date, input.time, input.venue, input.city, input.status, input.featured, input.tags, input.lineup, eventId],
    );
    await client.query('DELETE FROM event_ticket_tiers WHERE event_id = $1', [eventId]);
    await insertTiers(client, eventId, input.tiers);
    const updated = await fetchEvent(client, eventId);
    await client.query('COMMIT');
    response.json({ data: updated ? eventResponse(updated) : null });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UniTicket Events] Failed to update event:', error);
    sendError(response, 500, 'Could not update event.');
  } finally { client.release(); }
});

eventsRouter.delete('/:id', requireAuth, requireRole('organizer', 'admin'), async (request, response) => {
  const eventId = typeof request.params.id === 'string' ? request.params.id : '';
  if (!UUID_PATTERN.test(eventId)) return sendError(response, 400, 'Invalid event id.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ organizer_wallet: string }>('SELECT organizer_wallet FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return sendError(response, 404, 'Event not found.'); }
    if (request.auth!.role !== 'admin' && existing.rows[0].organizer_wallet !== request.auth!.walletAddress) { await client.query('ROLLBACK'); return sendError(response, 403, 'You can only delete events you own.'); }
    const issuedTickets = await client.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM tickets WHERE event_id = $1) AS exists', [eventId]);
    if (issuedTickets.rows[0]?.exists) { await client.query('ROLLBACK'); return sendError(response, 409, 'Events with issued tickets cannot be deleted.'); }
    await client.query('DELETE FROM event_ticket_tiers WHERE event_id = $1', [eventId]);
    const deletedEvent = await client.query('DELETE FROM events WHERE id = $1', [eventId]);
    if (deletedEvent.rowCount !== 1) { await client.query('ROLLBACK'); return sendError(response, 404, 'Event not found.'); }
    await client.query('COMMIT');
    response.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[UniTicket Events] Failed to delete event:', error);
    sendError(response, 500, 'Could not delete event.');
  } finally { client.release(); }
});

export { eventsRouter };
