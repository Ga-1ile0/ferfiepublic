'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface NFTImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  nftName: string;
}

export function NFTImageModal({ isOpen, onClose, imageUrl, nftName }: NFTImageModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl) return;

    try {
      setIsDownloading(true);

      // Fetch the image
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${nftName.replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-black/95">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-white bg-black/50 hover:bg-black/70 z-10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 left-2 text-white bg-black/50 hover:bg-black/70 z-10"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="h-5 w-5" />
          </Button>

          <div className="flex items-center justify-center p-4 h-[80vh]">
            <img
              src={imageUrl || '/placeholder.svg'}
              alt={nftName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
