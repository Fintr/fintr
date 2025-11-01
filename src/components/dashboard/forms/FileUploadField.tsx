
import React, { useRef, useState, useEffect } from 'react';
import { Label } from '../../ui/label';
import { Upload } from 'lucide-react';
import { Button } from '../../ui/button';
import ImageLightbox from '@/components/crm/ImageLightbox';

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
              <img 
                src={imageUrl}
                alt="Receipt preview" 
                className="w-full h-48 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleImageClick}
                title="Click to view full size"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center bg-gray-50 rounded-lg">
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
            id="file-upload-input"
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
