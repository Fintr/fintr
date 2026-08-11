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
import {
  isReceiptImageFile,
  prepareReceiptImagePreview,
} from '@/lib/receipt-image-preview';

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
  const imagePreviewUrlRef = useRef<string | null>(null);

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

  const revokeImagePreviewUrl = useCallback(() => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }, []);

  const loadImagePreview = useCallback(async (file: File) => {
    revokeImagePreviewUrl();
    setIsLoadingPreview(true);

    try {
      const preview = await prepareReceiptImagePreview(file);
      imagePreviewUrlRef.current = preview.previewUrl;
      setSelectedImage(preview.file);
      setImagePreview(preview.previewUrl);
    } catch (error) {
      console.error('Error preparing image preview:', error);
      toast.error('Error reading image file');
      setSelectedImage(null);
      setImagePreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [revokeImagePreviewUrl]);

  const clearSelectedImage = useCallback(() => {
    revokeImagePreviewUrl();
    isFileSelectionInProgressRef.current = false;
    (window as any).__fileSelectionInProgress = false;
    setSelectedImage(null);
    setImagePreview(null);
    setIsLoadingPreview(false);
    setFileSelectionInProgress(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [revokeImagePreviewUrl, setFileSelectionInProgress]);

  // Preserve selected image when dialog is open (important for mobile)
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      revokeImagePreviewUrl();
      setImagePreview(null);
      setFileSelectionInProgress(false);
      setIsLoadingPreview(false);
      stopCamera();
      (window as any).__fileSelectionInProgress = false;
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, stopCamera, setFileSelectionInProgress, revokeImagePreviewUrl]);

  useEffect(() => {
    return () => {
      revokeImagePreviewUrl();
    };
  }, [revokeImagePreviewUrl]);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (fileInputRef.current && (fileInputRef.current as any)._pickTimeout) {
      clearTimeout((fileInputRef.current as any)._pickTimeout);
      delete (fileInputRef.current as any)._pickTimeout;
    }
    
    if (file) {
      if (!isReceiptImageFile(file)) {
        toast.error('Please select an image file');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
        return;
      }
      
      setSelectedImage(file);
      await loadImagePreview(file);
      setTimeout(() => {
        setFileSelectionInProgress(false);
        (window as any).__fileSelectionInProgress = false;
      }, 100);
    } else {
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
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
            setSelectedImage(file);
            await loadImagePreview(file);
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
      
      input.onchange = async (e) => {
        clearTimeout(safetyTimeoutId);
        const file = (e.target as HTMLInputElement).files?.[0];
        
        if (file) {
          if (!isReceiptImageFile(file)) {
            toast.error('Please select an image file');
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
            return;
          }
          
          if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
            return;
          }
          
          setSelectedImage(file);
          await loadImagePreview(file);
          setTimeout(() => {
            isFileSelectionInProgressRef.current = false;
            setIsFileSelectionInProgress(false);
            (window as any).__fileSelectionInProgress = false;
          }, 100);
        } else {
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

      // Defer presenting the picker to the next frame(s) on iOS WebView so layout/safe-area
      // updates from the tap are not contending with UIImagePicker presentation (reduces App Hang).
      const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
      const isIosNative = typeof cap?.getPlatform === 'function' && cap.getPlatform() === 'ios';
      if (isIosNative) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            input.click();
          });
        });
      } else {
        input.click();
      }
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
    revokeImagePreviewUrl();
    setSelectedImage(null);
    setImagePreview(null);
    setFileSelectionInProgress(false);
    setIsLoadingPreview(false);
    stopCamera();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  }, [stopCamera, onClose, setFileSelectionInProgress, revokeImagePreviewUrl]);

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


  const previewFooter = !isCameraActive && selectedImage ? (
    <div className="grid grid-cols-3 gap-2">
      <Button
        variant="outline"
        onClick={handleCancel}
      >
        Cancel
      </Button>
      <Button
        variant="outline"
        onClick={clearSelectedImage}
        disabled={!canUploadReceipt}
      >
        Change
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isUploading || !hasTokensAvailable || !canUploadReceipt}
        className="bg-primary hover:bg-primary/80"
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <LoadingSpinner size="small" />
            <span>Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </>
        )}
      </Button>
    </div>
  ) : undefined;

  const tokenUsageBadge = isLoadingUsage ? (
    <div className="flex items-center justify-center text-sm text-muted-foreground">
      <span className="font-medium">Loading token usage...</span>
    </div>
  ) : aiUsage ? (
    <div className="flex items-center justify-center">
      <div className="flex w-fit flex-col items-center justify-between rounded-md border border-primary/50 bg-primary/5 p-2 text-sm text-primary">
        <span className={`font-medium ${!hasTokensAvailable ? 'text-destructive' : ''}`}>
          <strong>{aiUsage.remaining}</strong> tokens left
        </span>
        <span className="text-xs">{aiUsage.usagePeriod}</span>
      </div>
    </div>
  ) : null;

  return (
    <CustomDialog 
      isOpen={isOpen}
      onClose={handleDialogClose}
      title="Add Receipt"
      fullScreen
      footer={previewFooter}
    >
      <div className="flex min-h-0 flex-1 flex-col text-primary">
        {isCameraActive ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                variant="outline"
                onClick={stopCamera}
              >
                Cancel
              </Button>
              <Button
                onClick={capturePhoto}
                className="bg-primary hover:bg-primary/80"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
            </div>
          </div>
        ) : selectedImage ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 pb-3 pt-2">
              {tokenUsageBadge}
            </div>

            {!isLoadingDashboard && !canUploadReceipt && (
              <div className="mx-4 mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center">
                <p className="mb-1 text-sm font-medium text-destructive">Missing Required Setup</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {!hasAccounts && <p>• You need to create an account first</p>}
                  {!hasExpenseCategories && <p>• You need to create an expense category first</p>}
                </div>
              </div>
            )}

            <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 px-4 pb-4">
              {isLoadingPreview ? (
                <div className="text-center">
                  <Loader2 className="mx-auto mb-2 h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading image preview...</p>
                </div>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Receipt preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <FileImage className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Image selected</p>
                  <p className="text-xs text-muted-foreground">{selectedImage.name}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
            <div className="space-y-4 py-4">
              {tokenUsageBadge}

              <div data-tutorial-target="add-receipt-modal">
                {!isLoadingDashboard && !canUploadReceipt && (
                  <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center">
                    <p className="mb-1 text-sm font-medium text-destructive">Missing Required Setup</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {!hasAccounts && <p>• You need to create an account first</p>}
                      {!hasExpenseCategories && <p>• You need to create an expense category first</p>}
                    </div>
                  </div>
                )}
                {!hasTokensAvailable && (
                  <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center">
                    <p className="mb-1 text-sm font-medium text-destructive">No tokens available</p>
                    <p className="text-xs text-muted-foreground">
                      You've used all your AI tokens for this period. Please wait until the next billing cycle or contact support.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="flex h-24 flex-col items-center gap-2"
                    onClick={handleTakePhoto}
                    disabled={!hasTokensAvailable || !canUploadReceipt}
                    data-tutorial-target="take-photo"
                  >
                    <Camera className="h-8 w-8" />
                    <span>Take Photo</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex h-24 flex-col items-center gap-2"
                    onClick={handleFileUpload}
                    disabled={!hasTokensAvailable || !canUploadReceipt}
                    data-tutorial-target="upload-file"
                  >
                    <FileImage className="h-8 w-8" />
                    <span>Upload File</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </CustomDialog>
  );
};

export default AddReceiptDialog; 
