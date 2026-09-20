import React from 'react';
import { ArrowLeft, CalendarDays, Edit3, Package } from 'lucide-react';
import { EventItem } from '../../types';

interface OrganizerEventsProps {
  events: EventItem[];
  onNavigate: (page: string) => void;
}

export const OrganizerEvents: React.FC<OrganizerEventsProps> = ({ events, onNavigate }) => (
  <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg">
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button onClick={() => onNavigate('organizer')} className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-solana-cyan">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-extrabold text-white sm:text-4xl">Manage Events</h1>
          <p className="mt-2 text-xs text-slate-300 sm:text-sm">Review mock event inventory loaded from this browser.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-1.5 text-xs text-yellow-100">Demo Mode</span>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {events.map((event) => {
          const remainingTickets = event.tiers?.reduce((total, tier) => total + tier.remainingQuantity, 0) ?? 0;
          return (
            <article key={event.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#120B30] shadow-xl">
              <img src={event.thumbnailImage} alt={event.title} className="h-40 w-full object-cover" />
              <div className="space-y-4 p-5">
                <div>
                  <h2 className="break-words text-lg font-bold text-white">{event.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">{event.date} · {event.venue}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3"><CalendarDays className="mb-2 h-4 w-4 text-solana-cyan" /><span className="block text-slate-400">Category</span><strong className="text-white">{event.category}</strong></div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3"><Package className="mb-2 h-4 w-4 text-solana-green" /><span className="block text-slate-400">Remaining</span><strong className="text-white">{remainingTickets}</strong></div>
                </div>
                <button onClick={() => onNavigate('event-detail')} className="inline-flex items-center gap-2 text-xs font-semibold text-solana-cyan hover:text-white">
                  <Edit3 className="h-4 w-4" /> View event information
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  </div>
);
