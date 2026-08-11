import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import {
  fetchImport,
  fetchImports,
  fetchImportRecords,
  fetchImportRecord,
  downloadSampleTemplate,
} from '@/services/imports/queries';
import {
  createImport,
  revertImport,
  updateImportRecord,
  importSingleRecord,
} from '@/services/imports/mutations';
import { toast } from 'sonner';

export const useImport = (importId?: string) => {
  const { api } = useAuthApi();
  const { spaceCode } = useGetSpaceCode(api!, true);
  const queryClient = useQueryClient();

  const {
    data: importData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['import', importId],
    queryFn: () => fetchImport({ api: api!, importId: importId! }),
    enabled: !!api && !!importId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.import?.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
  });

  React.useEffect(() => {
    const status = importData?.data?.import?.status;

    if (status !== 'completed') {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    if (spaceCode) {
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', 'shell', spaceCode],
      });
    }
  }, [importData?.data?.import?.status, queryClient, spaceCode]);

  return {
    import: importData?.data?.import,
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useImports = (spaceId?: string, status?: string, page: number = 1, perPage: number = 10) => {
  const { api } = useAuthApi();
  const { spaceCode } = useGetSpaceCode(api!, true);

  const {
    data: importsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['imports', spaceId, status, page, perPage],
    queryFn: async () => {
      const result = await fetchImports({ api: api!, spaceId: spaceId || '', status, page, perPage });
      console.log('Raw imports API response:', result);
      return result;
    },
    enabled: !!api,
  });

  React.useEffect(() => {
    console.log('Imports hook - Full data:', importsData);
    console.log('Imports hook - Parsed imports:', importsData?.data?.imports);
    console.log('Imports hook - Pagination:', importsData?.data?.pagination);
  }, [importsData]);

  const imports = importsData?.data?.imports || importsData?.imports || [];
  const pagination = importsData?.data?.pagination || importsData?.pagination;

  return {
    imports,
    pagination,
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useImportRecords = (importId: string, status?: 'failed' | 'success' | 'edited') => {
  const { api } = useAuthApi();

  const {
    data: recordsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['importRecords', importId, status],
    queryFn: () => fetchImportRecords({ api: api!, importId, status }),
    enabled: !!api && !!importId,
  });

  return {
    records: recordsData?.data?.importRecords || [],
    pagination: recordsData?.data?.pagination,
    isLoading,
    isError,
    error,
    refetch,
  };
};

export const useCreateImport = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, importLocation, metadata, spaceId }: { file: File; importLocation: 'onboarding' | 'settings'; metadata?: Record<string, any>; spaceId?: string }) => {
      try {
        let effectiveSpaceId = spaceId;
        if (!effectiveSpaceId) {
          const userResponse = await api!.get('/auth/private');
          effectiveSpaceId = userResponse.data?.data?.spaceId;
        }
        const response = await createImport({ api: api!, file, spaceId: effectiveSpaceId || '', importLocation, metadata });
        await queryClient.invalidateQueries({ queryKey: ['imports'] });
        toast.success('Import started successfully');
        return response;
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.error?.details?.error ||
          error?.response?.data?.error?.details?.errors?.base?.[0] ||
          'Failed to create import';
        toast.error(errorMessage);
        throw error;
      }
    },
  });
};

export const useRevertImport = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importId: string) => {
      try {
        const response = await revertImport({ api: api!, importId });
        await queryClient.invalidateQueries({ queryKey: ['imports'] });
        await queryClient.invalidateQueries({ queryKey: ['import', importId] });
        toast.success('Import reverted successfully');
        return response;
      } catch (error: any) {
        toast.error(error?.response?.data?.error?.message || 'Failed to revert import');
        throw error;
      }
    },
  });
};

export const useUpdateImportRecord = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importId, importRecordId, data }: { importId: string; importRecordId: string; data: any }) => {
      try {
        const response = await updateImportRecord({ api: api!, importId, importRecordId, data });
        await queryClient.invalidateQueries({ queryKey: ['importRecords', importId] });
        await queryClient.invalidateQueries({ queryKey: ['import', importId] });
        toast.success('Record updated successfully');
        return response;
      } catch (error: any) {
        toast.error(error?.response?.data?.error?.message || 'Failed to update record');
        throw error;
      }
    },
  });
};

export const useImportSingleRecord = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ importId, importRecordId }: { importId: string; importRecordId: string }) => {
      try {
        const response = await importSingleRecord({ api: api!, importId, importRecordId });
        await queryClient.invalidateQueries({ queryKey: ['importRecords', importId] });
        await queryClient.invalidateQueries({ queryKey: ['import', importId] });
        toast.success('Record imported successfully');
        return response;
      } catch (error: any) {
        toast.error(error?.response?.data?.error?.message || 'Failed to import record');
        throw error;
      }
    },
  });
};

export const useDownloadSampleTemplate = () => {
  const { api } = useAuthApi();

  return useMutation({
    mutationFn: async () => {
      try {
        const result = await downloadSampleTemplate(api!);
        toast.success('Template downloaded successfully');
        return result;
      } catch (error: any) {
        toast.error(error?.response?.data?.error?.message || 'Failed to download template');
        throw error;
      }
    },
  });
};
