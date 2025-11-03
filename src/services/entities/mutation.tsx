import { AxiosInstance, AxiosError } from 'axios';

export interface CreateEntityType {
  fullName: string;
  entityType: 'loan';
}

export const createEntity = async (
  api: AxiosInstance,
  entityData: CreateEntityType
) => {
  try {
    const response = await api.post('/entities', {
      full_name: entityData.fullName,
      entity_type: entityData.entityType
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error('Error creating entity:', error);
    throw new Error('Failed to create entity');
  }
};

export interface FetchEntitiesParams {
  entityType?: string;
  search?: string;
}

export const fetchEntities = async (
  api: AxiosInstance,
  params?: FetchEntitiesParams
) => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.entityType) {
      queryParams.append('entity_type', params.entityType);
    }
    if (params?.search) {
      queryParams.append('search', params.search);
    }
    
    const response = await api.get(`/entities?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error('Error fetching entities:', error);
    throw new Error('Failed to fetch entities');
  }
};

