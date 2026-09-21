import React from 'react';
import { BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, Coins, Package, PlusCircle, ScanLine, Ticket } from 'lucide-react';
import { EventItem, PurchasedTicket } from '../../types';

interface OrganizerDashboardProps {
  events: EventItem[];
  tickets: PurchasedTicket[];
  onNavigate: (page: string) => void;
}

const isCheckedIn = (ticket: PurchasedTicket) => ticket.isCheckedIn || ticket.checkInStatus === 'checked-in' || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN';
const getRemainingTickets = (event: EventItem) => event.tiers?.reduce((total, tier) => total + tier.remainingQuantity, 0) ?? 0;

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({ events, tickets, onNavigate }) => {
  const eventIds = new Set(events.map((event) => event.id));
  const eventTickets = tickets.filter((ticket) => eventIds.has(ticket.eventId));
  const totalCapacity = events.reduce((total, event) => total + event.totalTickets, 0);
  const totalRemaining = events.reduce((total, event) => total + getRemainingTickets(event), 0);
  const totalSold = Math.max(0, totalCapacity - totalRemaining);
  const checkedInTickets = eventTickets.filter(isCheckedIn).length;
  const mockRevenue = events.reduce((total, event) => total + event.soldTickets * event.minPriceSol, 0);
  const hasData = events.length > 0;
  const stats = [
    { label: 'Events created', value: events.length.toLocaleString('en-US'), icon: CalendarDays, color: 'text-solana-cyan' },
    { label: 'Tickets sold', value: totalSold.toLocaleString('en-US'), icon: Ticket, color: 'text-solana-green' },
    { label: 'Tickets remaining', value: totalRemaining.toLocaleString('en-US'), icon: Package, color: 'text-yellow-300' },
    { label: 'Mock revenue', value: `${mockRevenue.toFixed(2)} SOL`, icon: Coins, color: 'text-neon-pink' },
    { label: 'Check-ins', value: checkedInTickets.toLocaleString('en-US'), icon: ClipboardCheck, color: 'text-solana-purple' },
  ];

  return (
    <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-solana-green/30 bg-solana-green/10 px-3 py-1 text-xs font-semibold text-solana-green"><BarChart3 className="h-4 w-4" /> Demo Mode</div>
            <h1 className="text-2xl font-extrabold text-white sm:text-4xl">Organizer Dashboard</h1>
            <p className="mt-2 text-xs text-slate-300 sm:text-sm">Overview of your local event inventory and check-in activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate('organizer-events')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5"><CalendarDays className="h-4 w-4" /> Manage Events</button>
            <button type="button" onClick={() => onNavigate('create-event')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white"><PlusCircle className="h-4 w-4" /> Create Event</button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#120B30] p-5 shadow-xl"><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{stat.label}</span><Icon className={`h-5 w-5 ${stat.color}`} /></div><p className="mt-4 break-words text-2xl font-black text-white">{hasData ? stat.value : '—'}</p></div>;
          })}
        </div>

        {!hasData ? (
          <section className="rounded-2xl border border-white/10 bg-[#120B30] p-8 text-center shadow-xl"><CalendarDays className="mx-auto h-10 w-10 text-solana-cyan" /><h2 className="mt-3 text-xl font-bold text-white">No events yet</h2><p className="mt-2 text-sm text-slate-300">Create your first demo event to start tracking inventory.</p><button type="button" onClick={() => onNavigate('create-event')} className="mt-5 min-h-11 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-3 text-sm font-bold text-white">Create Event</button></section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Event Snapshot</h2><p className="mt-1 text-xs text-slate-400">Inventory values are loaded from localStorage.</p></div><CalendarDays className="h-5 w-5 text-solana-cyan" /></div><div className="space-y-3">{events.slice(0, 4).map((event) => <div key={event.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-semibold text-white">{event.title}</p><p className="mt-1 text-xs text-slate-400">{event.date} · {event.city}</p></div><div className="flex items-center gap-3 text-xs"><span className="text-solana-green">{getRemainingTickets(event)} remaining</span><span className="text-slate-400">{event.status ?? 'published'}</span></div></div>)}</div>{events.length > 4 && <button type="button" onClick={() => onNavigate('organizer-events')} className="mt-4 text-xs font-semibold text-solana-cyan hover:text-white">View all events →</button>}</section>
            <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6"><div className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-solana-cyan" /><h2 className="text-lg font-bold text-white">Check-in Tools</h2></div><p className="mt-3 text-sm leading-relaxed text-slate-300">Validate demo QR tickets and confirm check-ins stored on this device.</p><div className="mt-5 flex items-center gap-2 rounded-xl border border-solana-green/20 bg-solana-green/5 p-3 text-xs text-slate-300"><CheckCircle2 className="h-4 w-4 shrink-0 text-solana-green" />{checkedInTickets} of {eventTickets.length} purchased tickets checked in.</div><button type="button" onClick={() => onNavigate('check-in')} className="mt-4 min-h-11 w-full rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-3 text-sm font-bold text-solana-cyan hover:bg-solana-cyan/20">Open Check-in</button><p className="mt-4 text-[11px] leading-relaxed text-slate-500">Demo only. Inventory, role and check-in data use localStorage.</p></section>
          </div>
        )}
      </div>
    </div>
  );
};
