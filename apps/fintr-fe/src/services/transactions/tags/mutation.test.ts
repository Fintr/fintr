import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";

import { deleteTransactionTag } from "./mutation";

describe("deleteTransactionTag", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    mockApi = {
      delete: vi.fn(),
    } as unknown as AxiosInstance;
  });

  it("returns the server payload when delete succeeds", async () => {
    vi.mocked(mockApi.delete).mockResolvedValue({
      data: { success: true, message: "Tag deleted successfully" },
    });

    await expect(deleteTransactionTag(mockApi, "tag-1")).resolves.toEqual({
      success: true,
      message: "Tag deleted successfully",
    });
  });

  it("throws when the server rejects the delete", async () => {
    vi.mocked(mockApi.delete).mockRejectedValue({
      response: {
        data: {
          success: false,
          details: {
            tag: "Cannot delete tag. There are transactions associated with the tag.",
          },
        },
      },
    });

    await expect(deleteTransactionTag(mockApi, "tag-1")).rejects.toMatchObject({
      success: false,
    });
  });
});
