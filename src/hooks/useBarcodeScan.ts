import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface ScanResult {
  data: string;
  type: 'barcode' | 'qr' | 'manual';
}

export const useBarcodeScan = (onScan: (result: ScanResult) => void, enabled: boolean = true) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  const startScanning = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      videoRef.current.srcObject = stream;
      setIsScanning(true);
      setError(null);

      const scan = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (code) {
              onScan({ data: code.data, type: 'qr' });
            }
          } catch (err) {
            // Continue scanning
          }
        }

        if (enabled) {
          animationFrameRef.current = requestAnimationFrame(scan);
        }
      };

      if (enabled) {
        animationFrameRef.current = requestAnimationFrame(scan);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to access camera');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsScanning(false);
  };

  useEffect(() => {
    if (enabled) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => stopScanning();
  }, [enabled]);

  return {
    videoRef,
    canvasRef,
    isScanning,
    error,
    startScanning,
    stopScanning,
  };
};
