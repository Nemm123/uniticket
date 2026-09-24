import React from 'react';
import { ArrowLeft, LockKeyhole, LayoutDashboard } from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode } from '../../utils/viewMode';

interface AccessDeniedProps {
  authRole: UserRole | null;
  viewMode?: ViewMode;
  onSwitchToOrganizerView?: () => void;
  onConnectWallet: () => void;
  onNavigate: (page: string) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  authRole,
  viewMode,
  onSwitchToOrganizerView,
  onConnectWallet,
  onNavigate
}) => {
  const isOrganizerInAttendeeView = authRole === 'organizer' && viewMode === 'attendee';

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-neon-pink/30 bg-[#120B30] p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-pink/40 bg-neon-pink/10 text-neon-pink">
          <LockKeyhole className="h-8 w-8" />
        </div>

        {isOrganizerInAttendeeView ? (
          <>
            <h1 className="mt-5 text-2xl font-extrabold text-white">Chế Độ Xem Người Tham Dự</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Ví của bạn đã được xác thực quyền Ban tổ chức trên máy chủ, nhưng bạn hiện đang bật chế độ xem Người tham dự.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onSwitchToOrganizerView}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-3 text-sm font-bold text-white shadow-lg active:scale-95 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Chuyển sang Chế độ Ban tổ chức</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Về Trang Chủ</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-extrabold text-white">Bạn Chưa Có Quyền Ban Tổ Chức</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Khu vực quản lý và soát vé này chỉ dành cho Ban tổ chức hoặc Quản trị viên đã xác thực chữ ký ví hợp lệ trên hệ thống.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onConnectWallet}
                className="rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-5 py-3 text-sm font-bold text-white shadow-lg active:scale-95 transition-all"
              >
                Kết Nối Ví Organizer
              </button>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Về Trang Chủ</span>
              </button>
            </div>
          </>
        )}

        {authRole && (
          <p className="mt-5 text-[11px] text-slate-500">
            Quyền tài khoản: <span className="font-semibold text-slate-400">{authRole}</span>
            {viewMode && ` · Đang xem: ${viewMode}`}
          </p>
        )}
      </div>
    </div>
  );
};
