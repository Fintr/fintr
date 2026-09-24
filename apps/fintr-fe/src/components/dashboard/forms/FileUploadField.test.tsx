import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FileUploadField from "./FileUploadField";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => false,
}));

describe("FileUploadField", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:receipt-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("uses a dark-mode border on the attached receipt preview", () => {
    const file = new File(["receipt"], "1855 receipt.jpg", {
      type: "image/jpeg",
    });

    render(
      <FileUploadField
        file={file}
        onFileChange={() => {}}
        onRemoveFile={() => {}}
      />,
    );

    const attached = screen.getByText(/Receipt attached:/);
    const preview = attached.closest("div.rounded-lg");

    expect(preview).toHaveClass("dark:border-border");
  });
});
