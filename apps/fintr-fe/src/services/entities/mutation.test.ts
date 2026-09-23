import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";

import { createEntity } from "./mutation";

describe("createEntity", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    mockApi = {
      post: vi.fn().mockResolvedValue({
        data: {
          success: true,
          data: { id: "entity-1", fullName: "Alex", entityType: "loan" },
        },
      }),
    } as unknown as AxiosInstance;
  });

  it("posts JSON for a name-only create", async () => {
    await createEntity(mockApi, {
      fullName: "Alex",
      entityType: "loan",
    });

    expect(mockApi.post).toHaveBeenCalledWith("/entities", {
      full_name: "Alex",
      entity_type: "loan",
    });
  });

  it("posts multipart photo without a fixed Content-Type so the boundary is set", async () => {
    const photo = new File(["photo"], "alex.jpg", { type: "image/jpeg" });

    await createEntity(mockApi, {
      fullName: "Alex",
      entityType: "loan",
      photo,
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      "/entities",
      expect.any(FormData),
      {
        headers: {
          "Content-Type": undefined,
        },
      },
    );

    const formData = (mockApi.post as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as FormData;
    expect(formData.get("full_name")).toBe("Alex");
    expect(formData.get("entity_type")).toBe("loan");
    expect(formData.get("photo")).toBe(photo);
  });
});
