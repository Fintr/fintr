'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { resetData } from '@/services/auth/user/mutations';
import { useAuthApi } from '@/hooks/useAuthApi';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface ResetDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog component for resetting user data.
 * Requires user to type "destroy all data" to confirm the action.
 */
const ResetDataDialog = ({ isOpen, onClose }: ResetDataDialogProps) => {
  const router = useRouter();
  const { api } = useAuthApi();
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const CONFIRMATION_TEXT = 'destroy all data';
  const isConfirmValid = confirmText.toLowerCase() === CONFIRMATION_TEXT;

  /**
   * Handles the data reset process.
   * Makes API call and redirects user to onboarding on success.
   */
  const handleResetData = async () => {
    if (!isConfirmValid) return;
    
    setIsLoading(true);
    try {
      await resetData({ api });
      toast.success('Data reset successfully. Redirecting to onboarding...');
      onClose();
      router.push('/onboarding/step1');
    } catch (error) {
      toast.error(`Failed to reset data: ${(error as Error).message}`);
      console.error('Failed to reset data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles dialog close and resets form state.
   */
  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-900" />
            </div>
            <div>
              <DialogTitle className="text-red-900">Reset All Data</DialogTitle>
              <DialogDescription className="text-red-900">
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-red-100/50 p-4">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This will permanently delete all your financial data, 
              transactions, accounts, budgets, and goals. You will be redirected to the 
              account setup page to start fresh.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-medium">
              Type <span className="font-mono font-bold">"{CONFIRMATION_TEXT}"</span> to confirm:
            </Label>
            <Input
              id="confirm-text"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type confirmation text here"
              className="font-mono"
              aria-label="Confirmation text input"
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Cancel reset"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleResetData}
            disabled={!isConfirmValid || isLoading}
            aria-label="Confirm reset data"
          >
            {isLoading ? 'Resetting...' : 'Reset Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResetDataDialog;
