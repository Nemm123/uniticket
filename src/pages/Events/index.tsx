import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, MapPin, Tag, ArrowUpRight, Sparkles, RotateCcw } from 'lucide-react';
import { getStoredEvents } from '../../utils/storage';

export const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const events = useMemo(() => getStoredEvents(), []);

  // State tìm kiếm và lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const categories = ['All', 'Concert', 'EDM Festival', 'Web3 Hackathon', 'Rock Arena'];

  // Lọc sự kiện theo điều kiện
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // 1. Tìm kiếm theo tên, nghệ sĩ, địa điểm
      const query = searchTerm.toLowerCase().trim();
      const matchQuery =
        !query ||
        evt.title.toLowerCase().includes(query) ||
        evt.venue.toLowerCase().includes(query) ||
        evt.city.toLowerCase().includes(query) ||
        (evt.lineup && evt.lineup.some((artist) => artist.toLowerCase().includes(query)));

      // 2. Lọc theo danh mục
      const matchCategory = selectedCategory === 'All' || evt.category === selectedCategory;

      // 3. Lọc theo khoảng giá SOL
      let matchPrice = true;
      if (priceRange === 'under-0.5') {
        matchPrice = evt.minPriceSol < 0.5;
      } else if (priceRange === '0.5-1.5') {
        matchPrice = evt.minPriceSol >= 0.5 && evt.minPriceSol <= 1.5;
      } else if (priceRange === 'over-1.5') {
        matchPrice = evt.minPriceSol > 1.5;
      }

      // 4. Lọc theo tháng (chuỗi DD/MM/YYYY)
      let matchMonth = true;
      if (selectedMonth !== 'all') {
        // format: 28/10/2026 -> lấy phần tháng '10'
        const parts = evt.date.split('/');
        if (parts.length >= 2) {
          matchMonth = parts[1] === selectedMonth;
        }
      }

      return matchQuery && matchCategory && matchPrice && matchMonth;
    });
  }, [events, searchTerm, selectedCategory, priceRange, selectedMonth]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setPriceRange('all');
    setSelectedMonth('all');
  };

  return (
    <div className="min-h-screen py-8 sm:py-12 relative z-10 cyber-grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-solana-purple/20 border border-solana-purple/40 text-xs font-semibold text-solana-cyan">
            <Sparkles className="w-3.5 h-3.5 text-solana-green animate-pulse" />
            <span>KHÁM PHÁ CONCERT & SỰ KIỆN SOLANA</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Tất Cả <span className="text-gradient-solana">Sự Kiện & Hòa Nhạc NFT</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Tìm kiếm những đêm nhạc bùng nổ, lễ hội EDM và sự kiện công nghệ Web3 hàng đầu. Mỗi vé phát hành độc bản trên blockchain Solana.
          </p>
        </div>

        {/* Search Bar & Multi-filter Controls */}
        <div className="p-4 sm:p-6 rounded-2xl bg-[#120B30]/90 border border-white/10 shadow-xl space-y-4">
          {/* Ô tìm kiếm từ khóa */}
          <div className="relative">
            <Search className="w-5 h-5 text-solana-cyan absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên sự kiện, nghệ sĩ (Martin Cyber, Vũ Cát Tường...), địa điểm..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0B0620] border border-white/10 focus:border-solana-purple focus:outline-none text-white text-xs sm:text-sm placeholder:text-slate-400 transition-colors shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Hàng bộ lọc kết hợp */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Lọc Thể Loại */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-solana-purple" />
                <span>Thể Loại Sự Kiện</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#120B30]">
                    {cat === 'All' ? 'Tất Cả Thể Loại' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Lọc Khoảng Giá SOL */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-solana-green" />
                <span>Khoảng Giá SOL</span>
              </label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                <option value="all" className="bg-[#120B30]">Tất Cả Mức Giá</option>
                <option value="under-0.5" className="bg-[#120B30]">Dưới 0.5 SOL</option>
                <option value="0.5-1.5" className="bg-[#120B30]">0.5 SOL - 1.5 SOL</option>
                <option value="over-1.5" className="bg-[#120B30]">Trên 1.5 SOL</option>
              </select>
            </div>

            {/* Lọc Theo Tháng */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-neon-pink" />
                <span>Tháng Tổ Chức</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0620] border border-white/10 text-xs text-white focus:border-solana-purple focus:outline-none"
              >
                <option value="all" className="bg-[#120B30]">Tất Cả Các Tháng</option>
                <option value="10" className="bg-[#120B30]">Tháng 10/2026</option>
                <option value="11" className="bg-[#120B30]">Tháng 11/2026</option>
                <option value="12" className="bg-[#120B30]">Tháng 12/2026</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kết quả tìm kiếm header */}
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>
            Tìm thấy <strong className="text-solana-cyan text-sm">{filteredEvents.length}</strong> sự kiện
          </span>
          {(searchTerm || selectedCategory !== 'All' || priceRange !== 'all' || selectedMonth !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-solana-purple hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* Grid Sự Kiện */}
        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredEvents.map((event) => {
              const percentSold = Math.round((event.soldTickets / event.totalTickets) * 100);

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="group relative rounded-2xl bg-[#110A2B]/85 hover:bg-[#180E3D] border border-white/10 hover:border-solana-purple/50 p-4 transition-all duration-300 hover:-translate-y-1.5 cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden hover:shadow-purple-950/50"
                >
                  <div className="absolute top-0 right-0 w-36 h-36 bg-solana-purple/10 rounded-full blur-2xl group-hover:bg-solana-purple/25 transition-all pointer-events-none" />

                  <div>
                    {/* Thumbnail */}
                    <div className="relative h-48 sm:h-52 rounded-xl overflow-hidden mb-4 bg-black/40">
                      <img
                        src={event.thumbnailImage}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#110A2B] via-transparent to-black/30" />

                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-semibold text-solana-cyan flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-solana-green" />
                        <span>{event.category}</span>
                      </div>

                      <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-solana-green/40 text-solana-green text-xs font-bold shadow-md">
                        {event.minPriceSol} SOL
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

                  {/* Card Footer */}
                  <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
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

                    <div className="w-full py-2.5 rounded-xl bg-[#1D1248] group-hover:bg-gradient-to-r group-hover:from-solana-purple group-hover:to-neon-pink text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-md">
                      <span>Xem Chi Tiết & Đặt Vé</span>
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State khi không tìm thấy sự kiện */
          <div className="py-16 text-center space-y-4 rounded-2xl bg-[#120B30]/60 border border-white/10 p-8">
            <div className="w-16 h-16 rounded-2xl bg-solana-purple/20 border border-solana-purple/40 flex items-center justify-center mx-auto text-solana-cyan">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Không tìm thấy sự kiện phù hợp</h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Không có concert hoặc lễ hội nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại của bạn.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-6 py-2.5 rounded-xl bg-solana-purple text-white font-semibold text-xs hover:bg-purple-600 transition-colors"
            >
              Xóa Bộ Lọc & Xem Tất Cả Sự Kiện
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
