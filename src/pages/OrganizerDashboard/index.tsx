import React from 'react';
import { BarChart3, CalendarDays, ClipboardCheck, Coins, PlusCircle, ScanLine, Ticket } from 'lucide-react';
import { EventItem, PurchasedTicket } from '../../types';

interface OrganizerDashboardProps {
  events: EventItem[];
  tickets: PurchasedTicket[];
  onNavigate: (page: string) => void;
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({ events, tickets, onNavigate }) => {
  const totalTickets = events.reduce((total, event) => total + event.totalTickets, 0);
  const checkedInTickets = tickets.filter((ticket) => ticket.isCheckedIn || ticket.status === 'checked_in' || ticket.status === 'CHECKED_IN').length;
  const mockSales = tickets.reduce((total, ticket) => total + ticket.priceSol, 0);
  const stats = [
    { label: 'Total Events', value: events.length.toString(), icon: CalendarDays, color: 'text-solana-cyan' },
    { label: 'Total Tickets', value: totalTickets.toLocaleString('en-US'), icon: Ticket, color: 'text-solana-green' },
    { label: 'Total Sales (Mock)', value: `${mockSales.toFixed(2)} SOL`, icon: Coins, color: 'text-yellow-300' },
    { label: 'Check-in Overview', value: `${checkedInTickets}/${tickets.length}`, icon: ClipboardCheck, color: 'text-neon-pink' },
  ];

  return (
    <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-solana-green/30 bg-solana-green/10 px-3 py-1 text-xs font-semibold text-solana-green">
              <BarChart3 className="h-4 w-4" />
              Demo Mode
            </div>
            <h1 className="text-2xl font-extrabold text-white sm:text-4xl">Organizer Dashboard</h1>
            <p className="mt-2 text-xs text-slate-300 sm:text-sm">Mock overview for local event and ticket management.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onNavigate('organizer-events')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5">
              <CalendarDays className="h-4 w-4" /> Manage Events
            </button>
            <button onClick={() => onNavigate('create-event')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white">
              <PlusCircle className="h-4 w-4" /> Create Event
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#120B30] p-5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">{stat.label}</span>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="mt-4 break-words text-2xl font-black text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Event Snapshot</h2>
                <p className="mt-1 text-xs text-slate-400">Inventory values are loaded from localStorage.</p>
              </div>
              <CalendarDays className="h-5 w-5 text-solana-cyan" />
            </div>
            <div className="space-y-3">
              {events.slice(0, 4).map((event) => {
                const remainingTickets = event.tiers?.reduce((total, tier) => total + tier.remainingQuantity, 0) ?? 0;
                return (
                  <div key={event.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-white">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{event.date} · {event.city}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-solana-green">{remainingTickets} remaining</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-solana-cyan" />
              <h2 className="text-lg font-bold text-white">Check-in Tools</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">Open the mock scanner to validate ticket codes and QR payloads stored on this device.</p>
            <button onClick={() => onNavigate('check-in')} className="mt-5 w-full rounded-xl border border-solana-cyan/40 bg-solana-cyan/10 px-4 py-3 text-sm font-bold text-solana-cyan hover:bg-solana-cyan/20">
              Open Check-in
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Demo only. Local role data is not a real authorization boundary.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
