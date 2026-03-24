import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosInstance, AxiosError } from "axios";
import { 
  createTransfer, 
  updateTransfer, 
  deleteTransfer,
  CreateTransferType,
  UpdateTransferType,
  DeleteTransferType 
} from "@/services/transactions/transfers/mutation";
import { ScheduleTypeEnum, UpdateScopeEnum, DeleteScopeEnum } from "@/constants/transactionConstants";

// Mock formDataWithFile utility
vi.mock("@/utils/formUtils", () => ({
  formDataWithFile: vi.fn((data: any) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value instanceof File ? value : String(value));
      }
    });
    return formData;
  }),
}));

describe("Transfer Mutations", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockApi = {
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as AxiosInstance;
  });

  describe("createTransfer", () => {
    const validTransferData: CreateTransferType = {
      amount: 1000,
      transactionCost: 50,
      fromAccountName: "Account1",
      toAccountName: "Account2",
      description: "Test transfer",
      date: "2026-03-24",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    };

    it("successfully creates a transfer without file", async () => {
      const mockResponse = { 
        data: { 
          id: "123", 
          ...validTransferData,
          createdAt: "2026-03-24T10:00:00Z",
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, validTransferData);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions/transfers",
        validTransferData
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("successfully creates a transfer with file", async () => {
      const file = new File(["test content"], "receipt.pdf", { type: "application/pdf" });
      const transferDataWithFile = { ...validTransferData, file };
      
      const mockResponse = { 
        data: { 
          id: "123", 
          ...validTransferData,
          fileAttached: true,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferDataWithFile);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions/transfers",
        expect.any(FormData),
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("successfully creates a recurring transfer", async () => {
      const recurringTransferData: CreateTransferType = {
        ...validTransferData,
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "weekly",
      };

      const mockResponse = { 
        data: { 
          id: "456", 
          ...recurringTransferData,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, recurringTransferData);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions/transfers",
        recurringTransferData
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("handles API validation errors", async () => {
      const errorData = {
        errors: {
          amount: ["Amount must be greater than 0"],
          fromAccountName: ["Account not found"],
        },
      };

      const axiosError = new AxiosError("Request failed");
      axiosError.response = { data: errorData } as any;

      (mockApi.post as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);

      await expect(createTransfer(mockApi, validTransferData)).rejects.toEqual(errorData);
    });

    it("handles network errors", async () => {
      const networkError = new AxiosError("Network Error");
      networkError.response = undefined;

      (mockApi.post as ReturnType<typeof vi.fn>).mockRejectedValue(networkError);

      await expect(createTransfer(mockApi, validTransferData)).rejects.toThrow("Failed to create transfer");
    });

    it("handles server errors (500)", async () => {
      const serverError = new AxiosError("Internal Server Error");
      serverError.response = { status: 500, data: { message: "Server error" } } as any;

      (mockApi.post as ReturnType<typeof vi.fn>).mockRejectedValue(serverError);

      await expect(createTransfer(mockApi, validTransferData)).rejects.toEqual({ message: "Server error" });
    });

    it("creates transfer with currency conversion", async () => {
      const transferWithConversion: CreateTransferType = {
        ...validTransferData,
        exchange_rate: 0.85,
        exchange_rate_source: "auto",
      };

      const mockResponse = { 
        data: { 
          id: "789", 
          ...transferWithConversion,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferWithConversion);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions/transfers",
        transferWithConversion
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("handles empty description gracefully", async () => {
      const transferWithoutDescription = {
        ...validTransferData,
        description: undefined,
      };

      const mockResponse = { 
        data: { 
          id: "999", 
          ...transferWithoutDescription,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferWithoutDescription);

      expect(mockApi.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
    });

    it("handles very large amounts", async () => {
      const transferWithLargeAmount = {
        ...validTransferData,
        amount: 999999999.99,
      };

      const mockResponse = { 
        data: { 
          id: "large", 
          ...transferWithLargeAmount,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferWithLargeAmount);

      expect(mockApi.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
    });

    it("handles zero transaction cost", async () => {
      const transferWithZeroCost = {
        ...validTransferData,
        transactionCost: 0,
      };

      const mockResponse = { 
        data: { 
          id: "zero-cost", 
          ...transferWithZeroCost,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferWithZeroCost);

      expect(mockApi.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("updateTransfer", () => {
    const validUpdateData: UpdateTransferType = {
      id: "123",
      amount: 2000,
      transactionCost: 100,
      fromAccountName: "Account1",
      toAccountName: "Account2",
      description: "Updated transfer",
      date: "2026-03-25",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    };

    it("successfully updates a transfer without file", async () => {
      const mockResponse = { 
        data: { 
          id: "123", 
          ...validUpdateData,
        } 
      };
      (mockApi.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await updateTransfer(mockApi, validUpdateData);

      expect(mockApi.put).toHaveBeenCalledWith(
        "/transactions/transfers/123",
        validUpdateData
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("successfully updates a transfer with file", async () => {
      const file = new File(["updated content"], "updated_receipt.pdf", { type: "application/pdf" });
      const updateDataWithFile = { ...validUpdateData, file };
      
      const mockResponse = { 
        data: { 
          id: "123", 
          ...validUpdateData,
          fileAttached: true,
        } 
      };
      (mockApi.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await updateTransfer(mockApi, updateDataWithFile);

      expect(mockApi.put).toHaveBeenCalledWith(
        "/transactions/transfers/123",
        expect.any(FormData),
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("handles API validation errors during update", async () => {
      const errorData = {
        errors: {
          toAccountName: ["Target account does not exist"],
        },
      };

      const axiosError = new AxiosError("Request failed");
      axiosError.response = { data: errorData } as any;

      (mockApi.put as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);

      await expect(updateTransfer(mockApi, validUpdateData)).rejects.toEqual(errorData);
    });

    it("handles 404 error when transfer not found", async () => {
      const notFoundError = new AxiosError("Not Found");
      notFoundError.response = { status: 404, data: { message: "Transfer not found" } } as any;

      (mockApi.put as ReturnType<typeof vi.fn>).mockRejectedValue(notFoundError);

      await expect(updateTransfer(mockApi, validUpdateData)).rejects.toEqual({ message: "Transfer not found" });
    });

    it("successfully updates with scope parameter", async () => {
      const updateWithScope = {
        ...validUpdateData,
        updateScope: UpdateScopeEnum.ALL,
      };

      const mockResponse = { 
        data: { 
          id: "123", 
          ...updateWithScope,
        } 
      };
      (mockApi.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await updateTransfer(mockApi, updateWithScope);

      expect(mockApi.put).toHaveBeenCalledWith(
        "/transactions/transfers/123",
        updateWithScope
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("deleteTransfer", () => {
    const validDeleteData: DeleteTransferType = {
      id: "123",
      deleteScope: DeleteScopeEnum.THIS,
    };

    it("successfully deletes a transfer", async () => {
      const mockResponse = { 
        data: { 
          success: true,
          message: "Transfer deleted successfully",
        } 
      };
      (mockApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await deleteTransfer(mockApi, validDeleteData);

      expect(mockApi.delete).toHaveBeenCalledWith(
        "/transactions/transfers/123",
        {
          data: {
            deleteScope: DeleteScopeEnum.THIS,
          },
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("successfully deletes with ALL scope for recurring transfers", async () => {
      const deleteAllData: DeleteTransferType = {
        id: "456",
        deleteScope: DeleteScopeEnum.ALL,
      };

      const mockResponse = { 
        data: { 
          success: true,
          message: "All recurring transfers deleted",
        } 
      };
      (mockApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await deleteTransfer(mockApi, deleteAllData);

      expect(mockApi.delete).toHaveBeenCalledWith(
        "/transactions/transfers/456",
        {
          data: {
            deleteScope: DeleteScopeEnum.ALL,
          },
        }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("handles 404 error when transfer not found", async () => {
      const notFoundError = new AxiosError("Not Found");
      notFoundError.response = { status: 404, data: { message: "Transfer not found" } } as any;

      (mockApi.delete as ReturnType<typeof vi.fn>).mockRejectedValue(notFoundError);

      await expect(deleteTransfer(mockApi, validDeleteData)).rejects.toEqual({ message: "Transfer not found" });
    });

    it("handles unauthorized deletion error", async () => {
      const unauthorizedError = new AxiosError("Unauthorized");
      unauthorizedError.response = { status: 403, data: { message: "Not authorized to delete this transfer" } } as any;

      (mockApi.delete as ReturnType<typeof vi.fn>).mockRejectedValue(unauthorizedError);

      await expect(deleteTransfer(mockApi, validDeleteData)).rejects.toEqual({ message: "Not authorized to delete this transfer" });
    });

    it("handles network errors during deletion", async () => {
      const networkError = new Error("Network Error");

      (mockApi.delete as ReturnType<typeof vi.fn>).mockRejectedValue(networkError);

      await expect(deleteTransfer(mockApi, validDeleteData)).rejects.toThrow("Failed to delete transfer");
    });
  });

  describe("Edge Cases and Crash Prevention", () => {
    it("handles malformed API responses gracefully", async () => {
      // When API returns null/undefined response, the code tries to access .data
      // which will throw an error - this is the current behavior
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(createTransfer(mockApi, {
        amount: 100,
        transactionCost: 0,
        fromAccountName: "Account1",
        toAccountName: "Account2",
        date: "2026-03-24",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      })).rejects.toThrow();
    });

    it("handles API errors without response data", async () => {
      const error = new AxiosError("Request failed");
      error.response = undefined;

      (mockApi.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(createTransfer(mockApi, {
        amount: 100,
        transactionCost: 0,
        fromAccountName: "Account1",
        toAccountName: "Account2",
        date: "2026-03-24",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      })).rejects.toThrow("Failed to create transfer");
    });

    it("handles concurrent transfer creations", async () => {
      const mockResponse = { 
        data: { 
          id: "concurrent", 
          amount: 100,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const transfers = [
        { amount: 100, transactionCost: 0, fromAccountName: "A1", toAccountName: "A2", date: "2026-03-24", scheduleType: ScheduleTypeEnum.ONE_TIME },
        { amount: 200, transactionCost: 0, fromAccountName: "A1", toAccountName: "A3", date: "2026-03-24", scheduleType: ScheduleTypeEnum.ONE_TIME },
        { amount: 300, transactionCost: 0, fromAccountName: "A2", toAccountName: "A3", date: "2026-03-24", scheduleType: ScheduleTypeEnum.ONE_TIME },
      ];

      const results = await Promise.all(transfers.map(t => createTransfer(mockApi, t)));

      expect(results).toHaveLength(3);
      expect(mockApi.post).toHaveBeenCalledTimes(3);
    });

    it("handles special characters in account names", async () => {
      const transferWithSpecialChars = {
        amount: 100,
        transactionCost: 0,
        fromAccountName: "Account <script>alert(1)</script>",
        toAccountName: "Account & more",
        date: "2026-03-24",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      };

      const mockResponse = { 
        data: { 
          id: "special", 
          ...transferWithSpecialChars,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, transferWithSpecialChars);

      expect(result).toEqual(mockResponse.data);
    });

    it("handles missing optional fields gracefully", async () => {
      const minimalTransfer = {
        amount: 100,
        transactionCost: 0,
        fromAccountName: "Account1",
        toAccountName: "Account2",
        date: "2026-03-24",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        description: undefined,
        repeatInterval: undefined,
        file: undefined,
        exchange_rate: undefined,
        exchange_rate_source: undefined,
      };

      const mockResponse = { 
        data: { 
          id: "minimal", 
          ...minimalTransfer,
        } 
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await createTransfer(mockApi, minimalTransfer);

      expect(result).toEqual(mockResponse.data);
    });
  });
});
