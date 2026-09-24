import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSyncCoordinatorForTests, schedulePullForSpace } from "./sync-coordinator";

const drainAllOutboxes = vi.fn();
const pullSpaceChanges = vi.fn();

vi.mock("./drain-outbox", () => ({
  drainAllOutboxes: (...args: unknown[]) => drainAllOutboxes(...args),
}));

vi.mock("./pull-space-changes", () => ({
  pullSpaceChanges: (...args: unknown[]) => pullSpaceChanges(...args),
}));

vi.mock("@/lib/space-sync-feature-flag", () => ({
  isSpaceSyncPullEnabled: () => true,
}));

vi.mock("./bootstrap-v2", () => ({
  bootstrapSpaceV2: vi.fn(),
}));

describe("schedulePullForSpace", () => {
  const api = {} as never;
  const queryClient = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSyncCoordinatorForTests();
    drainAllOutboxes.mockResolvedValue({ processed: 0, failed: 0, stoppedEarly: false });
    pullSpaceChanges.mockResolvedValue({
      status: "complete",
      latestSeq: 5,
    });
  });

  it("drains the outbox even when pull is throttled by a recent focus pull", async () => {
    await schedulePullForSpace(
      { api, queryClient, spaceCodes: ["space-a"] },
      "space-a",
      "focus",
    );

    expect(drainAllOutboxes).toHaveBeenCalledTimes(1);
    expect(pullSpaceChanges).toHaveBeenCalledTimes(1);

    drainAllOutboxes.mockClear();
    pullSpaceChanges.mockClear();

    await schedulePullForSpace(
      { api, queryClient, spaceCodes: ["space-a"] },
      "space-a",
      "focus",
    );

    expect(drainAllOutboxes).toHaveBeenCalledTimes(1);
    expect(pullSpaceChanges).not.toHaveBeenCalled();
  });

  it("drains and pulls again on online reconnect without throttling", async () => {
    await schedulePullForSpace(
      { api, queryClient, spaceCodes: ["space-a"] },
      "space-a",
      "focus",
    );

    drainAllOutboxes.mockClear();
    pullSpaceChanges.mockClear();

    await schedulePullForSpace(
      { api, queryClient, spaceCodes: ["space-a"] },
      "space-a",
      "online",
    );

    expect(drainAllOutboxes).toHaveBeenCalledTimes(1);
    expect(pullSpaceChanges).toHaveBeenCalledTimes(1);
  });
});
