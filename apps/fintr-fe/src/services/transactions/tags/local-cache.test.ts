import { describe, expect, it } from "vitest";

import { applyToggledDefaultTag, normalizeTransactionTag, stripTagFromTransaction } from "./local-cache";
import { tagStylePresetSrc } from "@/lib/tags/preset-style-images";
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

describe("normalizeTransactionTag", () => {
  it("resolves a bundled preset image when no custom style is attached", () => {
    const tag = normalizeTransactionTag({
      id: "tag-1",
      name: "Japan 2026",
      color: "#0A3D62",
      style_preset_key: "japan-vacation",
    });

    expect(tag.stylePresetKey).toBe("japan-vacation");
    expect(tag.styleImageUrl).toBe(tagStylePresetSrc("japan-vacation"));
  });
});

describe("stripTagFromTransaction", () => {
  it("removes the tag from tags and tagIds", () => {
    const next = stripTagFromTransaction(
      {
        id: "tx-1",
        date: "2026-09-04",
        description: "Flight",
        amount: 12000,
        categoryName: "Travel",
        fromAccountName: "Cash",
        toAccountName: "",
        type: "expense" as never,
        inSeries: false,
        hasImage: false,
        tags: [tag("tag-1"), tag("tag-2")],
        tagIds: ["tag-1", "tag-2"],
      } as never,
      "tag-1",
    );

    expect(next.tags).toEqual([tag("tag-2")]);
    expect((next as { tagIds?: string[] }).tagIds).toEqual(["tag-2"]);
  });
});
