import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { deleteTransaction } from '@/services/transactions/mutation';
import { DeleteScopeEnum } from '@/constants/transactionConstants';
import { toast } from 'sonner';

interface DraftItem {
  id: string;
  amount: number | string;
  description?: string;
  categoryName?: string;
  accountName?: string;
  date?: string;
  files?: Array<{
    id: string;
    url: string;
    name: string;
    contentType: string;
  }>;
  scheduleType?: string;
  repeatInterval?: string;
  installmentPeriod?: number;
  type?: string;
}

interface DraftItemsProps {
  drafts: DraftItem[];
  onDraftSelect: (draft: DraftItem) => Promise<void>;
  onDraftsInvalidate: () => void;
}

const DraftItems: React.FC<DraftItemsProps> = ({ 
  drafts, 
  onDraftSelect, 
  onDraftsInvalidate 
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  const deleteDraftMutation = useMutation({
    mutationFn: (draftId: string) => deleteTransaction(api, { id: draftId, deleteScope: DeleteScopeEnum.THIS_ONLY }),
    onSuccess: () => {
      toast.success('Draft deleted successfully');
      onDraftsInvalidate();
    },
    onError: (error) => {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    },
  });

  const handleDeleteDraft = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation(); // Prevent triggering the draft selection
    deleteDraftMutation.mutate(draftId);
  };

  if (drafts.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No drafts available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <div
          key={draft.id}
          onClick={async () => await onDraftSelect(draft)}
          className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
        >
          {/* Receipt Thumbnail */}
          {draft.files && draft.files.length > 0 && (
            <div className="flex-shrink-0">
              <img
                src={draft.files[0].url}
                alt="Receipt"
                className="w-12 h-12 object-cover rounded-md border"
              />
            </div>
          )}
          
          {/* Draft Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                {typeof draft.amount === 'number' ? draft.amount.toFixed(2) : parseFloat(String(draft.amount || 0)).toFixed(2)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => handleDeleteDraft(e, draft.id)}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            
            {draft.description && (
              <div className="text-xs text-muted-foreground truncate">
                {draft.description}
              </div>
            )}
            <div className="flex flex-col md:hidden">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {draft.categoryName && (
                  <span>{draft.categoryName}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">

                {draft.accountName && (
                  <>
                    <span>{draft.accountName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {draft.date && (
                  <>
                    <span>{new Date(draft.date).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {draft.categoryName && (
                  <span>{draft.categoryName}</span>
                )}
                {draft.accountName && (
                  <>
                    <span>•</span>
                    <span>{draft.accountName}</span>
                  </>
                )}
                {draft.date && (
                  <>
                    <span>•</span>
                    <span>{new Date(draft.date).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DraftItems;
