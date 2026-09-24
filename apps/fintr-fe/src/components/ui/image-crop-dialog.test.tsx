import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-easy-crop/react-easy-crop.css", () => ({}));

vi.mock("react-easy-crop", () => ({
  default: () => <div>cropper</div>,
}));

import { ImageCropDialog } from "./image-crop-dialog";

vi.mock("@/lib/crop-image", () => ({
  getCroppedImageFile: vi.fn(),
}));

const mockUsePlatformDetection = vi.fn(() => ({
  isAndroidNative: false,
  isAndroidBrowser: false,
  isIOSNative: false,
  isIOSBrowser: false,
  isNative: false,
  isMobileBrowser: false,
  safeAreaInsetBottom: 0,
  safeAreaInsetTop: 0,
  hasAndroid3ButtonNav: false,
}));

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => mockUsePlatformDetection(),
}));

vi.mock("@/hooks/useKeyboardDetector", () => ({
  useKeyboardDetector: () => ({ isOpen: false, visualViewportHeight: null }),
}));

vi.mock("@/hooks/useMobileModalViewportHeight", () => ({
  useMobileModalViewportHeight: () => null,
}));

describe("ImageCropDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.stubGlobal("scrollTo", vi.fn());
    mockUsePlatformDetection.mockReturnValue({
      isAndroidNative: false,
      isAndroidBrowser: false,
      isIOSNative: false,
      isIOSBrowser: false,
      isNative: false,
      isMobileBrowser: false,
      safeAreaInsetBottom: 0,
      safeAreaInsetTop: 0,
      hasAndroid3ButtonNav: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("stacks above parent modals without taking over history", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");

    render(
      <ImageCropDialog
        open
        imageSrc="data:image/png;base64,aaa"
        onOpenChange={vi.fn()}
        onCropped={vi.fn()}
        title="Crop borrower photo"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Crop borrower photo")).toBeInTheDocument();
    });

    const companion = document.querySelector("[data-image-crop-dialog]");
    expect(companion).toBeTruthy();
    expect(companion?.className).toContain("z-[120]");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(pushStateSpy).not.toHaveBeenCalled();
  });
});
