import { AxiosInstance } from 'axios';
import { downloadBlobAsFile } from '@/lib/download-blob';

export interface FetchImportParams {
  api: AxiosInstance;
  importId: string;
}

export interface FetchImportsParams {
  api: AxiosInstance;
  spaceId: string;
  page?: number;
  perPage?: number;
  status?: string;
}

export interface FetchImportRecordsParams {
  api: AxiosInstance;
  importId: string;
  status?: 'failed' | 'success' | 'edited';
  page?: number;
  perPage?: number;
}

export interface FetchImportRecordParams {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
}

/**
 * Fetches a single import with its details
 */
export const fetchImport = async ({ api, importId }: FetchImportParams) => {
  const response = await api.get(`/imports/imports/${importId}`);
  return response.data;
};

/**
 * Fetches a list of imports for a space
 */
export const fetchImports = async ({ api, spaceId, page = 1, perPage = 100, status }: FetchImportsParams) => {
  const params: Record<string, any> = { page, per_page: perPage };
  if (status) params.status = status;
  // spaceId is handled by backend via current_space from auth

  const response = await api.get('/imports/imports', { params });
  return response.data;
};

/**
 * Fetches import records for an import
 */
export const fetchImportRecords = async ({ api, importId, status, page = 1, perPage = 25 }: FetchImportRecordsParams) => {
  const params: Record<string, any> = { page, per_page: perPage };
  if (status) params.status = status;

  const response = await api.get(`/imports/imports/${importId}/import_records`, { params });
  return response.data;
};

/**
 * Fetches a single import record
 */
export const fetchImportRecord = async ({ api, importId, importRecordId }: FetchImportRecordParams) => {
  const response = await api.get(`/imports/imports/${importId}/import_records/${importRecordId}`);
  return response.data;
};

/**
 * Downloads the sample template Excel file
 */
export const downloadSampleTemplate = async (api: AxiosInstance) => {
  try {
    const response = await api.get('/imports/sample_template', {
      responseType: 'blob',
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors, we'll handle them
    });

    // If status is not 2xx, try to parse as JSON error
    if (response.status >= 400) {
      try {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error?.message || errorData.error || 'Failed to download template');
      } catch (parseError) {
        throw new Error(`Failed to download template: ${response.statusText}`);
      }
    }

    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
    await downloadBlobAsFile(blob, 'import_template.xlsx');
  } catch (error: any) {
    // If it's already an Error with a message, rethrow it
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Handle other error cases
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Failed to download template');
  }
};

