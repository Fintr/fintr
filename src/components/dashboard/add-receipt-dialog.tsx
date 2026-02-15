import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AddReceiptDialog as CustomDialog } from '@/components/ui/add-receipt-dialog';
import { Button } from '@/components/ui/button';
import { Camera, FileImage, Loader2, Upload } from 'lucide-react';
import { uploadReceipt } from '@/services/receipts/mutation';
import { toast } from 'sonner';
import useAuthApi from '@/hooks/useAuthApi';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useAIUsage } from '@/hooks/async/useAIUsage';
import { useDashboardData } from '@/hooks/async/useDashboardData';

interface AddReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptSuccess?: (suggestedTransactionPayload: any, receiptImage: File, draftId?: string) => void;
}

// Global flag to prevent dialog close during file selection
// This is checked by the dialog wrapper's handlePopState
let globalFileSelectionInProgress = false;

const AddReceiptDialog: React.FC<AddReceiptDialogProps> = ({ isOpen, onClose, onReceiptSuccess }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFileSelectionInProgress, setIsFileSelectionInProgress] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isFileSelectionInProgressRef = useRef<boolean>(false);

  const { api } = useAuthApi({
    scope: "openid profile email read:users read:current_user read:ai_usage",
  });

  const { data: aiUsage, isLoading: isLoadingUsage, refetch: refetchAIUsage } = useAIUsage();
  const { data: dashboardData, isLoading: isLoadingDashboard } = useDashboardData();

  // Check if tokens are available
  const hasTokensAvailable = aiUsage ? aiUsage.remaining > 0 : false;

  // Check if space has accounts and expense categories
  const hasAccounts = dashboardData?.accountOptions && dashboardData.accountOptions.length > 0;
  const hasExpenseCategories = dashboardData?.expenseCategoryOptions && dashboardData.expenseCategoryOptions.length > 0;
  const canUploadReceipt = hasAccounts && hasExpenseCategories;

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  // Helper function to update file selection state (state, ref, and global flag)
  const setFileSelectionInProgress = useCallback((value: boolean) => {
    globalFileSelectionInProgress = value;
    isFileSelectionInProgressRef.current = value;
    setIsFileSelectionInProgress(value);
  }, []);

  // Preserve selected image when dialog is open (important for mobile)
  useEffect(() => {
    if (!isOpen) {
      // Only reset state when dialog is closed, not when it opens
      setSelectedImage(null);
      setImagePreview(null);
      setFileSelectionInProgress(false);
      setIsLoadingPreview(false);
      stopCamera();
      (window as any).__fileSelectionInProgress = false;
      // Clear file input when dialog closes
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, stopCamera, setFileSelectionInProgress]);

  // CRITICAL: Global popstate interceptor to prevent navigation during file selection
  useEffect(() => {
    if (!isOpen) return;
    
    const handlePopStateIntercept = (e: PopStateEvent) => {
      if ((window as any).__fileSelectionInProgress === true) {
        // Prevent ANY popstate handling during file selection
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Immediately restore history state
        window.history.pushState({ modalOpen: true, lightboxOpen: false, fileSelection: true }, "");
      }
    };
    
    // Add this listener at capture phase to intercept before other handlers
    window.addEventListener('popstate', handlePopStateIntercept, true);
    
    return () => {
      window.removeEventListener('popstate', handlePopStateIntercept, true);
    };
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // Clear any pending timeout from handleFileUpload
    if (fileInputRef.current && (fileInputRef.current as any)._pickTimeout) {
      clearTimeout((fileInputRef.current as any)._pickTimeout);
      delete (fileInputRef.current as any)._pickTimeout;
    }
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
        return;
      }
      
      // Validate file size (e.g., max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
        return;
      }
      
      // Store the file immediately to prevent loss on mobile
      setSelectedImage(file);
      
      // Create preview only for images
      if (file.type.startsWith('image/')) {
        setIsLoadingPreview(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
          setIsLoadingPreview(false);
          // Clear flag after successful load
          setTimeout(() => {
            setFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
          }, 100);
        };
        reader.onerror = () => {
          toast.error('Error reading image file');
          setSelectedImage(null);
          setImagePreview(null);
          setIsLoadingPreview(false);
          setFileSelectionInProgress(false);
          (window as any).__fileSelectionInProgress = false;
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
      }
    } else {
      // No file selected (user cancelled)
      setFileSelectionInProgress(false);
      (window as any).__fileSelectionInProgress = false;
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
      // CRITICAL: Set ALL flags FIRST, before any DOM manipulation
      (window as any).__fileSelectionInProgress = true;
      isFileSelectionInProgressRef.current = true;
      setIsFileSelectionInProgress(true);
      
      // On mobile, use the native camera via file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      // Safety timeout to clear flag if nothing happens (5 minutes)
      const safetyTimeoutId = setTimeout(() => {
        isFileSelectionInProgressRef.current = false;
        setIsFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
      }, 300000);
      
      input.onchange = (e) => {
        clearTimeout(safetyTimeoutId);
        const file = (e.target as HTMLInputElement).files?.[0];
        
        if (file) {
          // Validate file type
          if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
            return;
          }
          
          // Validate file size
          if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
            return;
          }
          
          // Store the file immediately
          setSelectedImage(file);
          
          // Create preview
          setIsLoadingPreview(true);
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
            setIsLoadingPreview(false);
            // Clear flag after successful load
            setTimeout(() => {
              isFileSelectionInProgressRef.current = false;
              setIsFileSelectionInProgress(false);
              (window as any).__fileSelectionInProgress = false;
            }, 100);
          };
          reader.onerror = () => {
            console.error('Error reading mobile camera file');
            toast.error('Error reading image file');
            setSelectedImage(null);
            setImagePreview(null);
            setIsLoadingPreview(false);
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
          };
          reader.readAsDataURL(file);
        } else {
          // User cancelled the file picker
          isFileSelectionInProgressRef.current = false;
          setIsFileSelectionInProgress(false);
          (window as any).__fileSelectionInProgress = false;
        }
      };
      
      // Handle cancellation
      input.oncancel = () => {
        clearTimeout(safetyTimeoutId);
        isFileSelectionInProgressRef.current = false;
        setIsFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
      };
      
      // Handle blur as fallback
      input.onblur = () => {
        setTimeout(() => {
          if (isFileSelectionInProgressRef.current && !selectedImage) {
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
          }
        }, 1000);
      };
      
      input.click();
    } else {
      // On desktop/laptop, use webcam
      startCamera();
    }
  };

  const handleFileUpload = () => {
    // Set flag BEFORE clicking to prevent dialog from closing while file picker is open
    setFileSelectionInProgress(true);
    (window as any).__fileSelectionInProgress = true;
    
    // Safety timeout to clear flag if no file is selected after 1 minute
    const timeoutId = setTimeout(() => {
      setFileSelectionInProgress(false);
      (window as any).__fileSelectionInProgress = false;
    }, 60000);
    
    // Store timeout so we can cancel it if file is selected
    (fileInputRef.current as any)._pickTimeout = timeoutId;
    
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      toast.error('Please select an image first');
      return;
    }
    
    setIsUploading(true);
    try {
      const response = await uploadReceipt(api, { image: selectedImage });
      const payload = response?.data ?? response;

      // Show processing time in development (backend sends processingTimeDisplay only in dev)
      if (payload?.processingTimeDisplay) {
        toast.success(`Processed in ${payload.processingTimeDisplay}`, {
          duration: 3000,
        });
      }

      // Refetch AI usage so "X tokens left" updates immediately
      refetchAIUsage();

      // Always navigate to Add Transaction dialog if onReceiptSuccess callback is provided
      if (onReceiptSuccess) {
        // Check if the response contains suggestedTransactionPayload
        if (payload?.suggestedTransactionPayload) {
          // Call the callback with the suggested data, receipt image, and draftId
          onReceiptSuccess(payload.suggestedTransactionPayload, selectedImage, payload.draftId);
        } else {
          // Even if there's no suggested payload, still open the transaction dialog with the receipt image
          // Call the callback with empty/default values, but include the receipt image and draftId
          onReceiptSuccess({}, selectedImage, payload?.draftId);
        }
        // Clear file input after successful upload
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        handleCancel();
      } else {
        // Fallback: if no callback is provided, just show success message
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        handleCancel();
      }
    } catch (error) {
      const err: any = error;
      const apiError = err?.error || err;
      const message: string = apiError?.message || 'Failed to upload receipt';
      const parseError: string | undefined = apiError?.details?.parseError;
      const rawResponse: string | undefined = apiError?.details?.rawResponse;

      // If OpenAI parsing failed, surface the raw model response for user clarity
      if (parseError === 'No valid JSON found in AI response' && rawResponse) {
        toast.error(`${message}: ${parseError}`, {
          description: rawResponse,
          className: '!text-red-900 [&_*]:!text-red-900',
          duration: 10000,
        });
      } else if (rawResponse) {
        // If backend supplied a rawResponse for other errors, include it
        toast.error(message, { 
          description: rawResponse,
          className: '!text-red-900 [&_*]:!text-red-900',
          duration: 10000,
        });
      } else if (apiError?.details?.message) {
        toast.error(message, { 
          description: apiError.details.message,
          className: '!text-red-900 [&_*]:!text-red-900',
          duration: 10000,
        });
      } else {
        toast.error(message + '. Please try again.', {
          className: '!text-red-900',
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = useCallback(() => {
    // Clear any pending timeout
    if (fileInputRef.current && (fileInputRef.current as any)._pickTimeout) {
      clearTimeout((fileInputRef.current as any)._pickTimeout);
      delete (fileInputRef.current as any)._pickTimeout;
    }
    
    // Force clear the flag immediately when user explicitly cancels
    isFileSelectionInProgressRef.current = false;
    (window as any).__fileSelectionInProgress = false;
    setSelectedImage(null);
    setImagePreview(null);
    setFileSelectionInProgress(false);
    setIsLoadingPreview(false);
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  }, [stopCamera, onClose, setFileSelectionInProgress]);

  // Wrap onClose to prevent closing during file selection or upload
  const handleDialogClose = useCallback(() => {
    // Prevent closing only if upload is in progress
    if (isUploading) {
      return;
    }
    
    // Prevent closing if file picker is currently active (but not if file is already selected)
    if (isFileSelectionInProgress && !selectedImage) {
      return;
    }
    
    handleCancel();
  }, [isFileSelectionInProgress, isUploading, handleCancel, selectedImage]);


  return (
    <CustomDialog 
      isOpen={isOpen}
      onClose={handleDialogClose}
      title="Add Receipt"
    >
      <div className="px-6 pb-6 space-y-4">
        {isLoadingUsage ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <span className="font-medium">Loading token usage...</span>
          </div>
        ) : aiUsage ? (
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center justify-between text-sm bg-primary/5 w-fit p-2 rounded-md border-primary/50 border text-primary">
              <span className={`font-medium ${!hasTokensAvailable ? 'text-destructive' : ''}`}>
                <strong>{aiUsage.remaining}</strong> tokens left
              </span>
              <span className="text-xs">{aiUsage.usagePeriod}</span>
            </div>
          </div>
        ) : null}
        
        <div className="space-y-4 text-primary">
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
              {!isLoadingDashboard && !canUploadReceipt && (
                <div className="text-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium mb-1">Missing Required Setup</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {!hasAccounts && <p>• You need to create an account first</p>}
                    {!hasExpenseCategories && <p>• You need to create an expense category first</p>}
                  </div>
                </div>
              )}
              {isLoadingPreview ? (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-2" />
                    <p className="text-sm text-gray-500">Loading image preview...</p>
                  </div>
                </div>
              ) : imagePreview ? (
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
                    <p className="text-sm text-gray-500">Image Selected</p>
                    <p className="text-xs text-gray-400">{selectedImage.name}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Initial Options */
            <div data-tutorial-target="add-receipt-modal">
              {!isLoadingDashboard && !canUploadReceipt && (
                <div className="text-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
                  <p className="text-sm text-destructive font-medium mb-1">Missing Required Setup</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {!hasAccounts && <p>• You need to create an account first</p>}
                    {!hasExpenseCategories && <p>• You need to create an expense category first</p>}
                  </div>
                </div>
              )}
              {!hasTokensAvailable && (
                <div className="text-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
                  <p className="text-sm text-destructive font-medium mb-1">No tokens available</p>
                  <p className="text-xs text-muted-foreground">
                    You've used all your AI tokens for this period. Please wait until the next billing cycle or contact support.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center gap-2"
                  onClick={handleTakePhoto}
                  disabled={!hasTokensAvailable || !canUploadReceipt}
                  data-tutorial-target="take-photo"
                >
                  <Camera className="h-8 w-8" />
                  <span>Take Photo</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center gap-2"
                  onClick={handleFileUpload}
                  disabled={!hasTokensAvailable || !canUploadReceipt}
                  data-tutorial-target="upload-file"
                >
                  <FileImage className="h-8 w-8" />
                  <span>Upload File</span>
                </Button>
              </div>
            </div>
          )}
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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
                      isFileSelectionInProgressRef.current = false;
                      (window as any).__fileSelectionInProgress = false;
                      setSelectedImage(null);
                      setImagePreview(null);
                      setIsLoadingPreview(false);
                      setFileSelectionInProgress(false);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={!canUploadReceipt}
                  >
                    Choose Different
                  </Button>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={isUploading || !hasTokensAvailable || !canUploadReceipt}
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
      </div>
    </CustomDialog>
  );
};

export default AddReceiptDialog; 
