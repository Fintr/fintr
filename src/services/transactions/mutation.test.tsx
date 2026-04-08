import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import {
  createTransaction,
  updateTransaction,
  type CreateTransactionType,
  type UpdateTransactionType,
} from "@/services/transactions/mutation";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";

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
  isUploadableFile: vi.fn((value: unknown) => value instanceof File || value instanceof Blob),
}));

describe("Transaction Mutations", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    mockApi = {
      post: vi.fn(),
      put: vi.fn(),
    } as unknown as AxiosInstance;
  });

  describe("createTransaction", () => {
    const validTransactionData: CreateTransactionType = {
      amount: 916,
      transactionType: "expense",
      categoryName: "Dine Out",
      accountName: "BPI CC",
      date: "2026-04-08",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      description: "Khao Khai Thai Chicken House - BGC",
      draftId: "draft-123",
    };

    it("uses multipart when file is a real File", async () => {
      const file = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });
      const payloadWithFile = { ...validTransactionData, file };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: "tx-1" },
      });

      const result = await createTransaction(mockApi, payloadWithFile);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions",
        expect.any(FormData),
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      expect(result).toEqual({ id: "tx-1" });
    });

    it("uses JSON when file is a draft placeholder object", async () => {
      const payloadWithPlaceholder = {
        ...validTransactionData,
        file: {
          isRemoteFile: true,
          id: "file-from-draft",
          url: "https://example.com/r.jpg",
          name: "receipt.jpg",
          type: "image/jpeg",
        } as unknown as File,
      };
      (mockApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: "tx-2" },
      });

      const result = await createTransaction(mockApi, payloadWithPlaceholder);

      expect(mockApi.post).toHaveBeenCalledWith(
        "/transactions",
        payloadWithPlaceholder
      );
      expect(result).toEqual({ id: "tx-2" });
    });
  });

  describe("updateTransaction", () => {
    const validUpdateData: UpdateTransactionType = {
      id: "tx-9",
      amount: 1000,
      transactionType: "expense",
      categoryName: "Dining",
      accountName: "BPI CC",
      date: "2026-04-08",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      description: "Updated note",
    };

    it("uses JSON when file is not uploadable", async () => {
      const payloadWithPlaceholder = {
        ...validUpdateData,
        file: {
          isRemoteFile: true,
          id: "draft-file",
          url: "https://example.com/r2.jpg",
          name: "receipt-2.jpg",
          type: "image/jpeg",
        } as unknown as File,
      };
      (mockApi.put as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { id: "tx-9" },
      });

      const result = await updateTransaction(mockApi, payloadWithPlaceholder);

      expect(mockApi.put).toHaveBeenCalledWith(
        "/transactions/tx-9",
        payloadWithPlaceholder
      );
      expect(result).toEqual({ id: "tx-9" });
    });
  });
});
