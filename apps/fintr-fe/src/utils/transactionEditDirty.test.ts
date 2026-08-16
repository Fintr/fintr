import {
  fileDirtySignature,
  isEditSnapshotDirty,
  nextAttachmentBaselineSignature,
} from "@/utils/transactionEditDirty";

describe("nextAttachmentBaselineSignature", () => {
  it("keeps the loaded baseline when a newly picked File is echoed onto initialData", () => {
    const uploaded = new File(["bytes"], "currency selector.jpeg", {
      type: "image/jpeg",
    });

    expect(
      nextAttachmentBaselineSignature({
        transactionId: "tx-1",
        previousTransactionId: "tx-1",
        previousBaseline: "",
        incomingFile: uploaded,
      }),
    ).toBe("");
  });

  it("keeps the loaded baseline when a removal is echoed onto initialData", () => {
    expect(
      nextAttachmentBaselineSignature({
        transactionId: "tx-1",
        previousTransactionId: "tx-1",
        previousBaseline: "receipt.jpg:0:0",
        incomingFile: null,
      }),
    ).toBe("receipt.jpg:0:0");
  });

  it("accepts a server display file that arrives for the same transaction", () => {
    const displayFile = {
      isRemoteFile: true,
      name: "receipt.jpg",
      size: 0,
      lastModified: 0,
    } as File;

    expect(
      nextAttachmentBaselineSignature({
        transactionId: "tx-1",
        previousTransactionId: "tx-1",
        previousBaseline: "",
        incomingFile: displayFile,
      }),
    ).toBe("receipt.jpg:0:0");
  });

  it("accepts a cached IndexedDB file that arrives for the same transaction", () => {
    const cached = new File(["bytes"], "receipt.jpg", {
      type: "image/jpeg",
    });
    (cached as File & { isExistingLocalAttachment?: boolean }).isExistingLocalAttachment = true;

    expect(
      nextAttachmentBaselineSignature({
        transactionId: "tx-1",
        previousTransactionId: "tx-1",
        previousBaseline: "",
        incomingFile: cached,
      }),
    ).toBe(fileDirtySignature(cached));
  });

  it("resets the baseline when a different transaction is loaded", () => {
    const displayFile = {
      isRemoteFile: true,
      name: "other.jpg",
      size: 12,
      lastModified: 1,
    } as File;

    expect(
      nextAttachmentBaselineSignature({
        transactionId: "tx-2",
        previousTransactionId: "tx-1",
        previousBaseline: "",
        incomingFile: displayFile,
      }),
    ).toBe("other.jpg:12:1");
  });
});

describe("isEditSnapshotDirty", () => {
  it("is clean when current matches baseline", () => {
    expect(
      isEditSnapshotDirty(
        true,
        { toAccountName: "Gotrade" },
        { toAccountName: "Gotrade" },
      ),
    ).toBe(false);
  });

  it("is dirty when a field changes", () => {
    expect(
      isEditSnapshotDirty(
        true,
        { toAccountName: "BDO" },
        { toAccountName: "Gotrade" },
      ),
    ).toBe(true);
  });

  it("is never dirty outside edit mode", () => {
    expect(
      isEditSnapshotDirty(
        false,
        { toAccountName: "BDO" },
        { toAccountName: "Gotrade" },
      ),
    ).toBe(false);
  });
});
