import { describe, expect, it } from "vitest";

import { applyToggledDefaultTag } from "./local-cache";
import type { TransactionTag } from "@/types/transactionTagTypes";

const tag = (
  id: string,
  extras: Partial<TransactionTag> = {},
): TransactionTag => ({
  id,
  name: id,
  color: "#0A3D62",
  isDefault: false,
  ...extras,
});

describe("applyToggledDefaultTag", () => {
  it("marks the updated tag as default and clears others", () => {
    const next = applyToggledDefaultTag(
      [
        tag("europe", { isDefault: true }),
        tag("japan"),
      ],
      tag("japan", { isDefault: true, name: "Japan 2026" }),
    );

    expect(next.find((item) => item.id === "japan")?.isDefault).toBe(true);
    expect(next.find((item) => item.id === "europe")?.isDefault).toBe(false);
    expect(next.find((item) => item.id === "japan")?.name).toBe("Japan 2026");
  });

  it("unsets the default without changing other tags", () => {
    const next = applyToggledDefaultTag(
      [
        tag("europe"),
        tag("japan", { isDefault: true }),
      ],
      tag("japan", { isDefault: false }),
    );

    expect(next.every((item) => item.isDefault !== true)).toBe(true);
  });
});
