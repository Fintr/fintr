import { AxiosInstance, AxiosError } from "axios";
import { toast } from "sonner";

export interface UpdateFinancialFreedomDescriptionType {
  description: string;
}

export const updateFinancialFreedomDescription = async (
  api: AxiosInstance,
  data: UpdateFinancialFreedomDescriptionType
) => {
  try {
    const response = await api.put("/goals/description", data);
    toast.success("Definition Updated", {
      description: "Your financial freedom definition has been updated.",
    });
    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message || "Failed to update financial freedom definition.";
    toast.error("Update Failed", {
      description: errorMessage,
    });
    throw error;
  }
}; 
