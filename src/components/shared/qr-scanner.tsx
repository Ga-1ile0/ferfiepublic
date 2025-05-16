'use client';

import { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onResult: (result: string) => void;
}

export function QrScanner({ onResult }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        setIsScanning(true);

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          decodedText => {
            if (html5QrCode) {
              html5QrCode.stop().then(() => {
                onResult(decodedText);
              });
            }
          },
          errorMessage => {
            console.log(errorMessage);
          }
        );
      } catch (err) {
        setError('Camera access denied or not available');
        setIsScanning(false);
        console.error(err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode && isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onResult]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-full max-w-[300px] aspect-square mx-auto border-2 border-dashed rounded-lg overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-red-500">
            {error}
          </div>
        ) : (
          <div id="qr-reader" className="w-full h-full"></div>
        )}
      </div>
      <p className="text-sm text-center text-muted-foreground">
        Position the QR code within the frame to scan
      </p>
    </div>
  );
}
