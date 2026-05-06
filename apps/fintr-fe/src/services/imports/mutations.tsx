import { AxiosInstance } from 'axios';

export interface CreateImportParams {
  api: AxiosInstance;
  file: File;
  spaceId: string;
  importLocation: 'onboarding' | 'settings';
  metadata?: Record<string, any>;
}

export interface RevertImportParams {
  api: AxiosInstance;
  importId: string;
}

export interface UpdateImportRecordParams {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
  data: {
    date?: string;
    description?: string;
    amount?: number;
    type?: 'income' | 'expense';
    category?: string;
  };
}

export interface ImportSingleRecordParams {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
}

/**
 * Creates a new import by uploading an Excel file
 */
export const createImport = async ({ api, file, spaceId, importLocation, metadata }: CreateImportParams) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('import_location', importLocation);
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  // spaceId is handled by backend via current_space from auth

  const response = await api.post('/imports/imports', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Reverts an import by deleting all created records
 */
export const revertImport = async ({ api, importId }: RevertImportParams) => {
  const response = await api.post(`/imports/imports/${importId}/revert`);
  return response.data;
};

/**
 * Updates a failed import record with edited data
 */
export const updateImportRecord = async ({ api, importId, importRecordId, data }: UpdateImportRecordParams) => {
  const response = await api.patch(`/imports/imports/${importId}/import_records/${importRecordId}`, data);
  return response.data;
};

/**
 * Imports a single edited record
 */
export const importSingleRecord = async ({ api, importId, importRecordId }: ImportSingleRecordParams) => {
  const response = await api.post(`/imports/imports/${importId}/import_records/${importRecordId}/import`);
  return response.data;
};

