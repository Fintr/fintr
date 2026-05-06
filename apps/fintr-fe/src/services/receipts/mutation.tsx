import { AxiosInstance, AxiosError } from 'axios';

export interface UploadReceiptData {
  image: File;
}

export const uploadReceipt = async (api: AxiosInstance, data: UploadReceiptData) => {
  try {
    const formData = new FormData();
    formData.append('image', data.image);
    
    const response = await api.post('/receipts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error('Error uploading receipt:', error);
    throw new Error('Failed to upload receipt');
  }
}; 
