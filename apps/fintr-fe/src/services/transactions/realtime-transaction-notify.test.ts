import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getClientTabId,
  isRealtimeOriginFromThisTab,
} from "@/lib/client-tab-id";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./realtime-actor-toast", () => ({
  showRealtimeTransactionActorToast: vi.fn(),
}));

import { showRealtimeTransactionActorToast } from "./realtime-actor-toast";
import {
  normalizeRealtimeActor,
  notifyRealtimeTransactionActor,
  shouldNotifyRealtimeActor,
} from "./realtime-transaction-notify";

describe("getClientTabId", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("returns a stable id for the tab session", () => {
    const first = getClientTabId();
    const second = getClientTabId();

    expect(first).toMatch(/\S+/);
    expect(second).toBe(first);
  });
});

describe("shouldNotifyRealtimeActor", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("notifies peers for loan payment creates", () => {
    expect(
      shouldNotifyRealtimeActor({
        actorAuthId: "auth0|peer",
        originTabId: "other-tab",
      }),
    ).toBe(true);
  });

  it("notifies the same account on another tab", () => {
    expect(
      shouldNotifyRealtimeActor({
        actorAuthId: "auth0|me",
        originTabId: "other-tab",
      }),
    ).toBe(true);
  });

  it("suppresses actor toasts on the originating tab", () => {
    const tabId = getClientTabId();

    expect(
      shouldNotifyRealtimeActor({
        actorAuthId: "auth0|peer",
        originTabId: tabId,
      }),
    ).toBe(false);
  });

  it("respects suppressActorToast from the server", () => {
    expect(
      shouldNotifyRealtimeActor({
        suppressActorToast: true,
        actorAuthId: "auth0|peer",
        originTabId: "other-tab",
      }),
    ).toBe(false);
  });

  it("skips when actor auth id is missing", () => {
    expect(
      shouldNotifyRealtimeActor({
        actorAuthId: "",
        originTabId: "other-tab",
      }),
    ).toBe(false);
  });
});

describe("isRealtimeOriginFromThisTab", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("matches the current tab id", () => {
    const tabId = getClientTabId();

    expect(isRealtimeOriginFromThisTab(tabId)).toBe(true);
    expect(isRealtimeOriginFromThisTab("other-tab")).toBe(false);
    expect(isRealtimeOriginFromThisTab(undefined)).toBe(false);
  });
});

describe("normalizeRealtimeActor", () => {
  it("reads camelCase actor payloads from ActionCable", () => {
    expect(
      normalizeRealtimeActor({
        userId: "user-1",
        authId: "auth0|peer",
        fullName: "Alex Actor",
        photoUrl: "https://example.com/alex.png",
      }),
    ).toEqual({
      userId: "user-1",
      authId: "auth0|peer",
      fullName: "Alex Actor",
      photoUrl: "https://example.com/alex.png",
    });
  });
});

describe("notifyRealtimeTransactionActor", () => {
  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("shows a loan payment toast for peer tabs", () => {
    notifyRealtimeTransactionActor({
      action: "added",
      actorPayload: {
        authId: "auth0|peer",
        fullName: "Alex Actor",
      },
      originTabId: "other-tab",
      transaction: {
        id: "pay-1",
        date: "2026-08-08",
        description: "BAYAD1",
        amount: 200,
        categoryName: "Loan payment",
        fromAccountName: "EastWest",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
        inSeries: false,
        hasImage: false,
        loanId: "loan-1",
      },
      transactionIds: ["pay-1"],
    });

    expect(showRealtimeTransactionActorToast).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "added",
        actor: expect.objectContaining({ authId: "auth0|peer" }),
        transaction: expect.objectContaining({
          id: "pay-1",
          type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
        }),
      }),
    );
  });

  it("does not show a toast on the originating tab", () => {
    const tabId = getClientTabId();

    notifyRealtimeTransactionActor({
      action: "added",
      actorPayload: {
        authId: "auth0|me",
        fullName: "Me",
      },
      originTabId: tabId,
      transactionIds: ["pay-1"],
    });

    expect(showRealtimeTransactionActorToast).not.toHaveBeenCalled();
  });
});
