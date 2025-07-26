
import React, { useRef } from 'react';
import { Label } from '../../ui/label';
import { Upload } from 'lucide-react';
import { Button } from '../../ui/button';

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

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {file && (file as any).isRemoteFile || file?.type?.startsWith('image/') ? (
        /* Image Preview */
        <div className="space-y-2">
          <div className="border border-gray-300 rounded-lg p-4">
            {(file as any).isRemoteFile ? (
              // Remote file (from API)
              <img 
                src={(file as any).url} 
                alt="Receipt preview" 
                className="w-full h-48 object-contain rounded-lg"
                onError={(e) => {
                  console.error("Failed to load image:", (file as any).url);
                  const target = e.target as HTMLImageElement;
                  target.onerror = null; // Prevent infinite error loop
                  target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xNC41IDJINmEyIDIgMCAwIDAtMiAydjE2YTIgMiAwIDAgMCAyIDJoMTJhMiAyIDAgMCAwIDItMlY3LjVMMTQuNSAyeiIvPjxwb2x5bGluZSBwb2ludHM9IjE0IDIgMTQgOCAyMCA4Ii8+PC9zdmc+";
                }}
              />
            ) : (
              // Local file
              <img 
                src={file ? URL.createObjectURL(file) : ""} // Handle null file case
                alt="Receipt preview" 
                className="w-full h-48 object-contain rounded-lg"
              />
            )}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-green-600">
                Receipt attached: {file?.name}
                {(file as any).isRemoteFile && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    From Receipt Upload
                  </span>
                )}
              </p>
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
            {file && !file.type?.startsWith('image/') && !(file as any).isRemoteFile && ( // Check if file exists and is not an image (already handled by preview)
              <p className="text-sm text-green-600 mt-2">
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
    </div>
  );
};

export default FileUploadField; 
