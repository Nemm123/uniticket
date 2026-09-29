import { EventItem, TicketTier } from '../types';
import { getWalletSession } from './authSession';
import { supabase, isSupabaseConfigured } from './supabase';

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
  if (!value || typeof value !== 'string') return 'Nhạc sống';
  return value.trim() as EventItem['category'];
}

function mapEvent(value: ApiEvent): EventItem {
  const tiers = Array.isArray(value.tiers) ? value.tiers : [];
  const organizer = value.organizer ?? {
    name: value.organizerWallet || 'UniTicket Organizer',
    avatar: '',
    verified: false,
  };
  const mappedTiers = tiers.map((tier) => ({
    ...tier,
    priceSol: Number(tier.priceSol),
    priceVnd: tier.priceVnd === undefined ? undefined : Number(tier.priceVnd),
    totalQuantity: Number(tier.totalQuantity),
    remainingQuantity: Number(tier.remainingQuantity),
  }));
  const validTierVndPrices = mappedTiers
    .map((tier) => Number(tier.priceVnd))
    .filter((price) => Number.isFinite(price) && price > 0);
  const minPriceVnd = typeof value.minPriceVnd === 'number' && Number.isFinite(value.minPriceVnd) && value.minPriceVnd > 0
    ? value.minPriceVnd
    : (validTierVndPrices.length > 0 ? Math.min(...validTierVndPrices) : undefined);
  return {
    ...value,
    date: toUiDate(value.date),
    category: category(value.category),
    organizer,
    tiers: mappedTiers,
    totalTickets: Number(value.totalTickets || 0),
    soldTickets: Number(value.soldTickets || 0),
    minPriceSol: Number(value.minPriceSol || 0),
    minPriceVnd,
    tags: Array.isArray(value.tags) ? value.tags : [],
    lineup: Array.isArray(value.lineup) ? value.lineup : [],
  };
}

function payload({ event, organizerWallet }: EventMutationInput) {
  const effectiveOrganizer = organizerWallet || event.organizer_address || event.organizer_wallet || event.organizer?.name;
  return {
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
    organizerWallet: effectiveOrganizer,
    organizer_address: effectiveOrganizer,
    tags: event.tags || [],
    lineup: event.lineup || [],
    tiers: (event.tiers || []).map((tier: TicketTier) => ({
      // The API accepts UUID tier IDs for updates. Legacy localStorage IDs are
      // omitted and PostgreSQL generates a new ID for those tiers.
      id: isApiEventId(tier.id) ? tier.id : undefined,
      name: tier.name,
      description: tier.description,
      priceSol: Number(tier.priceSol),
      priceVnd: Number(tier.priceVnd),
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
      headers: {
        'Content-Type': 'application/json',
        ...(getWalletSession() ? { Authorization: `Bearer ${getWalletSession()!.token}` } : {}),
        ...(options?.headers || {}),
      },
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

export interface EventFilterParams {
  q?: string;
  category?: string;
  city?: string;
  timeRange?: 'all' | 'today' | 'this-weekend' | 'this-week' | 'this-month';
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  status?: 'draft' | 'published' | 'cancelled';
}

export async function listEvents(filters?: EventFilterParams): Promise<EventItem[]> {
  try {
    const query = new URLSearchParams();
    if (filters?.q) query.set('q', filters.q);
    if (filters?.category && filters.category !== 'All' && filters.category !== 'Tất cả') query.set('category', filters.category);
    if (filters?.city && filters.city !== 'All' && filters.city !== 'Tất cả') query.set('city', filters.city);
    if (filters?.timeRange && filters.timeRange !== 'all') query.set('timeRange', filters.timeRange);
    if (typeof filters?.minPrice === 'number') query.set('minPrice', String(filters.minPrice));
    if (typeof filters?.maxPrice === 'number') query.set('maxPrice', String(filters.maxPrice));
    if (typeof filters?.featured === 'boolean') query.set('featured', String(filters.featured));
    if (filters?.status) query.set('status', filters.status);

    const queryString = query.toString();
    const path = queryString ? `/api/events?${queryString}` : '/api/events';
    const data = await request<ApiEvent[]>(path);
    return data.map(mapEvent);
  } catch {
    return [];
  }
}

export async function getEvent(id: string): Promise<EventItem> {
  return mapEvent(await request<ApiEvent>(`/api/events/${encodeURIComponent(id)}`));
}

export async function createEvent(input: EventMutationInput): Promise<EventItem> {
  const currentWallet = input.organizerWallet || 
    (typeof window !== 'undefined' ? (localStorage.getItem('wallet_address') || localStorage.getItem('phantom_wallet_address') || '') : '');

  const newEvent: EventItem = {
    ...input.event,
    organizer_address: currentWallet || input.event.organizer_address || 'community',
    organizer_wallet: currentWallet || input.event.organizer_wallet || 'community',
  };
  (newEvent as any).is_custom_created = true;
  (newEvent as any).createdByCurrentUser = true;

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('uniticket_custom_events') || '[]');
      const filtered = existing.filter((item: any) => item.id !== newEvent.id);
      localStorage.setItem('uniticket_custom_events', JSON.stringify([newEvent, ...filtered]));
    } catch {}
  }

  try {
    if (isSupabaseConfigured) {
      const newEventPayload = {
        id: newEvent.id,
        title: newEvent.title,
        description: newEvent.description,
        category: newEvent.category || 'music',
        location: newEvent.venue,
        city: newEvent.city || 'Hà Nội',
        date: newEvent.date,
        image_url: newEvent.bannerImage || newEvent.thumbnailImage,
        organizer_address: currentWallet || 'community',
        organizer: currentWallet || 'community',
        is_published: true,
        tiers: newEvent.tiers,
        created_at: new Date().toISOString()
      };
      await supabase.from('events').insert([newEventPayload]);
    }
  } catch (err) {
    console.warn('[eventsApi] Supabase insert error:', err);
  }

  return mapEvent(await request<ApiEvent>('/api/events', { method: 'POST', body: JSON.stringify(payload(input)) }));
}

export async function updateEvent(id: string, input: EventMutationInput): Promise<EventItem> {
  return mapEvent(await request<ApiEvent>(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload(input)) }));
}

export async function deleteEvent(id: string): Promise<void> {
  await request<undefined>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
