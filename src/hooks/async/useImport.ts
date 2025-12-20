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
  const { spaceCode } = useGetSpaceCode(api!);

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
    refetchInterval: (data) => {
      // Poll for updates if import is processing
      const status = data?.data?.import?.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
  });

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
  const { spaceCode } = useGetSpaceCode(api!);

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

  // Debug: Log the parsed data
  React.useEffect(() => {
    console.log('Imports hook - Full data:', importsData);
    console.log('Imports hook - Parsed imports:', importsData?.data?.imports);
    console.log('Imports hook - Pagination:', importsData?.data?.pagination);
  }, [importsData]);

  // Handle both response structures: response.data.data.imports or response.data.imports
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
      // Get spaceId from API if not provided
      let effectiveSpaceId = spaceId;
      if (!effectiveSpaceId) {
        const userResponse = await api!.get('/auth/private');
        effectiveSpaceId = userResponse.data?.data?.spaceId;
      }
      return createImport({ api: api!, file, spaceId: effectiveSpaceId || '', importLocation, metadata });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      toast.success('Import started successfully');
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.error?.details?.error ||
        error?.response?.data?.error?.details?.errors?.base?.[0] ||
        'Failed to create import';
      toast.error(errorMessage);
    },
  });
};

export const useRevertImport = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => revertImport({ api: api!, importId }),
    onSuccess: (response, importId) => {
      queryClient.invalidateQueries({ queryKey: ['imports'] });
      queryClient.invalidateQueries({ queryKey: ['import', importId] });
      toast.success('Import reverted successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to revert import');
    },
  });
};

export const useUpdateImportRecord = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ importId, importRecordId, data }: { importId: string; importRecordId: string; data: any }) =>
      updateImportRecord({ api: api!, importId, importRecordId, data }),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['importRecords', variables.importId] });
      queryClient.invalidateQueries({ queryKey: ['import', variables.importId] });
      toast.success('Record updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to update record');
    },
  });
};

export const useImportSingleRecord = () => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ importId, importRecordId }: { importId: string; importRecordId: string }) =>
      importSingleRecord({ api: api!, importId, importRecordId }),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['importRecords', variables.importId] });
      queryClient.invalidateQueries({ queryKey: ['import', variables.importId] });
      toast.success('Record imported successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to import record');
    },
  });
};

export const useDownloadSampleTemplate = () => {
  const { api } = useAuthApi();

  return useMutation({
    mutationFn: () => downloadSampleTemplate(api!),
    onSuccess: () => {
      toast.success('Template downloaded successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to download template');
    },
  });
};

