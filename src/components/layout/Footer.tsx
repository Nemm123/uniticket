import React from 'react';
import { Ticket, Sparkles, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-white/10 bg-[#060312] text-slate-300 text-sm relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Layout 1 cột trên Mobile, 2 cột trên Tablet, 4 cột trên Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand */}
          <div className="space-y-3">
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-solana-purple via-neon-pink to-solana-cyan p-0.5 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#0E0924] rounded-[6px] flex items-center justify-center">
                  <Ticket className="w-4 h-4 text-solana-cyan" />
                </div>
              </div>
              <span className="text-lg font-bold text-white font-display">
                Uni<span className="text-gradient-solana">Ticket</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hệ thống bán vé sự kiện & hòa nhạc NFT thế hệ mới trên Solana Blockchain. Dự án xây dựng cho cuộc thi UniHackFest.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-solana-green font-medium pt-1">
              <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
              <span>Giai đoạn 1: Giao diện Frontend UI/UX</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Điều Hướng
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="text-slate-300 hover:text-solana-cyan transition-colors"
                >
                  Trang Chủ
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('events')}
                  className="text-slate-300 hover:text-solana-cyan transition-colors"
                >
                  Khám Phá Sự Kiện
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('my-tickets')}
                  className="text-slate-300 hover:text-solana-cyan transition-colors"
                >
                  Vé Của Tôi
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('create-event')}
                  className="text-slate-300 hover:text-solana-cyan transition-colors"
                >
                  Tạo Sự Kiện Mới
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Solana Ecosystem */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Hệ Sinh Thái
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-solana-green" />
                <span>Solana Network</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-solana-purple" />
                <span>Metaplex NFT Standard</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-neon-pink" />
                <span>Phantom & Solflare Ready</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-solana-cyan" />
                <span>UniHackFest Showcase</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Community & Contest */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              UniHackFest 2026
            </h4>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Sản phẩm dự thi Web3 Track. Hướng tới trải nghiệm âm nhạc không biên giới.
            </p>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-200">
              ⚡ Xây dựng với React, Vite, TypeScript & Tailwind CSS.
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p>© 2026 UniTicket - UniHackFest Project. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <span>Thiết kế cho cộng đồng Web3</span>
            <Heart className="w-3.5 h-3.5 text-neon-pink fill-neon-pink" />
          </div>
        </div>
      </div>
    </footer>
  );
};
