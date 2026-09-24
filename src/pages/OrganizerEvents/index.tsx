import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Edit3, Eye, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { EventItem, TicketTier } from '../../types';
import { deleteStoredEvent, getStoredPurchasedTickets, getStoredEvents, saveStoredEvents } from '../../utils/storage';
import { createEvent as createEventApi, deleteEvent as deleteEventApi, updateEvent as updateEventApi } from '../../services/eventsApi';

type EventStatus = 'draft' | 'published' | 'cancelled';
type Category = EventItem['category'];
type TierDraft = Pick<TicketTier, 'id' | 'name' | 'priceSol' | 'description' | 'totalQuantity' | 'remainingQuantity'> & { perks: string };
interface EventFormState {
  title: string; subtitle: string; description: string; category: Category; bannerImage: string; thumbnailImage: string; date: string; time: string; venue: string; city: string; status: EventStatus; tiers: TierDraft[];
}
interface OrganizerEventsProps {
  events: EventItem[];
  onNavigate: (page: string) => void;
  onEventsChanged: (events: EventItem[]) => void;
  organizerWallet?: string | null;
  eventsLoading?: boolean;
  eventsError?: string | null;
  startInCreate?: boolean;
}

const categories: Category[] = ['Concert', 'EDM Festival', 'Web3 Hackathon', 'Rock Arena', 'DJ Night'];
const fallbackImage = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80';
const emptyTier = (): TierDraft => ({ id: `tier-${Date.now()}`, name: 'General Admission', priceSol: 0.5, description: 'Standard event access.', totalQuantity: 100, remainingQuantity: 100, perks: 'Event entry' });

const toForm = (event?: EventItem): EventFormState => ({
  title: event?.title ?? '', subtitle: event?.subtitle ?? '', description: event?.description ?? '', category: event?.category ?? 'Concert', bannerImage: event?.bannerImage ?? fallbackImage, thumbnailImage: event?.thumbnailImage ?? event?.bannerImage ?? fallbackImage, date: event?.date ?? '', time: event?.time ?? '', venue: event?.venue ?? '', city: event?.city ?? '', status: event?.status ?? 'published',
  tiers: event?.tiers?.map((tier) => ({ id: tier.id, name: tier.name, priceSol: tier.priceSol, description: tier.description, totalQuantity: tier.totalQuantity, remainingQuantity: tier.remainingQuantity, perks: tier.perks.join(', ') })) ?? [emptyTier()],
});

