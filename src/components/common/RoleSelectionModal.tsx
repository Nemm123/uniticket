import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, LayoutDashboard, Lock, UserRound, X } from 'lucide-react';
import { UserRole } from '../../types';
import { ViewMode } from '../../utils/viewMode';
import { useTranslation } from '../../i18n';

export interface RoleSelectionModalProps {
  isOpen: boolean;
  currentRole?: UserRole | null;
  authRole?: UserRole | null;
  viewMode?: ViewMode;
  onClose: () => void;
  onContinue: (role: UserRole | ViewMode) => void;
}

interface RoleOptionConfig {
  role: 'attendee' | 'organizer';
  titleKey: string;
  descKey: string;
  icon: typeof UserRound | typeof LayoutDashboard | typeof Building2;
  featureKeys: string[];
}

const ROLE_OPTIONS: RoleOptionConfig[] = [
  {
    role: 'attendee',
    titleKey: 'roleModal.attendeeTitle',
    descKey: 'roleModal.attendeeDesc',
    icon: UserRound,
    featureKeys: [
      'roleModal.attendeeFeatures.explore',
      'roleModal.attendeeFeatures.buy',
      'roleModal.attendeeFeatures.myTickets',
      'roleModal.attendeeFeatures.showQr',
      'roleModal.attendeeFeatures.checkStatus',
    ],
  },
  {
    role: 'organizer',
    titleKey: 'roleModal.organizerTitle',
    descKey: 'roleModal.organizerDesc',
    icon: Building2,
    featureKeys: [
      'roleModal.organizerFeatures.create',
      'roleModal.organizerFeatures.manageTickets',
      'roleModal.organizerFeatures.eventInfo',
      'roleModal.organizerFeatures.checkIn',
      'roleModal.organizerFeatures.stats',
    ],
  },
];

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  currentRole,
  authRole,
  viewMode,
  onClose,
  onContinue,
}) => {
  const { t } = useTranslation();
  const isActualOrganizer = (authRole ?? currentRole) === 'organizer';

  // Xác định lựa chọn ban đầu dựa trên viewMode hoặc currentRole
  const initialSelection = viewMode ?? (currentRole === 'organizer' ? 'organizer' : 'attendee');
  const [selectedRole, setSelectedRole] = useState<'attendee' | 'organizer'>(initialSelection);

  useEffect(() => {
    if (isOpen) {
      const mode = viewMode ?? (currentRole === 'organizer' ? 'organizer' : 'attendee');
      setSelectedRole(mode);
    }
  }, [isOpen, viewMode, currentRole]);

  if (!isOpen) return null;

  const handleSelect = (role: 'attendee' | 'organizer') => {
    // Không cho phép UI giả lập quyền Organizer nếu tài khoản không có quyền thật từ backend
    if (role === 'organizer' && !isActualOrganizer) {
      return;
    }
    setSelectedRole(role);
  };

  const handleConfirm = () => {
    if (!selectedRole) return;
    onContinue(selectedRole);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/85 p-4 backdrop-blur-md">
      <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-solana-purple/40 bg-[#0F0A28] p-5 shadow-2xl shadow-purple-950/80 sm:p-7 animate-scaleUp">
        {/* Vệt sáng gradient nền */}
        <div className="absolute -right-20 -top-20 h-44 w-44 rounded-full bg-solana-purple/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-solana-green/10 blur-3xl pointer-events-none" />

        {/* Tiêu đề Modal */}
        <div className="relative flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-solana-cyan">
              {t('roleModal.badge')}
            </p>
            <h2 className="text-xl font-extrabold text-white sm:text-2xl">
              {t('roleModal.title')}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {t('roleModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lưới 2 thẻ lựa chọn vai trò */}
        <div className="relative mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.role;
            const isOrganizerCard = option.role === 'organizer';
            const isDisabled = isOrganizerCard && !isActualOrganizer;

            return (
              <button
                type="button"
                key={option.role}
                disabled={isDisabled}
                onClick={() => handleSelect(option.role)}
                className={`relative rounded-2xl border p-5 text-left transition-all group ${
                  isDisabled
                    ? 'border-white/5 bg-[#120B30]/50 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'border-solana-cyan bg-solana-purple/25 shadow-xl shadow-solana-cyan/10 ring-1 ring-solana-cyan/50'
                      : 'border-white/10 bg-[#171038]/80 hover:border-solana-purple/60 hover:bg-[#21164A] hover:shadow-lg hover:shadow-solana-purple/20'
                }`}
              >
                {/* Header của từng thẻ: Icon và Checkmark */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-solana-cyan/20 text-solana-cyan'
                        : 'bg-white/10 text-slate-300 group-hover:text-white'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {isDisabled ? (
                    <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-white/10">
                      <Lock className="h-3 w-3" />
                      {t('roleModal.requiresWallet')}
                    </span>
                  ) : isSelected ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-solana-cyan/20 border border-solana-cyan text-solana-green">
                      <CheckCircle2 className="h-4 w-4 text-solana-green" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border border-white/20 group-hover:border-white/40 transition-colors" />
                  )}
                </div>

                {/* Tiêu đề & Mô tả */}
                <h3 className="mt-3.5 text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>{t(option.titleKey)}</span>
                  {isSelected && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-solana-green/20 text-solana-green font-semibold">
                      {t('roleModal.selected')}
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300 min-h-[36px]">
                  {t(option.descKey)}
                </p>

                {/* Danh sách tính năng */}
                <ul className="mt-4 space-y-2 border-t border-white/5 pt-3.5 text-xs text-slate-300">
                  {option.featureKeys.map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-solana-green" />
                      <span className="text-slate-200">{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Nút hành động phía dưới */}
        <div className="relative mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!selectedRole}
            onClick={handleConfirm}
            className="rounded-xl bg-gradient-to-r from-solana-purple via-neon-pink to-solana-cyan px-7 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-950/60 hover:shadow-solana-purple/50 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('common.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};
