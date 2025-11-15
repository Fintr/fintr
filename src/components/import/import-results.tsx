'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useImport, useRevertImport, useImportRecords } from '@/hooks/async/useImport';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, Loader2, Edit, Calendar, Tag, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { ImportRecordEditor } from './import-record-editor';
import { formatCurrency } from '@/lib/utils';

interface ImportResultsProps {
  importId: string;
  onRevert?: () => void;
}

export const ImportResults: React.FC<ImportResultsProps> = ({ importId, onRevert }) => {
  const { import: importData, isLoading, refetch } = useImport(importId);
  const { records: failedRecords, refetch: refetchRecords } = useImportRecords(importId, 'failed');
  const revertMutation = useRevertImport();
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Loading import results...</p>
      </div>
    );
  }

  if (!importData) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Import not found</p>
      </div>
    );
  }

  const handleRevertClick = () => {
    // Prevent opening dialog if revert is already in progress
    if (revertMutation.isLoading || isReverting) {
      return;
    }
    setIsRevertDialogOpen(true);
    setIsReverting(false); // Reset state when opening dialog
  };

  const handleRevertConfirm = async () => {
    // Prevent double submission
    if (revertMutation.isLoading || isReverting) {
      return;
    }

    // Set loading state immediately
    setIsReverting(true);

    try {
      await revertMutation.mutateAsync(importId);
      setIsRevertDialogOpen(false);
      setIsReverting(false);
      if (onRevert) {
        onRevert();
      }
    } catch (error) {
      console.error('Failed to revert import:', error);
      setIsReverting(false);
      // Keep dialog open on error so user can retry
    }
  };

  const handleRevertCancel = () => {
    // Prevent closing during revert operation
    if (revertMutation.isLoading || isReverting) {
      return;
    }
    setIsRevertDialogOpen(false);
    setIsReverting(false);
  };

  const handleRecordImported = () => {
    refetch();
    refetchRecords();
    setEditingRecordId(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Results</CardTitle>
          <CardDescription>
            Import completed on {new Date(importData.createdAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{importData.totalRowsRead}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-teal-50">
              <div className="text-2xl font-bold text-teal-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {importData.totalRowsInserted}
              </div>
              <div className="text-sm text-muted-foreground">Successfully Imported</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-900 flex items-center justify-center gap-2">
                <XCircle className="h-5 w-5" />
                {importData.totalRowsFailed}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm font-semibold ${
              importData.status === 'completed' ? 'text-teal-600' :
              importData.status === 'failed' ? 'text-red-900' :
              'text-yellow-600'
            }`}>
              {importData.status.charAt(0).toUpperCase() + importData.status.slice(1)}
            </span>
          </div>

          {/* Overall Import Errors */}
          {importData.status === 'failed' && importData.errors && importData.errors.length > 0 && (() => {
            // Extract only general/import-level error messages (not record-specific errors)
            // Record-specific errors (with row_number) should not be shown here
            // They are shown in the "Failed Records" section below
            const generalErrors: string[] = [];
            
            importData.errors.forEach((error: any) => {
              // Skip record-specific errors (those with row_number)
              if (error && typeof error === 'object' && error.row_number) {
                return; // Skip individual record errors
              }
              
              if (typeof error === 'string') {
                const trimmed = error.trim();
                if (trimmed.length > 0) {
                  generalErrors.push(trimmed);
                }
              } else if (error && typeof error === 'object') {
                // Only include general errors (no row_number)
                if (error.error) {
                  const trimmed = String(error.error).trim();
                  if (trimmed.length > 0) {
                    generalErrors.push(trimmed);
                  }
                } else if (error.message) {
                  const trimmed = String(error.message).trim();
                  if (trimmed.length > 0) {
                    generalErrors.push(trimmed);
                  }
                }
              }
            });

            // If there are failed records but no general errors, show a summary message
            const hasFailedRecords = importData.totalRowsFailed > 0;
            const hasGeneralErrors = generalErrors.length > 0;

            if (!hasGeneralErrors && !hasFailedRecords) {
              return null;
            }

            return (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-900 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-900 mb-2">Import Failed</div>
                    {hasGeneralErrors ? (
                      <div className="space-y-1">
                        {generalErrors.map((errorMessage: string, idx: number) => (
                          <div key={idx} className="text-sm text-red-900">
                            • {errorMessage}
                          </div>
                        ))}
                      </div>
                    ) : hasFailedRecords ? (
                      <div className="text-sm text-red-900">
                        Some records failed to import. Please review the failed records below and edit them individually.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          {importData.canRevert && (
            <div className="flex gap-2">
              <Button
                onClick={handleRevertClick}
                variant="outline"
                disabled={revertMutation.isLoading}
              >
                {revertMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Revert Import
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revert Confirmation Dialog */}
      <Dialog 
        open={isRevertDialogOpen} 
        onOpenChange={(open) => {
          // Prevent closing dialog during revert operation
          if (!open && (revertMutation.isLoading || isReverting)) {
            return;
          }
          if (!open) {
            setIsReverting(false);
          }
          setIsRevertDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Revert Import
            </DialogTitle>
            <DialogDescription className="text-left">
              Are you sure you want to revert this import? This action will delete all imported transactions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                This action cannot be undone. All imported transactions from this import will be{" "}
                <span className="text-red-900 font-medium">permanently removed</span>.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleRevertCancel} 
              disabled={revertMutation.isLoading || isReverting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevertConfirm}
              variant="destructive"
              disabled={revertMutation.isLoading || isReverting}
            >
              {(revertMutation.isLoading || isReverting) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reverting...
                </>
              ) : (
                'Revert Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failed Records */}
      {failedRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-900" />
              Failed Records ({failedRecords.length})
            </CardTitle>
            <CardDescription>
              Edit and re-import failed records individually
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedRecords.map((record: any) => (
                <div key={record.id}>
                  {editingRecordId === record.id ? (
                    <div className="border rounded-lg p-4">
                      <ImportRecordEditor
                        importId={importId}
                        importRecordId={record.id}
                        initialData={record.importData || record.originalData}
                        errors={record.errors || []}
                        onCancel={() => setEditingRecordId(null)}
                        onImported={handleRecordImported}
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between p-3">
                        {/* Color indicator - red for failed */}
                        <div className="w-1 h-16 rounded mr-3 flex-shrink-0 bg-red-900" />
                        
                        {/* Main content - structured like transaction record */}
                        <div className="flex-1 min-w-0">
                          {/* Top row: Description and Amount */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-primary truncate" title={record.importData?.description || record.originalData?.description || 'No description'}>
                                {record.importData?.description || record.originalData?.description || 'No description'}
                              </h4>
                              {/* Error indicator badge */}
                              {record.errors && record.errors.length > 0 && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-900 flex-shrink-0" title={`${record.errors.length} error${record.errors.length > 1 ? 's' : ''}`}>
                                  <AlertTriangle className="h-3 w-3" />
                                  <span className="hidden sm:inline">{record.errors.length} Error{record.errors.length > 1 ? 's' : ''}</span>
                                </span>
                              )}
                            </div>
                            
                            {/* Amount and type badge */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {((record.importData?.amount != null) || (record.originalData?.amount != null)) && (
                                <div className={`font-semibold text-sm ${
                                  (record.importData?.type || record.originalData?.type) === 'income'
                                    ? 'text-teal-600'
                                    : 'text-red-900'
                                }`}>
                                  {formatCurrency((record.importData?.amount ?? record.originalData?.amount) ?? 0)}
                                </div>
                              )}
                              {(record.importData?.type || record.originalData?.type) && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 flex items-center gap-1 ${
                                  (record.importData?.type || record.originalData?.type) === 'income'
                                    ? 'bg-teal-100/50 text-teal-600'
                                    : 'bg-red-100/50 text-red-900'
                                }`}>
                                  {(record.importData?.type || record.originalData?.type) === 'income' && <ArrowUpRight className="h-3 w-3" />}
                                  {(record.importData?.type || record.originalData?.type) === 'expense' && <ArrowDownLeft className="h-3 w-3" />}
                                  <span className="hidden md:inline capitalize">{record.importData?.type || record.originalData?.type}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Bottom row: Date, Category, Row Number */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              {(record.importData?.date || record.originalData?.date) && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 flex-shrink-0" />
                                  {new Date(record.importData?.date || record.originalData?.date).toLocaleDateString()}
                                </span>
                              )}
                              {(record.importData?.category || record.originalData?.category) && (
                                <span className="flex items-center gap-1 truncate" title={record.importData?.category || record.originalData?.category}>
                                  <Tag className="h-3 w-3 flex-shrink-0" />
                                  <span className="hidden md:block truncate">{record.importData?.category || record.originalData?.category}</span>
                                  <span className="md:hidden truncate max-w-[100px]">{record.importData?.category || record.originalData?.category}</span>
                                </span>
                              )}
                              <span className="text-muted-foreground">Row {record.rowNumber}</span>
                            </div>
                            
                            {/* Edit button */}
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                onClick={() => setEditingRecordId(record.id)}
                                variant="outline"
                                size="sm"
                                className="h-7 px-3"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            </div>
                          </div>
                          
                          {/* Error messages - displayed prominently below the record details */}
                          {record.errors && record.errors.length > 0 && (() => {
                            // Filter out null/undefined/empty error messages
                            const validErrors = record.errors
                              .map((error: any) => {
                                // Handle different error formats
                                if (typeof error === 'string') {
                                  return error.trim();
                                } else if (error?.error) {
                                  return String(error.error).trim();
                                } else if (error?.message) {
                                  return String(error.message).trim();
                                } else if (error) {
                                  return String(error).trim();
                                }
                                return '';
                              })
                              .filter((msg: string) => msg.length > 0);

                            // Only show if there are valid error messages
                            if (validErrors.length === 0) {
                              return null;
                            }

                            return (
                              <div className="mt-3 pt-3 border-t border-red-200 bg-red-50 rounded p-2">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-900 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-red-900 mb-1">Why this record failed:</div>
                                    <div className="space-y-1">
                                      {validErrors.map((errorMessage: string, idx: number) => (
                                        <div key={idx} className="text-xs text-red-900">
                                          • {errorMessage}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};





