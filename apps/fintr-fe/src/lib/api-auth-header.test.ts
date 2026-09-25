import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthStorage } from "@/lib/auth-storage";

import { createAuthenticatedClient } from "./api";

describe("createAuthenticatedClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("spaceCode");
  });

  it("sends the stored session when the token getter fails", async () => {
    vi.spyOn(AuthStorage, "getAccessToken").mockReturnValue("header.payload.signature");
    localStorage.setItem("spaceCode", "personal-space");

    let captured: InternalAxiosRequestConfig | undefined;
    const api = createAuthenticatedClient(async () => {
      throw new Error("No access token available");
    });
    api.defaults.adapter = async (config) => {
      captured = config;
      return {
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    await api.get("/attachments/download");

    expect(captured?.headers.get("Authorization")).toBe(
      "Bearer header.payload.signature",
    );
    expect(captured?.headers.get("X-Space-Code")).toBe("personal-space");
  });
});
