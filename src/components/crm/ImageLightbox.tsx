"use client";

import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

export default function ImageLightbox({
  images,
  isOpen,
  initialIndex,
  onClose
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
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
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  useEffect(() => {
    resetZoom();
  }, [currentIndex]);

  useEffect(() => {
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

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Prevent mobile bounce scrolling
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
      document.body.style.height = 'unset';
    };
  }, [isOpen, currentIndex]);

  const navigateNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const navigatePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDownload = async () => {
    const currentImage = images[currentIndex];
    if (!currentImage) return;

    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentImage.filename || `image-${currentIndex + 1}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  if (!isOpen || !images.length) return null;

  const currentImage = images[currentIndex];

  // Determine thumbnail position based on device and orientation
  const showThumbnailsOnSide = !isMobile || !isPortrait;
  const showThumbnailsOnBottom = isMobile && isPortrait;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-95 flex" 
      style={{ 
        height: '100dvh',
        width: '100vw',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {/* Thumbnail sidebar for desktop and mobile landscape */}
      {showThumbnailsOnSide && images.length > 1 && (
        <div className="w-20 md:w-32 bg-black/50 p-2 overflow-y-auto flex-shrink-0">
          <div className="space-y-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
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
      <div className="flex-1 flex flex-col relative">
        {/* Control buttons - positioned at bottom above thumbnails */}
        <div className={`absolute ${
          showThumbnailsOnBottom 
            ? 'bottom-24' // Above bottom thumbnails (which are now absolutely positioned)
            : 'bottom-4'  // At bottom when thumbnails are on side
        } right-4 flex gap-2 z-20`}>
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={zoomIn}
            disabled={scale >= 5}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={resetZoom}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={handleDownload}
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 bg-black/30"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={`absolute ${showThumbnailsOnSide ? 'left-24 md:left-36' : 'left-4'} top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 z-10`}
              onClick={navigatePrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 z-10"
              onClick={navigateNext}
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            ref={imageRef}
            src={currentImage.url}
            alt={currentImage.filename || `Image ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain transition-transform duration-100 select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            draggable={false}
          />
        </div>

        {/* Bottom thumbnail strip for mobile portrait */}
        {showThumbnailsOnBottom && images.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-20 p-4 bg-black/50 flex items-center">
            <div className="flex gap-2 overflow-x-auto justify-center w-full">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
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
        <div className={`absolute text-white text-left z-20 ${
          isMobile ? 'top-4 left-4' : showThumbnailsOnBottom ? 'top-4 left-1/2 -translate-x-1/2 text-center' : 'bottom-4 left-1/2 -translate-x-1/2 text-center'
        }`}>
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

      {/* Click overlay to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}
