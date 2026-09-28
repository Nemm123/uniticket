import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, XCircle, SwitchCamera, Loader2, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isEnabled: boolean;
  onClose: () => void;
  facingMode?: 'environment' | 'user';
  onToggleCamera?: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isEnabled,
  onClose,
  facingMode = 'environment',
  onToggleCamera,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!isEnabled) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => undefined).finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch {}
          scannerRef.current = null;
        }
      }
      return;
    }

    const startScanner = async () => {
      setIsStarting(true);
      setCameraError(null);

      // Tắt stream/scanner cũ an toàn trước khi đổi camera hoặc khởi tạo
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          console.warn('[QRScanner] Dọn dẹp camera cũ:', e);
        }
        scannerRef.current = null;
      }

      if (isCancelled) return;

      try {
        const qrElement = document.getElementById('qr-reader');
        if (!qrElement) return;

        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        // Cấu hình facingMode: { ideal: facingMode } theo yêu cầu
        const cameraConfig: MediaTrackConstraints = {
          facingMode: { ideal: facingMode },
        };

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            try {
              if (html5QrCode.isScanning) {
                html5QrCode.pause(true);
              }
            } catch {}
            onScanSuccess(decodedText);
          },
          () => {
            // Bỏ qua frame error
          }
        );
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[QRScanner] Lỗi khởi động camera:', err);
          setCameraError(
            err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.'
          );
        }
      } finally {
        if (!isCancelled) {
          setIsStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      isCancelled = true;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => undefined).finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch {}
          scannerRef.current = null;
        }
      }
    };
  }, [isEnabled, facingMode, onScanSuccess]);

  if (!isEnabled) return null;

  return (
    <div className="relative w-full max-w-md mx-auto bg-black/70 border border-solana-purple/30 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#120B30]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-solana-cyan" />
          <span className="text-sm font-semibold text-white">Scanner</span>
          <span className="inline-flex items-center rounded-full border border-solana-cyan/30 bg-solana-cyan/10 px-2.5 py-0.5 text-[11px] font-semibold text-solana-cyan">
            {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleCamera && (
            <button
              type="button"
              onClick={onToggleCamera}
              disabled={isStarting}
              title={`Chuyển sang ${facingMode === 'environment' ? 'Camera Trước' : 'Camera Sau'}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-solana-cyan/40 bg-solana-cyan/15 hover:bg-solana-cyan/25 px-2.5 py-1 text-xs font-bold text-solana-cyan transition-all active:scale-95 disabled:opacity-50"
            >
              <SwitchCamera className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Đổi camera 🔄</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Tắt camera"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[280px] bg-black flex items-center justify-center">
        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 gap-2 text-solana-cyan">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Đang kích hoạt {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}...</p>
          </div>
        )}

        {cameraError && (
          <div className="p-4 text-center text-xs text-pink-300 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-neon-pink" />
            <p>{cameraError}</p>
          </div>
        )}

        <div
          id="qr-reader"
          className="w-full text-slate-200 [&_video]:w-full [&_video]:max-h-[360px] [&_video]:object-cover [&_video]:rounded-b-xl"
        />
      </div>
    </div>
  );
};
