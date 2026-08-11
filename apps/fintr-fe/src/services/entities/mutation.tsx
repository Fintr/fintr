import { AxiosInstance, AxiosError } from 'axios';

export interface EntityRecord {
  id: string;
  fullName: string;
  entityType: 'loan' | 'transaction';
  photoUrl?: string | null;
}

export interface CreateEntityType {
  fullName: string;
  entityType: 'loan' | 'transaction';
  photo?: File | null;
}

export interface UpdateEntityType {
  id: string;
  fullName?: string;
  photo?: File | null;
  removePhoto?: boolean;
}

export const createEntity = async (
  api: AxiosInstance,
  entityData: CreateEntityType
) => {
  try {
    if (entityData.photo) {
      const formData = new FormData();
      formData.append('full_name', entityData.fullName);
      formData.append('entity_type', entityData.entityType);
      formData.append('photo', entityData.photo);

      const response = await api.post('/entities', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    const response = await api.post('/entities', {
      full_name: entityData.fullName,
      entity_type: entityData.entityType,
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

export const updateEntity = async (
  api: AxiosInstance,
  entityData: UpdateEntityType,
) => {
  try {
    if (entityData.photo || entityData.removePhoto) {
      const formData = new FormData();
      formData.append('id', entityData.id);

      if (entityData.fullName) {
        formData.append('full_name', entityData.fullName);
      }

      if (entityData.photo) {
        formData.append('photo', entityData.photo);
      }

      if (entityData.removePhoto) {
        formData.append('remove_photo', 'true');
      }

      const response = await api.patch(`/entities/${entityData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    const response = await api.patch(`/entities/${entityData.id}`, {
      id: entityData.id,
      full_name: entityData.fullName,
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error('Error updating entity:', error);
    throw new Error('Failed to update entity');
  }
};

export interface FetchEntitiesParams {
  entityType?: string;
  search?: string;
}

const mapEntity = (entity: {
  id: string;
  fullName?: string;
  full_name?: string;
  entityType?: string;
  entity_type?: string;
  photoUrl?: string | null;
  photo_url?: string | null;
}): EntityRecord => ({
  id: entity.id,
  fullName: entity.fullName || entity.full_name || '',
  entityType: (entity.entityType || entity.entity_type || 'loan') as 'loan' | 'transaction',
  photoUrl: entity.photoUrl ?? entity.photo_url ?? null,
});

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
    const data = response.data?.data;

    if (Array.isArray(data)) {
      return {
        ...response.data,
        data: data.map(mapEntity),
      };
    }

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

export interface EntityDetailTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  amountCurrency?: string;
  categoryName: string;
  subcategoryName?: string | null;
  accountName: string;
  entityName?: string | null;
  type: 'income' | 'expense';
}

export interface EntityDetailLoan {
  id: string;
  date: string;
  description: string | null;
  loanType: 'borrowed' | 'lent';
  status: string;
  entityName: string;
  accountName: string;
  principalAmount: number;
  outstandingBalance: number;
  currency: string;
}

export interface EntityDetailLoanPayment {
  id: string;
  date: string;
  notes?: string | null;
  currency: string;
  loanId: string;
  loanDescription?: string | null;
  accountName: string;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
}

export interface EntityIdentifier {
  id: string;
  label: string;
  scannedName: string;
}

export interface EntityDetail {
  entity: EntityRecord;
  transactions: EntityDetailTransaction[];
  loans: EntityDetailLoan[];
  loanPayments: EntityDetailLoanPayment[];
  identifiers: EntityIdentifier[];
}

const mapEntityDetailTransaction = (transaction: {
  id: string;
  date: string;
  description: string;
  amount: number;
  amountCurrency?: string;
  amount_currency?: string;
  categoryName?: string;
  category_name?: string;
  subcategoryName?: string | null;
  subcategory_name?: string | null;
  accountName?: string;
  account_name?: string;
  entityName?: string | null;
  entity_name?: string | null;
  type: string;
}): EntityDetailTransaction => ({
  id: transaction.id,
  date: transaction.date,
  description: transaction.description,
  amount: transaction.amount,
  amountCurrency: transaction.amountCurrency ?? transaction.amount_currency,
  categoryName: transaction.categoryName ?? transaction.category_name ?? '',
  subcategoryName: transaction.subcategoryName ?? transaction.subcategory_name ?? null,
  accountName: transaction.accountName ?? transaction.account_name ?? '',
  entityName: transaction.entityName ?? transaction.entity_name ?? null,
  type: transaction.type as 'income' | 'expense',
});

const mapEntityDetailLoan = (loan: {
  id: string;
  date: string;
  description: string | null;
  loanType?: string;
  loan_type?: string;
  status: string;
  entityName?: string;
  entity_name?: string;
  accountName?: string;
  account_name?: string;
  principalAmount?: number;
  principal_amount?: number;
  outstandingBalance?: number;
  outstanding_balance?: number;
  currency: string;
}): EntityDetailLoan => ({
  id: loan.id,
  date: loan.date,
  description: loan.description,
  loanType: (loan.loanType ?? loan.loan_type ?? 'borrowed') as 'borrowed' | 'lent',
  status: loan.status,
  entityName: loan.entityName ?? loan.entity_name ?? '',
  accountName: loan.accountName ?? loan.account_name ?? '',
  principalAmount: loan.principalAmount ?? loan.principal_amount ?? 0,
  outstandingBalance: loan.outstandingBalance ?? loan.outstanding_balance ?? 0,
  currency: loan.currency,
});

const mapEntityDetailLoanPayment = (payment: {
  id: string;
  date: string;
  notes?: string | null;
  currency: string;
  loanId?: string;
  loan_id?: string;
  loanDescription?: string | null;
  loan_description?: string | null;
  accountName?: string;
  account_name?: string;
  principalPayment?: number;
  principal_payment?: number;
  interestPayment?: number;
  interest_payment?: number;
  totalPayment?: number;
  total_payment?: number;
}): EntityDetailLoanPayment => ({
  id: payment.id,
  date: payment.date,
  notes: payment.notes ?? null,
  currency: payment.currency,
  loanId: payment.loanId ?? payment.loan_id ?? '',
  loanDescription: payment.loanDescription ?? payment.loan_description ?? null,
  accountName: payment.accountName ?? payment.account_name ?? '',
  principalPayment: payment.principalPayment ?? payment.principal_payment ?? 0,
  interestPayment: payment.interestPayment ?? payment.interest_payment ?? 0,
  totalPayment: payment.totalPayment ?? payment.total_payment ?? 0,
});

const mapEntityIdentifier = (identifier: {
  id: string;
  label?: string;
  scannedName?: string;
  scanned_name?: string;
}): EntityIdentifier => ({
  id: identifier.id,
  label: identifier.label ?? identifier.scannedName ?? identifier.scanned_name ?? '',
  scannedName: identifier.scannedName ?? identifier.scanned_name ?? '',
});

export const fetchEntityDetail = async (
  api: AxiosInstance,
  entityId: string,
): Promise<EntityDetail> => {
  try {
    const response = await api.get(`/entities/${entityId}`);
    const data = response.data?.data;

    return {
      entity: mapEntity(data.entity),
      transactions: (data.transactions ?? []).map(mapEntityDetailTransaction),
      loans: (data.loans ?? []).map(mapEntityDetailLoan),
      loanPayments: (data.loanPayments ?? data.loan_payments ?? []).map(
        mapEntityDetailLoanPayment,
      ),
      identifiers: (data.identifiers ?? []).map(mapEntityIdentifier),
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error("Error fetching entity detail:", error);
    throw new Error("Failed to fetch entity detail");
  }
};

export const createMerchantIdentifier = async (
  api: AxiosInstance,
  entityId: string,
  label: string,
) => {
  try {
    const response = await api.post(`/entities/${entityId}/identifiers`, {
      label,
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error("Error creating merchant identifier:", error);
    throw new Error("Failed to create identifier");
  }
};

export const deleteMerchantIdentifier = async (
  api: AxiosInstance,
  entityId: string,
  identifierId: string,
) => {
  try {
    const response = await api.delete(
      `/entities/${entityId}/identifiers/${identifierId}`,
    );
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error("Error deleting merchant identifier:", error);
    throw new Error("Failed to delete identifier");
  }
};

export type EntityPhotoCandidate = {
  thumbnailUrl: string;
  title: string;
  sourceUrl: string;
};

const mapPhotoCandidate = (candidate: {
  thumbnailUrl?: string;
  thumbnail_url?: string;
  title: string;
  sourceUrl?: string;
  source_url?: string;
}): EntityPhotoCandidate => ({
  thumbnailUrl: candidate.thumbnailUrl ?? candidate.thumbnail_url ?? "",
  title: candidate.title,
  sourceUrl: candidate.sourceUrl ?? candidate.source_url ?? "",
});

export const searchEntityPhotos = async (
  api: AxiosInstance,
  entityId: string,
  options?: {
    fullName?: string;
    prompt?: string;
  },
): Promise<{ data: { candidates: EntityPhotoCandidate[] } }> => {
  try {
    const response = await api.post(`/entities/${entityId}/search_photos`, {
      full_name: options?.fullName,
      prompt: options?.prompt,
    });
    const data = response.data?.data;
    const candidates = (data?.candidates ?? []).map(mapPhotoCandidate);

    return { data: { candidates } };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error("Error searching entity photos:", error);
    throw new Error("Failed to search entity photos");
  }
};

export type GenerateEntityPhotoResult = {
  entity: EntityRecord;
  photoSource: "search" | "generated";
};

export const generateEntityPhoto = async (
  api: AxiosInstance,
  entityId: string,
  options?: {
    fullName?: string;
    prompt?: string;
    imageUrl?: string;
    forceGenerate?: boolean;
  },
): Promise<{ data: GenerateEntityPhotoResult }> => {
  try {
    const response = await api.post(`/entities/${entityId}/generate_photo`, {
      full_name: options?.fullName,
      prompt: options?.prompt,
      image_url: options?.imageUrl,
      force_generate: options?.forceGenerate,
    });
    const data = response.data?.data;

    return {
      data: {
        entity: mapEntity(data?.entity ?? {}),
        photoSource: data?.photoSource ?? data?.photo_source ?? "generated",
      },
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error("Error generating entity photo:", error);
    throw new Error("Failed to generate entity photo");
  }
};
