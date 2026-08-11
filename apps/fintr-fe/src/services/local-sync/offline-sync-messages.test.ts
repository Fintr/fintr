import { describe, expect, it } from "vitest";

import {
  OFFLINE_SYNC_ROTATING_MESSAGES,
  pickOfflineSyncMessage,
} from "./offline-sync-messages";

describe("offline-sync-messages", () => {
  it("rotates through friendly waiting messages", () => {
    expect(pickOfflineSyncMessage(0)).toBe(OFFLINE_SYNC_ROTATING_MESSAGES[0]);
    expect(pickOfflineSyncMessage(OFFLINE_SYNC_ROTATING_MESSAGES.length)).toBe(
      OFFLINE_SYNC_ROTATING_MESSAGES[0],
    );
  });
});
