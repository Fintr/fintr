import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosInstance } from "axios";
import { createProductPulseFeedback } from "./mutations";

describe("createProductPulseFeedback", () => {
  let mockApi: AxiosInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    mockApi = {
      post: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as AxiosInstance;
  });

  it("POSTs snake_case body and omits empty notes", async () => {
    await createProductPulseFeedback(mockApi, {
      likedAreas: ["transactions"],
      improveAreas: ["speed"],
    });

    expect(mockApi.post).toHaveBeenCalledWith("/product_pulse_feedbacks", {
      liked_areas: ["transactions"],
      improve_areas: ["speed"],
      notes: undefined,
    });
  });

  it("trims notes and passes when non-empty", async () => {
    await createProductPulseFeedback(mockApi, {
      likedAreas: [],
      improveAreas: [],
      notes: "  hello  ",
    });

    expect(mockApi.post).toHaveBeenCalledWith("/product_pulse_feedbacks", {
      liked_areas: [],
      improve_areas: [],
      notes: "hello",
    });
  });
});
