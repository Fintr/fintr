import { useCallback } from 'react';

interface UseImagePasteOptions {
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Maximum file size in MB for each image */
  maxSizeInMB?: number;
  /** Callback function when valid images are pasted */
  onImagesAdded?: (files: File[]) => void;
  /** Current number of images already selected */
  currentImageCount?: number;
  /** Whether to show success/error messages via alert() */
  showSuccessMessage?: boolean;
  /** Custom notification handler (overrides showSuccessMessage) */
  onNotification?: (message: string, type: 'success' | 'error' | 'warning') => void;
}

interface UseImagePasteReturn {
  /** Function to handle pasted image files */
  handleImagePaste: (pastedFiles: File[]) => void;
}

/**
 * Custom hook for handling image paste functionality in form textareas
 * 
 * @param options - Configuration options for image paste behavior
 * @returns Object containing the handleImagePaste function
 * 
 * @example
 * ```tsx
 * const { handleImagePaste } = useImagePaste({
 *   maxImages: 5,
 *   currentImageCount: selectedImages.length,
 *   onImagesAdded: (newFiles) => setSelectedImages(prev => [...prev, ...newFiles])
 * });
 * 
 * // Use with ExpandableTextarea
 * <ExpandableTextarea onImagePaste={handleImagePaste} />
 * ```
 */

export const useImagePaste = ({
  maxImages = 5,
  maxSizeInMB = 10,
  onImagesAdded,
  currentImageCount = 0,
  showSuccessMessage = true,
  onNotification
}: UseImagePasteOptions): UseImagePasteReturn => {
  
  const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (onNotification) {
      onNotification(message, type);
    } else if (showSuccessMessage) {
      alert(message);
    }
  };

  const handleImagePaste = useCallback((pastedFiles: File[]) => {
    // Validate pasted files
    const validFiles = pastedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        return false;
      }
      if (file.size > maxSizeInMB * 1024 * 1024) {
        notify(`Pasted image is too large. Please use images under ${maxSizeInMB}MB.`, 'error');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Check if adding these files would exceed the limit
    const newTotalImages = currentImageCount + validFiles.length;
    if (newTotalImages > maxImages) {
      const remainingSlots = maxImages - currentImageCount;
      if (remainingSlots > 0) {
        const filesToAdd = validFiles.slice(0, remainingSlots);
        onImagesAdded?.(filesToAdd);
        notify(`Only ${remainingSlots} image(s) could be added. Maximum ${maxImages} images allowed.`, 'warning');
      } else {
        notify(`Maximum ${maxImages} images already reached. Remove some images first.`, 'warning');
      }
      return;
    }

    // Add all valid files
    onImagesAdded?.(validFiles);
    
    // Show confirmation message
    if (validFiles.length === 1) {
      notify('Image pasted successfully!', 'success');
    } else {
      notify(`${validFiles.length} images pasted successfully!`, 'success');
    }
  }, [maxImages, maxSizeInMB, onImagesAdded, currentImageCount, showSuccessMessage, onNotification]);

  return { handleImagePaste };
};
