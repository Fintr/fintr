"use client";

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface ImageData {
  url: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
}

interface ImageGalleryProps {
  images: ImageData[];
  title?: string;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function ImageGallery({
  images,
  title = 'Attachments',
  variant = 'default',
  className = ''
}: ImageGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const gridClasses = variant === 'compact' 
    ? 'grid grid-cols-2 md:grid-cols-3 gap-2'
    : 'grid grid-cols-2 md:grid-cols-3 gap-4';
    
  const imageClasses = variant === 'compact'
    ? 'w-full h-24 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity'
    : 'w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity';

  return (
    <>
      <div className={className}>
        {variant === 'default' && (
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {title} ({images.length})
          </h3>
        )}
        <div className={gridClasses}>
          {images.map((image, index) => (
            <div 
              key={index} 
              className="relative group cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              <img
                src={image.url}
                alt={image.filename || `Attachment ${index + 1}`}
                className={imageClasses}
              />
              <div 
                className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-${variant === 'compact' ? '1' : '2'} ${variant === 'compact' ? 'rounded-b' : 'rounded-b-lg'} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
              >
                {image.filename || `Image ${index + 1}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ImageLightbox
        images={images}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
