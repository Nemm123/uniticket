import React from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { UserRole } from '../../types';

interface AccessDeniedProps {
  currentRole: UserRole | null;
  onConnectWallet: () => void;
  onNavigate: (page: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ currentRole, onConnectWallet, onNavigate }) => (
  <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
    <div className="w-full max-w-lg rounded-2xl border border-neon-pink/30 bg-[#120B30] p-6 text-center shadow-2xl sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-pink/40 bg-neon-pink/10 text-neon-pink">
        <LockKeyhole className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-white">Yêu Cầu Quyền Ban Tổ Chức</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">Khu vực này chỉ dành cho ban tổ chức hoặc quản trị viên đã xác thực chữ ký ví hợp lệ.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button onClick={onConnectWallet} className="rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-3 text-sm font-bold text-white shadow-lg">Kết Nối Ví Organizer</button>
        <button onClick={() => onNavigate('home')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-4 w-4" /> Về Trang Chủ</button>
      </div>
      {currentRole && <p className="mt-5 text-[11px] text-slate-500">Vai trò hiện tại: {currentRole}</p>}
    </div>
  </div>
);
