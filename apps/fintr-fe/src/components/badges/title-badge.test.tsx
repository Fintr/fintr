import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TitleBadge } from "./title-badge";

describe("TitleBadge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the title illustration from the shell cache so it works offline", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const match = vi.fn().mockImplementation((request: string) => {
      if (request === "/badges/receipt_rookie.png") {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(blob),
        });
      }

      return Promise.resolve(undefined);
    });
    const open = vi.fn().mockResolvedValue({ match });
    const keys = vi.fn().mockResolvedValue(["fintr-shell-test"]);

    vi.stubGlobal("caches", { keys, open });

    if (typeof URL.createObjectURL === "function") {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt-rookie");
    } else {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:receipt-rookie"),
      });
    }

    if (typeof URL.revokeObjectURL === "function") {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    } else {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
    }

    render(
      <TitleBadge
        title={{
          level: 2,
          key: "receipt_rookie",
          title: "Receipt Rookie",
          description: "Logging spends like it is second nature.",
          imageKey: "receipt_rookie",
          unlocked: true,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Receipt Rookie" })).toHaveAttribute(
        "src",
        "blob:receipt-rookie",
      );
    });
  });
});
