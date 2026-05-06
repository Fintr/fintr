
import React, { useRef, useState, useEffect, useId } from 'react';
import { Label } from '../../ui/label';
import { Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import ImageLightbox from '@/components/crm/ImageLightbox';

/** Fixed-height crop biased toward upper-center (typical receipt / e-wallet amount area). */
const RECEIPT_THUMB_FRAME_CLASS =
  "relative block h-28 w-full overflow-hidden rounded-lg bg-muted/40 sm:h-32 "
  + "cursor-pointer transition-opacity hover:opacity-95 "
  + "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
  + "focus-visible:ring-offset-2";

interface FileUploadFieldProps {
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  label?: string;
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

  const handleInternalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e);
    // Clear the input's value to allow re-uploading the same file or a new one
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInternalRemoveFile = () => {
    onRemoveFile();
    // Clear the input's value when the file is removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
        /* Image Preview */
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
              <div className="flex h-28 w-full items-center justify-center rounded-lg bg-gray-50 sm:h-32">
                <p className="text-sm text-gray-500">Loading image...</p>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center">
                <p className="text-sm text-teal-600">
                  Receipt attached: {file?.name}
                </p>
                {(file as any).isRemoteFile && <span className="text-xs text-gray-500 ml-2">(From Draft)</span>}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleInternalRemoveFile}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* File Upload Area */
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-1" />
            <p className="text-sm text-gray-500">Drag & drop your file here or <span className="text-primary font-medium">browse files</span></p>
            <p className="text-xs text-gray-400 mt-1">Supports: JPG, PNG, PDF (Max 5MB)</p>
            {file && !file.type?.startsWith('image/') && ( // Check if file exists and is not an image (already handled by preview)
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
            accept="image/jpeg,image/png,application/pdf"
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
