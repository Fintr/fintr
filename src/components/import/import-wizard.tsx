'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateImport, useDownloadSampleTemplate } from '@/hooks/async/useImport';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { useAuthApi } from '@/hooks/useAuthApi';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImportWizardProps {
  onImportComplete?: (importId: string) => void;
  context: 'onboarding' | 'settings';
  spaceId?: string;
}

type Step = 'ask' | 'template' | 'upload' | 'processing' | 'results';

export const ImportWizard: React.FC<ImportWizardProps> = ({
  onImportComplete,
  context,
  spaceId,
}) => {
  const { api } = useAuthApi();
  const createImportMutation = useCreateImport();
  const downloadTemplateMutation = useDownloadSampleTemplate();

  const [step, setStep] = useState<Step>('ask');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [wantsToImport, setWantsToImport] = useState<boolean | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSkip = () => {
    if (onImportComplete) {
      onImportComplete('');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplateMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to download template:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid Excel file (.xlsx)');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    try {
      const response = await createImportMutation.mutateAsync({
        file: selectedFile,
        importLocation: context,
      });

      if (response?.data?.import?.id) {
        setImportId(response.data.import.id);
        setStep('processing');
        // The useImport hook will poll automatically
        if (onImportComplete) {
          // Check status after a short delay
          setTimeout(() => {
            checkImportStatus(response.data.import.id);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      // Don't re-enable the button if we successfully created an import
      // Only re-enable if there was an actual error
      if (!importId) {
        setIsUploading(false);
      }
    }
  };

  const checkImportStatus = async (id: string) => {
    try {
      const response = await api!.get(`/imports/imports/${id}`);
      const status = response.data?.data?.import?.status;
      const errors = response.data?.data?.import?.errors;

      if (status === 'completed' || status === 'failed') {
        // Show error message if import failed
        if (status === 'failed' && errors && errors.length > 0) {
          const errorMessages = errors
            .map((error: any) => {
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

          if (errorMessages.length > 0) {
            const errorMessage = errorMessages[0] || 'Failed to upload the file';
            toast.error(errorMessage);
          } else {
            toast.error('Failed to upload the file');
          }
        }

        setStep('results');
        if (onImportComplete) {
          onImportComplete(id);
        }
      } else {
        // Continue checking
        setTimeout(() => checkImportStatus(id), 2000);
      }
    } catch (error) {
      console.error('Failed to check import status:', error);
      toast.error('Failed to check import status');
    }
  };

  const handleWantToImport = (wants: boolean) => {
    setWantsToImport(wants);
    if (wants) {
      setStep('template');
    } else {
      handleSkip();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Import Transactions</CardTitle>
        <CardDescription>
          Import your existing transactions from an Excel file
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'ask' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Would you like to import your existing transactions?
            </p>
            <div className="flex gap-4">
              <Button onClick={() => handleWantToImport(true)} className="flex-1">
                Yes, Import Data
              </Button>
              <Button onClick={() => handleWantToImport(false)} variant="outline" className="flex-1">
                Skip for Now
              </Button>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-4">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold mb-2">Download Sample Template</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Download our Excel template to see the required format for importing transactions.
                </p>
                <Button
                  onClick={handleDownloadTemplate}
                  disabled={downloadTemplateMutation.isLoading}
                  variant="outline"
                >
                  {downloadTemplateMutation.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setStep('upload')} className="flex-1">
                Continue to Upload
              </Button>
              <Button onClick={handleSkip} variant="outline">
                Skip
              </Button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium mb-2">
                    {selectedFile ? selectedFile.name : 'Select Excel file to upload'}
                  </p>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Choose File</span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading || createImportMutation.isLoading}
                className="flex-1"
              >
                {isUploading || createImportMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Upload & Import
                  </>
                )}
              </Button>
              <Button onClick={() => setStep('template')} variant="outline" disabled={isUploading}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <div>
              <h3 className="font-semibold mb-2">Processing Import</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we process your file...
              </p>
            </div>
          </div>
        )}

        {step === 'results' && importId && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import completed. Check the results below.
            </p>
            {onImportComplete && (
              <Button onClick={() => onImportComplete(importId)} className="w-full">
                View Results
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

