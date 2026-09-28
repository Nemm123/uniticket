import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, XCircle, SwitchCamera, Loader2, AlertCircle, CameraOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isEnabled: boolean;
  onClose: () => void;
  facingMode?: 'environment' | 'user';
  onToggleCamera?: () => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  isEnabled,
  onClose,
  facingMode = 'environment',
  onToggleCamera,
  onError,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetryPermission = async () => {
    setPermissionDenied(false);
    setCameraError(null);
    setIsStarting(true);

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: facingMode } },
        };
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          stream.getTracks().forEach((track) => track.stop());
        } catch (err: any) {
          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
            setPermissionDenied(true);
            const deniedMsg =
              'Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bấm vào icon Ổ Khóa trên thanh địa chỉ để cấp quyền.';
            setCameraError(deniedMsg);
            onError?.(deniedMsg);
            setIsStarting(false);
            return;
          }
          // Thử fallback { video: true }
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            fallbackStream.getTracks().forEach((track) => track.stop());
          } catch (e: any) {
            console.warn('[QRScanner] Fallback getUserMedia failed:', e);
          }
        }
      }
    } catch (e) {
      console.warn('[QRScanner] Retry permission prompt error:', e);
    }

    setRetryCount((prev) => prev + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    const stopExistingTracks = () => {
      try {
        const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
        if (videoEl && videoEl.srcObject instanceof MediaStream) {
          videoEl.srcObject.getTracks().forEach((track) => track.stop());
          videoEl.srcObject = null;
        }
      } catch {}
    };

    if (!isEnabled) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => undefined).finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
            stopExistingTracks();
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch {}
          stopExistingTracks();
          scannerRef.current = null;
        }
      }
      return;
    }

    const startScanner = async () => {
      setIsStarting(true);
      setCameraError(null);
      setPermissionDenied(false);

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
      stopExistingTracks();

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

        const scanConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        const onScanSuccessCallback = (decodedText: string) => {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.pause(true);
            }
          } catch {}
          onScanSuccess(decodedText);
        };

        try {
          // Thử khởi động camera với constraints facingMode: { ideal: facingMode }
          await html5QrCode.start(cameraConfig, scanConfig, onScanSuccessCallback, () => {});
        } catch (initialErr: any) {
          const errName = initialErr?.name || '';
          const errMsg = String(initialErr?.message || initialErr || '');
          const isPermissionDenied =
            errName === 'NotAllowedError' ||
            errName === 'PermissionDeniedError' ||
            /denied|not allowed|permission/i.test(errMsg);

          if (isPermissionDenied) {
            throw initialErr;
          }

          // CƠ CHẾ DỰ PHÒNG CONSTRAINTS (MOBILE COMPATIBILITY):
          // Nếu constraints phức tạp { facingMode: { ideal: facingMode } } thất bại, tự động fallback sang constraints đơn giản { video: true }
          console.warn('[QRScanner] Thử fallback với constraints đơn giản { video: true }:', initialErr);
          await html5QrCode.start({ video: true } as any, scanConfig, onScanSuccessCallback, () => {});
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[QRScanner] Lỗi khởi động camera:', err);
          const errName = err?.name || '';
          const errMsg = String(err?.message || err || '');

          if (
            errName === 'NotAllowedError' ||
            errName === 'PermissionDeniedError' ||
            /not allowed|permission denied|denied/i.test(errMsg)
          ) {
            setPermissionDenied(true);
            const msg =
              'Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bấm vào icon Ổ Khóa trên thanh địa chỉ để cấp quyền.';
            setCameraError(msg);
            onError?.(msg);
          } else if (
            errName === 'NotFoundError' ||
            errName === 'DevicesNotFoundError' ||
            /not found|no device|devicesnotfound/i.test(errMsg)
          ) {
            const msg = 'Không tìm thấy thiết bị Camera trên thiết bị này.';
            setCameraError(msg);
            onError?.(msg);
          } else {
            const msg =
              err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.';
            setCameraError(msg);
            onError?.(msg);
          }
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
            stopExistingTracks();
            scannerRef.current = null;
          });
        } else {
          try {
            scannerRef.current.clear();
          } catch {}
          stopExistingTracks();
          scannerRef.current = null;
        }
      }
    };
  }, [isEnabled, facingMode, retryCount, onScanSuccess, onError]);

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
        {/* Nút nổi tròn ở góc trên bên phải khung quét để đổi camera tức thì trên mobile */}
        {onToggleCamera && (
          <button
            type="button"
            onClick={onToggleCamera}
            disabled={isStarting}
            title={`Chuyển sang ${facingMode === 'environment' ? 'Camera Trước' : 'Camera Sau'}`}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-solana-cyan/50 text-solana-cyan px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-90 shadow-xl disabled:opacity-50"
          >
            <SwitchCamera className={`w-4 h-4 ${isStarting ? 'animate-spin' : ''}`} />
            <span>{facingMode === 'environment' ? 'Camera Sau 🔄' : 'Camera Trước 🔄'}</span>
          </button>
        )}

        {isStarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-2 text-solana-cyan">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Đang kích hoạt {facingMode === 'environment' ? 'Camera Sau' : 'Camera Trước'}...</p>
          </div>
        )}

        {permissionDenied ? (
          <div className="z-20 flex flex-col items-center justify-center p-6 text-center bg-black/90 rounded-b-xl border-t border-neon-pink/30 space-y-4 max-w-sm mx-auto my-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-neon-pink/15 flex items-center justify-center border border-neon-pink/40 animate-pulse">
                <CameraOff className="w-8 h-8 text-neon-pink" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black p-1 rounded-full shadow">
                <Lock className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-neon-pink" />
                Chưa cấp quyền truy cập Camera
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bấm vào icon Ổ Khóa 🔒 bên cạnh URL -&gt; Cho phép Máy ảnh -&gt; Bấm nút Thử lại bên dưới.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRetryPermission}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-solana-purple to-neon-pink px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:brightness-110 active:scale-95 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại cấp quyền
            </button>
          </div>
        ) : cameraError ? (
          <div className="z-20 p-6 text-center text-xs text-pink-300 flex flex-col items-center gap-3 bg-black/90 rounded-b-xl border-t border-neon-pink/30 my-4 max-w-sm mx-auto">
            <AlertCircle className="w-8 h-8 text-neon-pink" />
            <p className="max-w-xs">{cameraError}</p>
            <button
              type="button"
              onClick={handleRetryPermission}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại cấp quyền
            </button>
          </div>
        ) : null}

        <div
          id="qr-reader"
          className={`w-full text-slate-200 [&_video]:w-full [&_video]:max-h-[360px] [&_video]:object-cover [&_video]:rounded-b-xl ${
            permissionDenied || cameraError ? 'hidden' : 'block'
          }`}
        />
      </div>
    </div>
  );
};
