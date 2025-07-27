import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, FileImage, Loader2, Upload, X } from 'lucide-react';
import { uploadReceipt } from '@/services/receipts/mutation';
import { toast } from 'sonner';
import useAuthApi from '@/hooks/useAuthApi';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface AddReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptSuccess?: (suggestedTransactionPayload: any, receiptImage: File) => void;
}

const AddReceiptDialog: React.FC<AddReceiptDialogProps> = ({ isOpen, onClose, onReceiptSuccess }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { api } = useAuthApi({
    scope: "openid profile email read:users read:current_user",
  });

  // Check if device is mobile
  const isMobile = typeof window !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.error('Please select an image or PDF file');
        return;
      }
      
      // Validate file size (e.g., max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setSelectedImage(file);
      
      // Create preview only for images, not PDFs
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null); // No preview for PDFs
      }
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      
      // Check if navigator.mediaDevices is available
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Camera access not available');
      }
      
      // Request camera access
      const constraints = {
        video: {
          facingMode: isMobile ? 'environment' : 'user', // Back camera on mobile, front camera on desktop
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions or use file upload instead.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            // Create a File object from the blob
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
            setSelectedImage(file);
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
              setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
            
            // Stop camera
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleTakePhoto = () => {
    if (isMobile) {
      // On mobile, try to use the native camera first
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleFileSelect({ target: { files: [file] } } as any);
        }
      };
      input.click();
    } else {
      // On desktop/laptop, use webcam
      startCamera();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;
    
    setIsUploading(true);
    try {
      const response = await uploadReceipt(api, { image: selectedImage });
      
      // Check if the response contains suggestedTransactionPayload
      if (response?.data?.suggestedTransactionPayload && onReceiptSuccess) {
        toast.success('Receipt processed successfully! Opening expense form...');
        
        // Call the callback with the suggested data and receipt image
        onReceiptSuccess(response.data.suggestedTransactionPayload, selectedImage);
        handleCancel();
      } else {
        // TEMPORARY: Always test the file transfer even on success
        if (onReceiptSuccess && selectedImage) {
          const mockSuggestedTransactionPayload = {
            amount: 1000,
            date: new Date().toISOString().split('T')[0],
            categoryName: "Test Category",
            accountName: "Test Account", 
            description: "Test receipt transfer - success path",
            scheduleType: "one_time"
          };
          
          toast.success('Testing file transfer (success path) - Opening expense form...');
          onReceiptSuccess(mockSuggestedTransactionPayload, selectedImage);
          handleCancel();
          return;
        }
        
        toast.success('Receipt uploaded successfully!');
        handleCancel();
      }
    } catch (error) {
      console.error('❌ AddReceiptDialog - Upload error:', error);
      // TEMPORARY TEST: Even on error, let's test the file transfer with mock data
      if (onReceiptSuccess && selectedImage) {
        const mockSuggestedTransactionPayload = {
          amount: 1000,
          date: new Date().toISOString().split('T')[0],
          categoryName: "Test Category",
          accountName: "Test Account", 
          description: "Test receipt transfer - error path",
          scheduleType: "one_time"
        };
        
        toast.success('Testing file transfer (error path) - Opening expense form...');
        onReceiptSuccess(mockSuggestedTransactionPayload, selectedImage);
        handleCancel();
        return;
      }
      
      toast.error('Failed to upload receipt. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedImage(null);
    setImagePreview(null);
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Receipt</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isCameraActive ? (
            /* Camera View */
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover bg-gray-100 rounded-lg"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={stopCamera}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={capturePhoto}
                  className="flex-1 bg-primary hover:bg-primary/80"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
              </div>
            </div>
          ) : selectedImage ? (
            /* Image Preview */
            <div className="space-y-4">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full h-64 object-cover bg-gray-100 rounded-lg"
                  />
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">PDF Selected</p>
                    <p className="text-xs text-gray-400">{selectedImage.name}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Initial Options */
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center gap-2"
                onClick={handleTakePhoto}
              >
                <Camera className="h-8 w-8" />
                <span>Take Photo</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center gap-2"
                onClick={handleFileUpload}
              >
                <FileImage className="h-8 w-8" />
                <span>Upload File</span>
              </Button>
            </div>
          )}
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Action Buttons */}
          {!isCameraActive && (
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              
              {selectedImage && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    Choose Different
                  </Button>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={isUploading}
                    className="bg-primary hover:bg-primary/80"
                  >
                    {isUploading ? (
                      <div className="flex items-center gap-2">
                        <LoadingSpinner size="small" />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Receipt
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddReceiptDialog; 
