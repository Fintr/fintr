import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MerchantAvatar } from "./merchant-avatar";

describe("MerchantAvatar", () => {
  it("downloads the public file when the local photo copy fails", async () => {
    const fileUrl = "https://storage.googleapis.com/fintr-dev/photo-avatar.jpg";
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => "blob:downloaded-photo";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["photo"], { type: "image/jpeg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MerchantAvatar
        name="Store"
        photoUrl="blob:local-photo"
        fileUrl={fileUrl}
      />,
    );

    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "blob:local-photo");

    fireEvent.error(image!);

    await waitFor(() => {
      expect(image).toHaveAttribute("src", "blob:downloaded-photo");
    });
    expect(fetchMock).toHaveBeenCalledWith(fileUrl);
    URL.createObjectURL = createObjectURL;
    vi.unstubAllGlobals();
  });
});
