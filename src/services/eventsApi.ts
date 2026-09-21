import { EventItem, TicketTier } from '../types';

/**
 * API client for the events resource. The browser talks to the local demo API
 * by default; VITE_API_BASE_URL can be used when the API runs elsewhere.
 */
const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (runtimeEnv?.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

interface ApiEnvelope<T> {
  data: T;
  error?: string;
}

export class EventsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EventsApiError';
    this.status = status;
  }
}

export function isApiEventId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type ApiEvent = Omit<EventItem, 'date' | 'organizer'> & {
  date: string;
  organizerWallet?: string;
  organizer?: EventItem['organizer'];
};

export interface EventMutationInput {
  event: EventItem;
  organizerWallet?: string | null;
}

function toUiDate(value: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function toApiDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
}

function category(value: string): EventItem['category'] {
  const known: EventItem['category'][] = ['Concert', 'EDM Festival', 'Web3 Hackathon', 'Rock Arena', 'DJ Night'];
  return known.includes(value as EventItem['category']) ? value as EventItem['category'] : 'Concert';
}

function mapEvent(value: ApiEvent): EventItem {
  const tiers = Array.isArray(value.tiers) ? value.tiers : [];
  const organizer = value.organizer ?? {
    name: value.organizerWallet || 'UniTicket Organizer',
    avatar: '',
    verified: false,
  };
  return {
    ...value,
    date: toUiDate(value.date),
    category: category(value.category),
    organizer,
    tiers: tiers.map((tier) => ({
      ...tier,
      priceSol: Number(tier.priceSol),
      totalQuantity: Number(tier.totalQuantity),
      remainingQuantity: Number(tier.remainingQuantity),
    })),
    totalTickets: Number(value.totalTickets || 0),
    soldTickets: Number(value.soldTickets || 0),
    minPriceSol: Number(value.minPriceSol || 0),
    tags: Array.isArray(value.tags) ? value.tags : [],
    lineup: Array.isArray(value.lineup) ? value.lineup : [],
  };
}

function payload({ event, organizerWallet }: EventMutationInput) {
  return {
    organizerWallet: organizerWallet || event.createdBy || event.organizer.name || 'demo-organizer',
    title: event.title,
    subtitle: event.subtitle,
    description: event.description,
    category: event.category,
    bannerImage: event.bannerImage,
    thumbnailImage: event.thumbnailImage,
    date: toApiDate(event.date),
    time: event.time,
    venue: event.venue,
    city: event.city,
    status: event.status || 'published',
    featured: event.featured,
    tags: event.tags || [],
    lineup: event.lineup || [],
    tiers: (event.tiers || []).map((tier: TicketTier) => ({
      // The API accepts UUID tier IDs for updates. Legacy localStorage IDs are
      // omitted and PostgreSQL generates a new ID for those tiers.
      id: isApiEventId(tier.id) ? tier.id : undefined,
      name: tier.name,
      description: tier.description,
      priceSol: Number(tier.priceSol),
      perks: tier.perks || [],
      totalQuantity: Number(tier.totalQuantity),
      remainingQuantity: Number(tier.remainingQuantity),
      colorHex: tier.colorHex,
    })),
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
  } catch {
    throw new EventsApiError('Không thể kết nối Events API. Dữ liệu trên thiết bị vẫn được giữ nguyên.', 0);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok) {
    throw new EventsApiError(body?.error || `Events API request failed (${response.status}).`, response.status);
  }
  return (body as ApiEnvelope<T> | null)?.data as T;
}

export async function listEvents(): Promise<EventItem[]> {
  const data = await request<ApiEvent[]>('/api/events');
  return data.map(mapEvent);
}

export async function getEvent(id: string): Promise<EventItem> {
  return mapEvent(await request<ApiEvent>(`/api/events/${encodeURIComponent(id)}`));
}

export async function createEvent(input: EventMutationInput): Promise<EventItem> {
  return mapEvent(await request<ApiEvent>('/api/events', { method: 'POST', body: JSON.stringify(payload(input)) }));
}

export async function updateEvent(id: string, input: EventMutationInput): Promise<EventItem> {
  return mapEvent(await request<ApiEvent>(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload(input)) }));
}

export async function deleteEvent(id: string): Promise<void> {
  await request<undefined>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
