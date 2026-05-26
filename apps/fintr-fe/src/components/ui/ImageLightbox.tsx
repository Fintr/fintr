"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AuthStorage } from '@/lib/auth-storage';
import { downloadBlobAsFile } from '@/lib/download-blob';
import { getPublicBackendUrl } from '@/lib/public-backend-url';

const ALLOWED_S3_PREFIXES = [
  'https://s3.ap-southeast-1.amazonaws.com/fintr-production/',
  'https://s3.ap-southeast-1.amazonaws.com/fintr-staging/',
  'https://s3.ap-southeast-1.amazonaws.com/fintr-development/',
];

interface ImageData {
  url: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
}

interface ImageLightboxProps {
  images: ImageData[];
  isOpen: boolean;
  initialIndex: number;
  onClose: () => void;
  openedFromModal?: boolean;
}

export default function ImageLightbox({
  images,
  isOpen,
  initialIndex,
  onClose,
  openedFromModal = false
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [animatedPosition, setAnimatedPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showDownloadErrorDialog, setShowDownloadErrorDialog] = useState(false);
  const historyPushedRef = useRef(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    resetZoom();
  }, [initialIndex]);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setAnimatedPosition({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev * 1.5, 5));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      const newPosition = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      setPosition(newPosition);
      setAnimatedPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  // Touch handlers for mobile pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const scaleChange = distance / lastTouchDistance;
        setScale(prev => Math.min(Math.max(prev * scaleChange, 0.5), 5));
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const touch = e.touches[0];
      const newPosition = {
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      };
      setPosition(newPosition);
      setAnimatedPosition(newPosition);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  useEffect(() => {
    resetZoom();
  }, [currentIndex]);

  const navigateNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const navigatePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleSubmitCapture = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('.lightbox-container')) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener('submit', handleSubmitCapture, true);

    return () => {
      document.removeEventListener('submit', handleSubmitCapture, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      historyPushedRef.current = false;
      return;
    }

    const handleCustomClose = () => {
      onClose();
    };

    const handlePopState = (e: PopStateEvent) => {
      if (historyPushedRef.current) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigatePrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateNext();
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomIn();
          break;
        case '-':
          event.preventDefault();
          zoomOut();
          break;
        case '0':
          event.preventDefault();
          resetZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('lightbox-close', handleCustomClose);
    window.addEventListener('popstate', handlePopState);
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent mobile bounce scrolling
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }

    if (openedFromModal && isMobile) {
      setTimeout(() => {
        if (isOpen) {
          window.history.pushState({ modalOpen: true, lightboxOpen: true }, "");
          historyPushedRef.current = true;
        }
      }, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('lightbox-close', handleCustomClose);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.height = 'unset';
      
      if (openedFromModal && isMobile && historyPushedRef.current) {
        historyPushedRef.current = false;
        if (window.history.state?.lightboxOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen, currentIndex, openedFromModal, isMobile, onClose, navigateNext, navigatePrevious]);

  const handleDownload = async () => {
    const currentImage = images[currentIndex];
    if (!currentImage) return;

    // Debug logging for production troubleshooting
    console.log('[ImageLightbox] Download started');
    console.log('[ImageLightbox] Image URL:', currentImage.url);
    console.log('[ImageLightbox] NEXT_PUBLIC_BE_URL:', process.env.NEXT_PUBLIC_BE_URL);
    console.log('[ImageLightbox] Token available:', !!AuthStorage.getAuthData()?.tokens?.access_token);

    const getFileExtension = () => {
      if (currentImage.filename) {
        const parts = currentImage.filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1] : '';
      }
      if (currentImage.contentType) {
        const mimeToExt: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/svg+xml': 'svg',
        };
        return mimeToExt[currentImage.contentType] || '';
      }
      const urlParts = currentImage.url.split('.');
      if (urlParts.length > 1) {
        const ext = urlParts[urlParts.length - 1].split('?')[0];
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext.toLowerCase())) {
          return ext.toLowerCase();
        }
      }
      return 'jpg';
    };

    const extension = getFileExtension();
    const baseFilename = currentImage.filename
      ? currentImage.filename.replace(/\.[^/.]+$/, '')
      : `image-${currentIndex + 1}`;
    const filename = extension ? `${baseFilename}.${extension}` : baseFilename;

    const backendUrl = getPublicBackendUrl() ?? process.env.NEXT_PUBLIC_BE_URL;
    const token = AuthStorage.getAccessToken();
    const isS3Url = ALLOWED_S3_PREFIXES.some((p) => currentImage.url.startsWith(p));
    const canUseProxy = Boolean(backendUrl && token && isS3Url);

    console.log('[ImageLightbox] canUseProxy:', canUseProxy, { backendUrl: !!backendUrl, token: !!token, isS3Url });

    const tryProxyDownload = async (): Promise<boolean> => {
      if (!backendUrl || !token || !isS3Url) {
        console.log('[ImageLightbox] Proxy download prerequisites not met:', { backendUrl: !!backendUrl, token: !!token, isS3Url });
        return false;
      }
      const proxyUrl = `${backendUrl}/api/v1/attachments/download?url=${encodeURIComponent(currentImage.url)}`;
      console.log('[ImageLightbox] Proxy URL:', proxyUrl);
      const response = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('[ImageLightbox] Proxy response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.log('[ImageLightbox] Proxy error response:', errorText);
        return false;
      }
      const blob = await response.blob();
      await downloadBlobAsFile(blob, filename);
      return true;
    };

    // In production, direct fetch to S3 often fails (CORS). Try proxy first for S3 URLs.
    if (canUseProxy) {
      try {
        console.log('[ImageLightbox] Attempting proxy download...');
        const ok = await tryProxyDownload();
        if (ok) {
          console.log('[ImageLightbox] Proxy download successful');
          return;
        }
      } catch (e) {
        console.log('[ImageLightbox] Proxy download failed:', e);
        // Fall through to other methods
      }
    }

    try {
      console.log('[ImageLightbox] Attempting direct S3 download...');
      const response = await fetch(currentImage.url, {
        mode: 'cors',
        credentials: 'omit',
      });
      if (response.ok) {
        const blob = await response.blob();
        await downloadBlobAsFile(blob, filename);
        console.log('[ImageLightbox] Direct S3 download successful');
        return;
      }
      console.log('[ImageLightbox] Direct S3 download failed:', response.status);
    } catch (e) {
      console.log('[ImageLightbox] Direct S3 download error:', e);
      // Direct fetch failed (e.g. CORS); try proxy if not yet tried
    }

    if (!canUseProxy) {
      try {
        console.log('[ImageLightbox] Attempting proxy download (second try)...');
        const ok = await tryProxyDownload();
        if (ok) {
          console.log('[ImageLightbox] Second proxy attempt successful');
          return;
        }
      } catch (e) {
        console.log('[ImageLightbox] Second proxy attempt failed:', e);
      }
    }

    try {
      console.log('[ImageLightbox] Attempting canvas download...');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = currentImage.url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise<Blob | null>((resolveBlob) => {
          canvas.toBlob(
            resolveBlob,
            `image/${extension === 'jpg' ? 'jpeg' : extension}`
          );
        });
        if (blob) {
          await downloadBlobAsFile(blob, filename);
          console.log('[ImageLightbox] Canvas download successful');
          return;
        }
      }
    } catch (e) {
      console.log('[ImageLightbox] Canvas download failed:', e);
    }

    try {
      console.log('[ImageLightbox] Attempting proxy download (final try)...');
      const ok = await tryProxyDownload();
      if (ok) {
        console.log('[ImageLightbox] Final proxy attempt successful');
        return;
      }
    } catch (e) {
      console.log('[ImageLightbox] Final proxy attempt failed:', e);
    }

    console.error('[ImageLightbox] All download methods failed');
    setShowDownloadErrorDialog(true);
  };

  if (!isOpen || !images.length || !mounted) return null;

  const currentImage = images[currentIndex];

  // Determine thumbnail position based on device and orientation
  const showThumbnailsOnSide = !isMobile || !isPortrait;
  const showThumbnailsOnBottom = isMobile && isPortrait;

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>, callback: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    callback();
  };

  const lightboxContent = (
    <div 
      className="lightbox-container fixed inset-0 z-[9999] bg-black bg-opacity-95 flex"
      aria-hidden={!isOpen}
      style={{ 
        height: '100dvh',
        width: '100vw',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Thumbnail sidebar for desktop and mobile landscape */}
      {showThumbnailsOnSide && images.length > 1 && (
        <div 
          className="w-20 md:w-32 bg-black/50 p-2 overflow-y-auto flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`w-full aspect-square rounded border-2 overflow-hidden transition-all ${
                  index === currentIndex
                    ? 'border-white ring-2 ring-white/50'
                    : 'border-white/30 hover:border-white/60'
                }`}
              >
                <img
                  src={image.url}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div 
        className="flex-1 flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Control buttons - positioned at bottom above thumbnails */}
        <div className={`absolute ${
          showThumbnailsOnBottom 
            ? 'bottom-24' // Above bottom thumbnails (which are now absolutely positioned)
            : 'bottom-4'  // At bottom when thumbnails are on side
        } right-4 flex gap-2 z-[100] pointer-events-auto`}>
          {/* Zoom controls */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => handleButtonClick(e, zoomOut)}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => handleButtonClick(e, zoomIn)}
            disabled={scale >= 5}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Reset zoom"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => handleButtonClick(e, resetZoom)}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Download"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => handleButtonClick(e, handleDownload)}
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => handleButtonClick(e, onClose)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Previous image"
              className={`absolute ${showThumbnailsOnSide ? 'left-24 md:left-36' : 'left-4'} top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 z-[100] pointer-events-auto`}
              onClick={(e) => handleButtonClick(e, navigatePrevious)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next image"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 z-[100] pointer-events-auto"
              onClick={(e) => handleButtonClick(e, navigateNext)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Main image container */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ 
            minHeight: 0 // Ensure flex child can shrink below content size
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleMouseDown(e);
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={(e) => {
            e.stopPropagation();
            handleWheel(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleTouchStart(e);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            ref={imageRef}
            src={currentImage.url}
            alt={currentImage.filename || `Image ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${animatedPosition.x / scale}px, ${animatedPosition.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
          />
        </div>

        {/* Bottom thumbnail strip for mobile portrait */}
        {showThumbnailsOnBottom && images.length > 1 && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-20 p-4 bg-black/50 flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2 overflow-x-auto justify-center w-full">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                  className={`flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex
                      ? 'border-white ring-2 ring-white/50'
                      : 'border-white/30 hover:border-white/60'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image info - positioned based on device */}
        <div 
          className={`absolute text-white text-left z-20 ${
            isMobile ? 'top-4 left-4' : showThumbnailsOnBottom ? 'top-4 left-1/2 -translate-x-1/2 text-center' : 'bottom-4 left-1/2 -translate-x-1/2 text-center'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-black/50 px-3 py-2 rounded-lg">
            <p className="text-sm font-medium">
              {currentImage.filename || `Image ${currentIndex + 1}`}
            </p>
            {images.length > 1 && (
              <p className="text-xs text-gray-300">
                {currentIndex + 1} of {images.length}
              </p>
            )}
            {scale !== 1 && (
              <p className="text-xs text-gray-300">
                Zoom: {Math.round(scale * 100)}%
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {createPortal(lightboxContent, document.body)}
      <Dialog
        open={showDownloadErrorDialog}
        onOpenChange={setShowDownloadErrorDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download failed</DialogTitle>
            <DialogDescription>
              The image could not be saved. Try again or open the image in a new
              tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDownloadErrorDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDownloadErrorDialog(false);
                if (currentImage?.url) window.open(currentImage.url, '_blank');
              }}
            >
              Open in new tab
            </Button>
            <Button
              onClick={() => {
                setShowDownloadErrorDialog(false);
                handleDownload();
              }}
            >
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
