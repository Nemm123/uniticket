import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface LiveActivityBannerProps {
  onNavigateMarketplace?: () => void;
}

const ACTIVITIES = [
  {
    id: 'act-1',
    wallet: '0x3f...8a',
    text: 'niêm yết Solana Vietnam Tour (0.12 SOL) • Royalty 10% BTC',
    badge: 'Chợ Vé',
    badgeColor: 'text-solana-cyan border-solana-cyan/30 bg-solana-cyan/10',
  },
  {
    id: 'act-2',
    wallet: '0x1e...9d',
    text: 'mua vé EDM Festival • Giới hạn đổi chủ 1/2',
    badge: 'Đổi chủ 1/2',
    badgeColor: 'text-yellow-300 border-yellow-500/30 bg-yellow-950/40',
  },
  {
    id: 'act-3',
    wallet: '0x7a...4b',
    text: 'mua vé Neon Horizon 2026 (0.05 SOL) • Royalty 10% chuyển về BTC',
    badge: '10% Royalty',
    badgeColor: 'text-neon-pink border-neon-pink/30 bg-neon-pink/10',
  },
  {
    id: 'act-4',
    wallet: '0x9c...3e',
    text: 'hoàn tất Escrow an toàn vé Tech Fest 2026 • Khóa chuyển nhượng 2/2',
    badge: '2/2 Locked',
    badgeColor: 'text-red-300 border-red-500/30 bg-red-950/40',
  },
  {
    id: 'act-5',
    wallet: '0x5c...2f',
    text: 'check-in Dynamic QR Concert Anh Trai Say Hi • Xác thực Ed25519 Devnet',
    badge: 'Check-In OK',
    badgeColor: 'text-solana-green border-solana-green/30 bg-solana-green/10',
  },
];

export const LiveActivityBanner: React.FC<LiveActivityBannerProps> = ({ onNavigateMarketplace }) => {
  return (
    <div
      role="region"
      aria-label="Web3 Live Activity Ticker"
      className="relative z-20 w-full bg-slate-950/90 backdrop-blur-md border-b border-purple-500/20 text-xs overflow-hidden"
    >
      <div className="max-w-7xl mx-auto flex items-center h-8 sm:h-9 px-4 overflow-hidden relative">
        {/* Nhãn 🟢 LIVE ACTIVITY ghim cố định ở góc trái */}
        <div className="z-20 flex-shrink-0 bg-slate-950/90 backdrop-blur-md pr-4 border-r border-purple-500/20 flex items-center gap-1.5 h-full select-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-solana-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-solana-green" />
          </span>
          <span className="text-[10px] font-black tracking-wider text-solana-green uppercase font-mono flex items-center gap-1">
            <span>LIVE ACTIVITY</span>
          </span>
        </div>

        {/* Dải chữ chạy (Marquee) với hiệu ứng Fade Mask ở mép phải */}
        <div
          className="flex-1 overflow-hidden relative h-full flex items-center"
          style={{
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
          <div className="animate-marquee flex items-center gap-8 pl-4 select-none hover:[animation-play-state:paused]">
            {/* Lượt 1 */}
            {ACTIVITIES.map((act) => (
              <div key={act.id} className="flex items-center gap-2 text-slate-300 text-[11px] sm:text-xs shrink-0 whitespace-nowrap">
                <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                  [{act.wallet}]
                </span>
                <span className="text-slate-200">{act.text}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                  {act.badge}
                </span>
                <span className="text-purple-500/40 text-xs pl-2">✦</span>
              </div>
            ))}

            {/* Lượt 2 để cuộn liên tục mượt mà */}
            {ACTIVITIES.map((act) => (
              <div key={`loop-${act.id}`} className="flex items-center gap-2 text-slate-300 text-[11px] sm:text-xs shrink-0 whitespace-nowrap">
                <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/15">
                  [{act.wallet}]
                </span>
                <span className="text-slate-200">{act.text}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${act.badgeColor}`}>
                  {act.badge}
                </span>
                <span className="text-purple-500/40 text-xs pl-2">✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nút nhỏ gọn: [Săn vé ↗] */}
        {onNavigateMarketplace && (
          <button
            type="button"
            onClick={onNavigateMarketplace}
            className="z-20 flex-shrink-0 pl-3 pr-1 text-[11px] font-bold text-neon-pink hover:text-pink-300 transition-colors flex items-center gap-0.5 bg-slate-950/90 backdrop-blur-md border-l border-purple-500/20 h-full group"
            title="Săn vé trên Chợ Vé →"
          >
            <span>Săn vé</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        )}
      </div>
    </div>
  );
};
