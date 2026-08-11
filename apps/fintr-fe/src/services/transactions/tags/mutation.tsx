import { AxiosInstance, AxiosError } from "axios";
import {
  CreateTransactionTagType,
  TransactionTag,
  UpdateTransactionTagType,
} from "@/types/transactionTagTypes";

export const fetchTransactionTags = async (
  api: AxiosInstance,
): Promise<TransactionTag[]> => {
  const response = await api.get("/transactions/tags");
  const data = response.data?.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    isDefault: Boolean(tag.isDefault ?? tag.is_default),
    styleImageUrl: tag.styleImageUrl ?? tag.style_image_url ?? undefined,
  }));
};

export const createTransactionTag = async (
  api: AxiosInstance,
  tagData: CreateTransactionTagType,
) => {
  try {
    const response = await api.post("/transactions/tags", tagData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }

    console.error("Error creating transaction tag:", error);
    throw new Error("Failed to create tag");
  }
};

export const updateTransactionTag = async (
  api: AxiosInstance,
  tagId: string,
  updateData: UpdateTransactionTagType,
) => {
  try {
    const response = await api.put(`/transactions/tags/${tagId}`, updateData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }

    console.error("Error updating transaction tag:", error);
    throw new Error("Failed to update tag");
  }
};

export const deleteTransactionTag = async (
  api: AxiosInstance,
  tagId: string,
) => {
  try {
    const response = await api.delete(`/transactions/tags/${tagId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    return axiosError.response?.data;
  }
};

export const toggleDefaultTransactionTag = async (
  api: AxiosInstance,
  tagId: string,
): Promise<TransactionTag> => {
  try {
    const response = await api.put(`/transactions/tags/${tagId}/toggle_default`);
    const tag = response.data?.data;

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      isDefault: Boolean(tag.isDefault ?? tag.is_default),
      styleImageUrl: tag.styleImageUrl ?? tag.style_image_url ?? undefined,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }

    console.error("Error toggling default tag:", error);
    throw new Error("Failed to update default tag");
  }
};

export const generateTransactionTagStyleImage = async (
  api: AxiosInstance,
  tagId: string,
  prompt: string,
): Promise<TransactionTag> => {
  try {
    const response = await api.post(
      `/transactions/tags/${tagId}/generate_style_image`,
      { prompt },
    );
    const tag = response.data?.data;

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      isDefault: Boolean(tag.isDefault ?? tag.is_default),
      styleImageUrl: tag.styleImageUrl ?? tag.style_image_url ?? undefined,
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }

    console.error("Error generating tag style image:", error);
    throw new Error("Failed to generate tag style");
  }
};
