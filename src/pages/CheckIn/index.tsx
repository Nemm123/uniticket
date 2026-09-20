import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Keyboard, RotateCcw, ScanLine, ShieldAlert, Ticket, XCircle } from 'lucide-react';
import QrScanner from 'qr-scanner';
import { CheckInResult } from '../../types';
import { checkInTicket } from '../../utils/storage';

interface CheckInPageProps {
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CheckInPage: React.FC<CheckInPageProps> = ({ onShowToast }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isProcessingRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);

  const processInput = (input: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    const checkInResult = checkInTicket(input);
    setResult(checkInResult);
    setCameraEnabled(false);
    scannerRef.current?.stop();
    isProcessingRef.current = false;
    onShowToast(
      checkInResult.status === 'valid' ? 'success' : 'error',
      checkInResult.message,
    );
  };

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) return;

    let scanner: QrScanner | null = null;
    const video = videoRef.current;
    setCameraError(null);

    const startScanner = async () => {
      scanner = new QrScanner(
        video,
        (scanResult) => processInput(scanResult.data),
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 5,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      );
      scannerRef.current = scanner;
      try {
        await scanner.start();
      } catch {
        setCameraError('Không thể truy cập camera. Hãy cấp quyền camera hoặc nhập mã vé thủ công.');
        setCameraEnabled(false);
      }
    };

    void startScanner();
    return () => {
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, [cameraEnabled]);

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    processInput(manualCode);
  };

  const resetCheckIn = () => {
    setResult(null);
    setCameraError(null);
    setManualCode('');
    isProcessingRef.current = false;
  };

  const resultStyle = result?.status === 'valid'
    ? 'border-solana-green/50 bg-solana-green/10 text-solana-green'
    : result?.status === 'used'
      ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200'
      : 'border-neon-pink/50 bg-neon-pink/10 text-neon-pink';

  return (
    <div className="min-h-screen py-8 sm:py-12 cyber-grid-bg">
      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="border-b border-white/10 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-3 py-1 text-xs font-semibold text-solana-cyan">
            <ScanLine className="h-4 w-4" />
            Staff Console
          </div>
          <h1 className="text-2xl font-extrabold text-white sm:text-4xl">
            QR <span className="text-gradient-solana">Check-in</span>
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Quét QR trên vé hoặc nhập ticketCode để kiểm tra vé mô phỏng trước khi cho phép vào sự kiện.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-solana-cyan" />
                <h2 className="font-bold text-white">Quét bằng camera</h2>
              </div>
              {cameraEnabled && (
                <button
                  type="button"
                  onClick={() => setCameraEnabled(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                >
                  <XCircle className="h-4 w-4" />
                  Dừng
                </button>
              )}
            </div>

            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/50">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <ScanLine className="h-10 w-10 text-solana-purple" />
                  <p className="text-xs text-slate-400">Camera chỉ hoạt động khi bạn bấm bắt đầu và cấp quyền trình duyệt.</p>
                  <button
                    type="button"
                    onClick={() => { resetCheckIn(); setCameraEnabled(true); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg"
                  >
                    <Camera className="h-4 w-4" />
                    Bắt đầu quét
                  </button>
                </div>
              )}
            </div>
            {cameraError && (
              <p className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-950/30 p-3 text-xs text-yellow-100">{cameraError}</p>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Camera cần HTTPS hoặc localhost. QR và kết quả này chỉ là dữ liệu mô phỏng frontend, không cung cấp chống gian lận thực tế.
            </p>
          </section>

          <section className="rounded-2xl border border-solana-purple/30 bg-[#120B30] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-solana-cyan" />
              <h2 className="font-bold text-white">Nhập thủ công</h2>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label htmlFor="ticket-code" className="block text-xs font-semibold text-slate-200">Ticket code</label>
              <input
                id="ticket-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Dán ticketCode hoặc QR payload JSON"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-solana-purple"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Kiểm tra vé
              </button>
            </form>

            {result && (
              <div className={`mt-6 rounded-xl border p-4 ${resultStyle}`} role="status">
                <div className="flex items-start gap-3">
                  {result.status === 'valid' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-bold">{result.message}</p>
                    {result.ticket && (
                      <div className="mt-3 space-y-1 text-xs text-slate-200">
                        <p><span className="text-slate-400">Ticket ID:</span> {result.ticket.id}</p>
                        <p><span className="text-slate-400">Ticket code:</span> {result.ticket.ticketCode}</p>
                        {result.ticket.checkInTime && <p><span className="text-slate-400">Check-in time:</span> {new Date(result.ticket.checkInTime).toLocaleString('vi-VN')}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={resetCheckIn}
              className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Xóa kết quả
            </button>
          </section>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-solana-green/20 bg-solana-green/5 p-4 text-xs text-slate-300">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-solana-green" />
          <span>Check-in chỉ cập nhật vé mô phỏng trong localStorage của trình duyệt này. Không có giao dịch Solana hoặc xác thực NFT thật.</span>
        </div>
      </div>
    </div>
  );
};
