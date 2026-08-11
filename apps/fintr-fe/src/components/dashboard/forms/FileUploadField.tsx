
import React, { useRef, useState, useEffect, useId, useCallback } from 'react';
import { Label } from '../../ui/label';
import { Camera, Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { isNativeCapacitor } from '@/lib/capacitor';
import { isReceiptImageFile } from '@/lib/receipt-image-preview';
import {
  createFileInputChangeEvent,
  pickDeviceImage,
} from '@/lib/pick-device-image';
import { toast } from 'sonner';

/** Fixed-height crop biased toward upper-center (typical receipt / e-wallet amount area). */
const RECEIPT_THUMB_FRAME_CLASS =
  "relative block h-[10.5rem] w-full overflow-hidden rounded-lg bg-muted/40 sm:h-48 "
  + "cursor-pointer transition-opacity hover:opacity-95 "
  + "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
  + "focus-visible:ring-offset-2";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface FileUploadFieldProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  label?: string;
}

function canOfferCameraCapture(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return isNativeCapacitor() || window.innerWidth < 768;
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({
  file,
  onFileChange,
  onRemoveFile,
  label = "Attach File (Optional)",
}) => {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [offersCameraCapture, setOffersCameraCapture] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);

  useEffect(() => {
    const updateCameraAvailability = () => {
      setOffersCameraCapture(canOfferCameraCapture());
    };

    updateCameraAvailability();
    window.addEventListener("resize", updateCameraAvailability);

    return () => {
      window.removeEventListener("resize", updateCameraAvailability);
    };
  }, []);

  const handleInternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (selectedFile) {
      applySelectedFile(selectedFile);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInternalRemoveFile = () => {
    onRemoveFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const applySelectedFile = useCallback((selectedFile: File) => {
    if (!isReceiptImageFile(selectedFile) && selectedFile.type !== "application/pdf") {
      toast.error("Please select a JPG, PNG, or PDF file");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File size must be less than 5MB");
      return;
    }

    onFileChange(createFileInputChangeEvent(selectedFile));
  }, [onFileChange]);

  const handleTakePhoto = useCallback(async () => {
    if (isOpeningCamera) {
      return;
    }

    setIsOpeningCamera(true);

    try {
      const selectedFile = await pickDeviceImage();

      if (!selectedFile) {
        return;
      }

      if (!isReceiptImageFile(selectedFile)) {
        toast.error("Please select an image file");
        return;
      }

      applySelectedFile(selectedFile);
    } finally {
      setIsOpeningCamera(false);
    }
  }, [applySelectedFile, isOpeningCamera]);

  const handleBrowseFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    if (file && file.type?.startsWith('image/')) {
      if ((file as any).isRemoteFile) {
        const remoteUrl = (file as any).url;
        setImageUrl(remoteUrl && typeof remoteUrl === 'string' ? remoteUrl : '');
      } else {
        try {
          const url = URL.createObjectURL(file);
          setImageUrl(url);
          return () => {
            URL.revokeObjectURL(url);
          };
        } catch (error) {
          console.error('Error creating object URL:', error);
          setImageUrl('');
        }
      }
    } else {
      setImageUrl('');
    }
  }, [file]);

  const handleImageClick = () => {
    if (file && file.type?.startsWith('image/') && imageUrl) {
      setLightboxOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {file && file.type?.startsWith('image/') ? (
        <div className="space-y-2">
          <div className="border border-gray-300 rounded-lg p-4">
            {imageUrl ? (
              <button
                type="button"
                className={RECEIPT_THUMB_FRAME_CLASS}
                onClick={handleImageClick}
                aria-label="View full receipt"
                title="Tap to view full image"
              >
                <img
                  src={imageUrl}
                  alt=""
                  className="pointer-events-none h-full w-full min-h-full min-w-full object-cover object-[50%_28%]"
                />
              </button>
            ) : (
              <div className="flex h-[10.5rem] w-full items-center justify-center rounded-lg bg-gray-50 sm:h-48">
                <p className="text-sm text-gray-500">Loading image...</p>
              </div>
            )}
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-sm text-teal-600 break-all">
                  Receipt attached: {file?.name}
                </p>
                {(file as any).isRemoteFile && <span className="text-xs text-gray-500">(From Draft)</span>}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInternalRemoveFile}
                className="shrink-0"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : offersCameraCapture ? (
        <div className="space-y-3 rounded-lg border-2 border-dashed border-gray-300 p-4 dark:border-border">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex h-24 flex-col items-center gap-2"
              onClick={handleTakePhoto}
              disabled={isOpeningCamera}
            >
              <Camera className="h-7 w-7" />
              <span>{isOpeningCamera ? "Opening camera..." : "Take Photo"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="flex h-24 flex-col items-center gap-2"
              onClick={handleBrowseFiles}
            >
              <Upload className="h-7 w-7" />
              <span>Browse Files</span>
            </Button>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-muted-foreground/80">
            Supports: JPG, PNG, PDF (Max 5MB)
          </p>

          {file && !file.type?.startsWith('image/') && (
            <p className="text-center text-sm text-teal-600">
              File selected: {file.name}
            </p>
          )}

          <input
            id={`file-upload-input-${inputId}`}
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf,image/*"
            onChange={handleInternalFileChange}
          />
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer transition-colors hover:bg-gray-50 dark:border-border dark:hover:bg-muted/50"
          onClick={handleBrowseFiles}
        >
          <div className="flex flex-col items-center">
            <Upload className="mb-1 h-8 w-8 text-gray-400 dark:text-muted-foreground" />
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              Drag & drop your file here or{" "}
              <span className="font-medium text-primary">browse files</span>
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-muted-foreground/80">
              Supports: JPG, PNG, PDF (Max 5MB)
            </p>
            {file && !file.type?.startsWith('image/') && (
              <p className="text-sm text-teal-600 mt-2">
                File selected: {file.name}
              </p>
            )}
          </div>
          <input
            id={`file-upload-input-${inputId}`}
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf,image/*"
            onChange={handleInternalFileChange}
          />
        </div>
      )}

      {file && file.type?.startsWith('image/') && imageUrl && (
        <ImageLightbox
          images={[{
            url: imageUrl,
            filename: file.name,
            contentType: file.type,
          }]}
          isOpen={lightboxOpen}
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default FileUploadField;