const remainingTickets = (event: EventItem) => event.tiers?.reduce((total, tier) => total + tier.remainingQuantity, 0) ?? 0;
const soldTickets = (event: EventItem) => Math.max(0, event.totalTickets - remainingTickets(event));
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const OrganizerEvents: React.FC<OrganizerEventsProps> = ({ events, onNavigate, onEventsChanged, organizerWallet, eventsLoading = false, eventsError = null, startInCreate = false }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const [form, setForm] = useState<EventFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<EventItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const createEventModalRef = useRef<HTMLDivElement>(null);
  const isFormOpen = form !== null;

  useEffect(() => { if (startInCreate) { setEditingId(null); setForm(toForm()); } }, [startInCreate]);
  useLayoutEffect(() => {
    if (isFormOpen) createEventModalRef.current?.scrollTo(0, 0);
  }, [isFormOpen]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const normalized = query.trim().toLowerCase();
    const matchesQuery = !normalized || event.title.toLowerCase().includes(normalized) || event.venue.toLowerCase().includes(normalized) || event.city.toLowerCase().includes(normalized);
    return matchesQuery && (statusFilter === 'all' || (event.status ?? 'published') === statusFilter);
  }), [events, query, statusFilter]);

  const updateTier = (index: number, key: keyof TierDraft, value: string | number) => {
    setForm((current) => current && ({ ...current, tiers: current.tiers.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: value } : tier) }));
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setFeedback(null);
    const title = form.title.trim();
    const description = form.description.trim();
    const venue = form.venue.trim();
    if (!title || !description || !venue || !form.date || !form.time || !form.city.trim()) { setFeedback({ type: 'error', text: 'Complete the event title, description, date, time, venue and city.' }); return; }
    if (form.tiers.length === 0 || form.tiers.some((tier) => !tier.name.trim() || !Number.isFinite(tier.priceSol) || tier.priceSol < 0 || !Number.isInteger(tier.totalQuantity) || tier.totalQuantity <= 0 || !Number.isInteger(tier.remainingQuantity) || tier.remainingQuantity < 0 || tier.remainingQuantity > tier.totalQuantity)) { setFeedback({ type: 'error', text: 'Check each ticket tier price and quantity.' }); return; }

    const existing = editingId ? events.find((item) => item.id === editingId) : undefined;
    const purchased = getStoredPurchasedTickets().filter((ticket) => ticket.eventId === editingId);
    for (const ticket of purchased) {
      const tier = form.tiers.find((item) => item.id === ticket.tierId);
      if (!tier) { setFeedback({ type: 'error', text: 'A tier with purchased tickets cannot be removed.' }); return; }
      const soldForTier = purchased.filter((item) => item.tierId === tier.id).length;
      if (tier.remainingQuantity > tier.totalQuantity - soldForTier) { setFeedback({ type: 'error', text: 'Remaining quantity cannot exceed inventory after purchased tickets.' }); return; }
    }
    const tiers: TicketTier[] = form.tiers.map((tier) => ({ id: tier.id, name: tier.name.trim(), priceSol: Number(tier.priceSol), description: tier.description.trim() || 'Event access.', perks: tier.perks.split(',').map((item) => item.trim()).filter(Boolean), totalQuantity: Number(tier.totalQuantity), remainingQuantity: Number(tier.remainingQuantity), colorHex: existing?.tiers?.find((item) => item.id === tier.id)?.colorHex ?? '#9945FF' }));
    const nextEvent: EventItem = { id: editingId ?? `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, subtitle: form.subtitle.trim(), description, category: form.category, bannerImage: form.bannerImage.trim() || fallbackImage, thumbnailImage: form.thumbnailImage.trim() || form.bannerImage.trim() || fallbackImage, date: form.date, time: form.time, venue, city: form.city.trim(), organizer: existing?.organizer ?? { name: 'UniTicket Organizer', avatar: fallbackImage, verified: false }, minPriceSol: Math.min(...tiers.map((tier) => tier.priceSol)), totalTickets: tiers.reduce((total, tier) => total + tier.totalQuantity, 0), soldTickets: tiers.reduce((total, tier) => total + tier.totalQuantity - tier.remainingQuantity, 0), featured: existing?.featured ?? false, tags: existing?.tags ?? [], status: form.status, createdBy: existing?.createdBy, lineup: existing?.lineup, tiers };
    setIsSaving(true);
    try {
      let savedEvent = nextEvent;
      let apiMessage = '';
      if (!editingId || isUuid(editingId)) {
        try {
          savedEvent = editingId
            ? await updateEventApi(editingId, { event: nextEvent, organizerWallet })
            : await createEventApi({ event: nextEvent, organizerWallet });
          apiMessage = ' PostgreSQL API đã được cập nhật.';
        } catch (error) {
          setFeedback({ type: 'error', text: `Không thể lưu event trên máy chủ: ${error instanceof Error ? error.message : 'unknown error'}` });
          return;
        }
      } else {
        apiMessage = ' Event legacy đang dùng bản localStorage.';
      }

      const nextEvents = editingId
        ? events.map((item) => item.id === (editingId || savedEvent.id) ? savedEvent : item)
        : [savedEvent, ...events];
      const localMirror = getStoredEvents().filter((item) => item.id !== (editingId || savedEvent.id));
      const localSaved = saveStoredEvents([savedEvent, ...localMirror]);
      if (!localSaved) {
        setFeedback({ type: 'error', text: 'API có thể đã lưu, nhưng không thể cập nhật bản sao localStorage. Dữ liệu form hiện tại vẫn được giữ.' });
        return;
      }
      onEventsChanged(nextEvents);
      setFeedback({ type: 'success', text: `${editingId ? 'Event updated.' : 'Event created.'}${apiMessage}` });
      setForm(null); setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (getStoredPurchasedTickets().some((ticket) => ticket.eventId === deleteTarget.id)) {
      setFeedback({ type: 'error', text: 'This event has purchased tickets and cannot be deleted in the demo.' });
      setDeleteTarget(null);
      return;
    }
    setIsDeleting(true);
    try {
      let apiMessage = '';
      if (isUuid(deleteTarget.id)) {
        try {
          await deleteEventApi(deleteTarget.id);
          apiMessage = ' PostgreSQL API đã được cập nhật.';
        } catch (error) {
          setFeedback({ type: 'error', text: `Không thể xóa event trên máy chủ: ${error instanceof Error ? error.message : 'unknown error'}` });
          return;
        }
      }
      const localResult = deleteStoredEvent(deleteTarget.id);
      if (!localResult.ok && localResult.message !== 'Event not found.') {
        setFeedback({ type: 'error', text: localResult.message });
        return;
      }
      onEventsChanged(events.filter((event) => event.id !== deleteTarget.id));
      setFeedback({ type: 'success', text: `Event deleted.${apiMessage}` });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg"><div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8 animate-fadeIn">
    <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><button type="button" onClick={() => onNavigate('organizer')} className="mb-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</button><h1 className="text-2xl font-extrabold text-white sm:text-4xl">Manage Events</h1><p className="mt-2 text-xs text-slate-300 sm:text-sm">Create and maintain demo events stored on this device.</p></div><button type="button" onClick={() => { setEditingId(null); setForm(toForm()); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-3 text-xs font-bold text-white"><Plus className="h-4 w-4" /> Create Event</button></header>
    {eventsLoading && <div role="status" className="rounded-xl border border-solana-cyan/30 bg-solana-cyan/10 p-3 text-sm text-solana-cyan">Đang đồng bộ sự kiện từ Events API…</div>}
    {eventsError && <div role="alert" className="rounded-xl border border-neon-pink/40 bg-neon-pink/10 p-3 text-sm text-pink-100">{eventsError} Đang hiển thị dữ liệu đã lưu trên thiết bị.</div>}
    {feedback && <div role="status" className={`rounded-xl border p-3 text-sm ${feedback.type === 'success' ? 'border-solana-green/30 bg-solana-green/10 text-solana-green' : 'border-neon-pink/40 bg-neon-pink/10 text-pink-100'}`}>{feedback.text}</div>}
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#120B30] p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, venue or city" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-3 text-sm text-white outline-none focus:border-solana-purple" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | EventStatus)} className="min-h-11 rounded-xl border border-white/10 bg-[#171038] px-3 text-sm text-white outline-none"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select></div>
    {visibleEvents.length === 0 ? <section className="rounded-2xl border border-white/10 bg-[#120B30] p-8 text-center"><CalendarDays className="mx-auto h-10 w-10 text-solana-cyan" /><h2 className="mt-3 text-xl font-bold text-white">No matching events</h2><p className="mt-2 text-sm text-slate-400">Create an event or adjust your search.</p></section> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{visibleEvents.map((event) => <article key={event.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#120B30] shadow-xl"><img src={event.thumbnailImage} alt={event.title} className="h-40 w-full object-cover" /><div className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-bold text-white">{event.title}</h2><p className="mt-1 text-xs text-slate-400">{event.date} · {event.venue}</p></div><span className="shrink-0 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2 py-1 text-[10px] font-bold uppercase text-solana-cyan">{event.status ?? 'published'}</span></div><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Package className="mb-2 h-4 w-4 text-solana-green" /><span className="block text-slate-400">Sold</span><strong className="text-white">{soldTickets(event)}</strong></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><Package className="mb-2 h-4 w-4 text-solana-cyan" /><span className="block text-slate-400">Remaining</span><strong className="text-white">{remainingTickets(event)}</strong></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setViewing(event)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5"><Eye className="h-4 w-4" /> View</button><button type="button" onClick={() => { setEditingId(event.id); setForm(toForm(event)); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-solana-cyan/30 px-3 text-xs font-semibold text-solana-cyan hover:bg-solana-cyan/10"><Edit3 className="h-4 w-4" /> Edit</button><button type="button" onClick={() => setDeleteTarget(event)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-neon-pink/30 px-3 text-xs font-semibold text-neon-pink hover:bg-neon-pink/10"><Trash2 className="h-4 w-4" /> Delete</button></div></div></article>)}</div>}
    <p className="flex items-start gap-2 rounded-xl border border-solana-green/20 bg-solana-green/5 p-4 text-xs leading-relaxed text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-solana-green" />Events use the PostgreSQL API when available, with a localStorage mirror for safe migration. Events with purchased tickets cannot be deleted.</p>
  </div>

  {form && <div ref={createEventModalRef} className="fixed inset-x-0 bottom-0 top-16 z-[80] flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md sm:top-20"><form onSubmit={submitForm} className="relative my-4 w-full max-w-3xl space-y-5 rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl sm:p-7"><button type="button" onClick={() => { setForm(null); setEditingId(null); }} aria-label="Close event form" className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"><X /></button><div className="border-b border-white/10 pb-4 pr-12"><h2 className="text-xl font-bold text-white">{editingId ? 'Edit Event' : 'Create Event'}</h2><p className="mt-1 text-xs text-slate-400">Changes are sent to PostgreSQL and mirrored to localStorage for safe migration.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{([['title', 'Event name'], ['subtitle', 'Short subtitle'], ['venue', 'Venue'], ['city', 'City'], ['date', 'Date'], ['time', 'Time'], ['bannerImage', 'Banner image URL'], ['thumbnailImage', 'Thumbnail image URL']] as const).map(([key, label]) => <label key={key} className={key === 'title' || key === 'subtitle' || key === 'bannerImage' || key === 'thumbnailImage' ? 'sm:col-span-2' : ''}><span className="mb-1 block text-xs font-semibold text-slate-300">{label}</span><input required={['title', 'venue', 'city', 'date', 'time'].includes(key)} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-solana-purple" /></label>)}<label><span className="mb-1 block text-xs font-semibold text-slate-300">Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#171038] px-3 text-sm text-white">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold text-slate-300">Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EventStatus })} className="min-h-11 w-full rounded-xl border border-white/10 bg-[#171038] px-3 text-sm text-white"><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-300">Description</span><textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-solana-purple" /></label></div><div className="space-y-3 border-t border-white/10 pt-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">Ticket tiers</h3><button type="button" onClick={() => setForm({ ...form, tiers: [...form.tiers, emptyTier()] })} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-solana-cyan/30 px-3 text-xs font-semibold text-solana-cyan"><Plus className="h-4 w-4" /> Add tier</button></div>{form.tiers.map((tier, index) => <div key={tier.id} className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2"><input value={tier.name} onChange={(event) => updateTier(index, 'name', event.target.value)} placeholder="Tier name" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white" /><input type="number" min="0" step="0.01" value={tier.priceSol} onChange={(event) => updateTier(index, 'priceSol', Number(event.target.value))} placeholder="Price SOL" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white" /><input type="number" min="1" value={tier.totalQuantity} onChange={(event) => updateTier(index, 'totalQuantity', Number(event.target.value))} placeholder="Total quantity" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white" /><input type="number" min="0" value={tier.remainingQuantity} onChange={(event) => updateTier(index, 'remainingQuantity', Number(event.target.value))} placeholder="Remaining quantity" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white" /><input value={tier.description} onChange={(event) => updateTier(index, 'description', event.target.value)} placeholder="Tier description" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2" /><input value={tier.perks} onChange={(event) => updateTier(index, 'perks', event.target.value)} placeholder="Perks, comma separated" className="min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white sm:col-span-2" />{form.tiers.length > 1 && <button type="button" onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, tierIndex) => tierIndex !== index) })} className="min-h-11 text-left text-xs font-semibold text-neon-pink">Remove tier</button>}</div>)}</div><div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setForm(null); setEditingId(null); }} className="min-h-11 rounded-xl border border-white/10 px-5 text-sm font-semibold text-slate-300">Cancel</button><button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Event'}</button></div></form></div>}
  {viewing && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-white">{viewing.title}</h2><p className="mt-1 text-xs text-solana-cyan">{viewing.date} · {viewing.time} · {viewing.venue}</p></div><button type="button" onClick={() => setViewing(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"><X /></button></div><img src={viewing.bannerImage} alt="" className="mt-4 h-40 w-full rounded-xl object-cover" /><p className="mt-4 text-sm leading-relaxed text-slate-300">{viewing.description}</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-black/20 p-3 text-slate-300">Category<strong className="mt-1 block text-white">{viewing.category}</strong></div><div className="rounded-xl bg-black/20 p-3 text-slate-300">Tickets<strong className="mt-1 block text-white">{soldTickets(viewing)} sold / {remainingTickets(viewing)} left</strong></div></div></div></div>}
  {deleteTarget && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"><div className="w-full max-w-md rounded-2xl border border-neon-pink/40 bg-[#0F0A28] p-6 shadow-2xl"><Trash2 className="h-8 w-8 text-neon-pink" /><h2 className="mt-4 text-xl font-bold text-white">Delete event?</h2><p className="mt-2 text-sm text-slate-300">Delete “{deleteTarget.title}”? Events with purchased tickets will be protected.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm text-slate-300">Cancel</button><button type="button" disabled={isDeleting} onClick={() => void confirmDelete()} className="min-h-11 rounded-xl bg-neon-pink px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{isDeleting ? 'Deleting…' : 'Delete Event'}</button></div></div></div>}
  </div>;
};
