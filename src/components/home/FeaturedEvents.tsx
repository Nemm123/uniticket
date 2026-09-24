import React, { useState } from 'react';
import { Calendar, MapPin, Tag, ArrowUpRight, Flame } from 'lucide-react';
import { EventItem } from '../../types';

interface FeaturedEventsProps {
  events: EventItem[];
  onSelectEvent: (eventId: string) => void;
}

export const FeaturedEvents: React.FC<FeaturedEventsProps> = ({
  events,
  onSelectEvent,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Concert', 'EDM Festival', 'Web3 Hackathon', 'Rock Arena'];

  const filteredEvents = selectedCategory === 'All'
    ? events
    : events.filter(e => e.category === selectedCategory);

  return (
    <section id="featured-events-section" className="py-12 sm:py-16 relative z-10 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-[11px] sm:text-xs font-semibold text-solana-cyan mb-2">
              <Flame className="w-3.5 h-3.5 text-neon-pink" />
              <span>SỰ KIỆN ĐƯỢC CHỜ ĐỢI NHẤT</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Khám Phá <span className="text-gradient-solana">Concert & Lễ Hội Âm Nhạc</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              Chọn sự kiện yêu thích, nhận vé NFT kèm đặc quyền VIP và lưu giữ trọn đời trên ví Solana.
            </p>
          </div>

          {/* Category Filter: Hỗ trợ cuộn ngang mượt mà trên Mobile */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0 sm:flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-solana-purple to-neon-pink text-white shadow-lg shadow-purple-900/40'
                    : 'bg-[#150E35] text-slate-300 hover:text-white hover:bg-[#20154F] border border-white/10'
                }`}
              >
                {cat === 'All' ? 'Tất cả' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredEvents.map((event) => {
            const percentSold = Math.round((event.soldTickets / event.totalTickets) * 100);

            return (
              <div
                key={event.id}
                onClick={() => onSelectEvent(event.id)}
                className="group relative rounded-2xl bg-[#110A2B]/85 hover:bg-[#180E3D] border border-white/10 hover:border-solana-purple/50 p-4 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden hover:shadow-purple-950/50"
              >
                {/* Glow on hover */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-solana-purple/10 rounded-full blur-2xl group-hover:bg-solana-purple/25 transition-all pointer-events-none" />

                <div>
                  {/* Event Thumbnail */}
                  <div className="relative h-48 sm:h-52 rounded-xl overflow-hidden mb-4 bg-black/40">
                    <img
                      src={event.thumbnailImage}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-transparent to-black/30" />

                    {/* Category Badge */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-semibold text-solana-cyan flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-solana-green" />
                      <span>{event.category}</span>
                    </div>

                    {/* Price Tag */}
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs font-bold shadow-md">
                      {event.minPriceVnd !== undefined ? `${event.minPriceVnd.toLocaleString('vi-VN')} ₫` : 'Chưa cập nhật'}
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="space-y-2 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-solana-cyan transition-colors line-clamp-2 break-words">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-normal break-words">
                      {event.subtitle}
                    </p>

                    <div className="space-y-1.5 pt-2 text-xs text-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-solana-purple/20 text-solana-purple shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate min-w-0 block">{event.date} • {event.time}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded bg-neon-pink/20 text-neon-pink shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate min-w-0 block">{event.venue}, {event.city}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Ticket Sales Progress & Action */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5 gap-2 min-w-0">
                      <span className="truncate min-w-0">Đã bán <strong className="text-white">{percentSold}%</strong></span>
                      <span className="text-solana-green font-semibold shrink-0">
                        Còn {event.totalTickets - event.soldTickets} vé
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-solana-purple via-neon-pink to-solana-green"
                        style={{ width: `${percentSold}%` }}
                      />
                    </div>
                  </div>

                  {/* Button */}
                  <div className="w-full py-2.5 rounded-xl bg-[#1D1248] group-hover:bg-gradient-to-r group-hover:from-solana-purple group-hover:to-neon-pink text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-md">
                    <span>Xem Chi Tiết & Đặt Vé</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
