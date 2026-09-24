import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { inheritSeriesTagsFromLocalContext } from "./inherit-series-tags";

const japanTag = {
  id: "tag-japan",
  name: "Japan 2026",
  color: "#0A3D62",
};

const baseChild = {
  id: "server-child-1",
  date: "2026-08-08",
  createdAt: "2026-08-08T10:00:00.000Z",
  description: "Weekly gym",
  amount: 50,
  amountCurrency: "PHP",
  categoryName: "Fitness",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: true,
  parentId: "server-parent",
  hasImage: false,
};

describe("inheritSeriesTagsFromLocalContext", () => {
  it("keeps tags already present on the incoming row", () => {
    const incoming = {
      ...baseChild,
      tags: [japanTag],
      tagIds: ["tag-japan"],
    };

    expect(
      inheritSeriesTagsFromLocalContext({
        incoming,
        parent: { ...baseChild, id: "server-parent", tagIds: ["other"] },
      }).tagIds,
    ).toEqual(["tag-japan"]);
  });

  it("copies tags from a matching optimistic placeholder", () => {
    const next = inheritSeriesTagsFromLocalContext({
      incoming: baseChild,
      placeholders: [
        {
          ...baseChild,
          id: "local:cid:0",
          tags: [japanTag],
          tagIds: ["tag-japan"],
        },
      ],
    });

    expect(next.tagIds).toEqual(["tag-japan"]);
  });

  it("copies tags from the series parent when placeholders are untagged", () => {
    const next = inheritSeriesTagsFromLocalContext({
      incoming: baseChild,
      parent: {
        ...baseChild,
        id: "server-parent",
        tags: [japanTag],
        tagIds: ["tag-japan"],
      },
    });

    expect(next.tags).toEqual([japanTag]);
  });
});
