"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Paperclip } from 'lucide-react';
import ImageLightbox from '@/components/ui/ImageLightbox';

interface ImageUploadInputProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
  maxSizeInMB?: number;
  variant?: 'default' | 'compact';
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function ImageUploadInput({
  images,
  onImagesChange,
  maxImages = 5,
  maxSizeInMB = 10,
  variant = 'default',
  label = 'Images (Optional)',
  description,
  disabled = false
}: ImageUploadInputProps) {
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Regenerate preview URLs when images change externally (e.g., from paste)
  useEffect(() => {
    // Clean up old URLs
    imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    
    // Create new preview URLs
    const newImageUrls = images.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(newImageUrls);

    // Cleanup function
    return () => {
      newImageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  // Function to add images programmatically (used for paste functionality)
  const addImages = (newFiles: File[]) => {
    // Validate file types and sizes
    const validFiles = newFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        return false;
      }
      if (file.size > maxSizeInMB * 1024 * 1024) {
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Check if adding these files would exceed the limit
    const newImages = [...images, ...validFiles].slice(0, maxImages);
    onImagesChange(newImages);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert('Please select only image files');
        return false;
      }
      if (file.size > maxSizeInMB * 1024 * 1024) {
        alert(`${file.name} is too large. Please select images under ${maxSizeInMB}MB.`);
        return false;
      }
      return true;
    });

    // Check if adding these files would exceed the limit
    if (images.length + validFiles.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Limit to maxImages total
    const newImages = [...images, ...validFiles].slice(0, maxImages);
    onImagesChange(newImages);

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Convert File objects to ImageData format for lightbox
  const lightboxImages = imagePreviewUrls.map((url, index) => ({
    url,
    filename: images[index]?.name,
    contentType: images[index]?.type,
    byteSize: images[index]?.size
  }));

  const defaultDescription = `PNG, JPG, GIF up to ${maxSizeInMB}MB each. Maximum ${maxImages} images. You can also paste images directly in the description field.`;

  if (variant === 'compact') {
    return (
      <>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Paperclip className="h-4 w-4" />
              Attach Images
            </label>
            <Input
              ref={fileInputRef}
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              disabled={disabled || images.length >= maxImages}
            />
            <span className="text-xs text-gray-500">
              Max {maxImages} images, {maxSizeInMB}MB each
            </span>
          </div>

          {/* Selected Images Preview */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => openLightbox(index)}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {images[index]?.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <ImageLightbox
          images={lightboxImages}
          isOpen={lightboxOpen}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              {description || 'Add images to help explain your issue'}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {defaultDescription}
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload-default"
              disabled={disabled || images.length >= maxImages}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('image-upload-default')?.click()}
              disabled={disabled || images.length >= maxImages}
            >
              Choose Images
            </Button>
          </div>
        </div>

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {imagePreviewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => openLightbox(index)}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {images[index]?.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ImageLightbox
        images={lightboxImages}
        isOpen={lightboxOpen}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
