import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  customerHasProEntitlement,
  manageProSubscription,
  presentProCustomerCenter,
  presentProPaywall,
  purchaseProPlan,
  PurchaseCancelledError,
  resetRevenueCatClientForTests,
  revenueCatPublicApiKey,
  selectProPackage,
} from "./purchase-pro";

const purchases = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn(),
  getOfferings: vi.fn(),
  getCustomerInfo: vi.fn(),
  purchasePackage: vi.fn(),
}));

const revenueCatUi = vi.hoisted(() => ({
  presentPaywallIfNeeded: vi.fn(),
  presentCustomerCenter: vi.fn(),
}));

const platform = vi.hoisted(() => ({
  isNative: true,
  isIOSNative: true,
  isAndroidNative: false,
}));

vi.mock("@/lib/platform-detection", () => ({
  detectPlatform: () => platform,
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: purchases,
}));

vi.mock("@revenuecat/purchases-capacitor-ui", () => ({
  RevenueCatUI: revenueCatUi,
  PAYWALL_RESULT: {
    NOT_PRESENTED: "NOT_PRESENTED",
    ERROR: "ERROR",
    CANCELLED: "CANCELLED",
    PURCHASED: "PURCHASED",
    RESTORED: "RESTORED",
  },
}));

describe("RevenueCat purchases", () => {
  beforeEach(() => {
    resetRevenueCatClientForTests();
    purchases.configure.mockReset();
    purchases.logIn.mockReset();
    purchases.getOfferings.mockReset();
    purchases.getCustomerInfo.mockReset();
    purchases.purchasePackage.mockReset();
    revenueCatUi.presentPaywallIfNeeded.mockReset();
    revenueCatUi.presentCustomerCenter.mockReset();
    purchases.configure.mockResolvedValue(undefined);
    purchases.logIn.mockResolvedValue({});
    purchases.getCustomerInfo.mockResolvedValue({
      customerInfo: { entitlements: { active: { pro: { identifier: "pro" } } } },
    });
    platform.isNative = true;
    platform.isIOSNative = true;
    platform.isAndroidNative = false;
    vi.stubEnv("NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY", "appl_test");
    vi.stubEnv("NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY", "goog_test");
    vi.stubEnv("NEXT_PUBLIC_REVENUECAT_API_KEY", "test_store");
  });

  it("configures RevenueCat once, then logs in with the Fintr user id", async () => {
    const proPackage = { identifier: "pro_monthly", packageType: "CUSTOM" };
    purchases.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          { identifier: "yearly", packageType: "ANNUAL" },
          proPackage,
        ],
      },
    });
    purchases.purchasePackage.mockResolvedValue({});

    await purchaseProPlan("user-1");

    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_test" });
    expect(purchases.logIn).toHaveBeenCalledWith({ appUserID: "user-1" });
    expect(purchases.purchasePackage).toHaveBeenCalledWith({
      aPackage: proPackage,
    });
  });

  it("treats a cancelled store sheet as a cancelled purchase", async () => {
    purchases.getOfferings.mockResolvedValue({
      current: { availablePackages: [{ identifier: "pro_monthly", packageType: "MONTHLY" }] },
    });
    purchases.purchasePackage.mockRejectedValue({ code: "1", userCancelled: true });

    await expect(purchaseProPlan("user-1")).rejects.toBeInstanceOf(
      PurchaseCancelledError,
    );
  });

  it("uses the Google key on Android", () => {
    expect(
      revenueCatPublicApiKey({ isIOSNative: false, isAndroidNative: true }),
    ).toBe("goog_test");
  });

  it("uses the Test Store key when a store key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY", "");

    expect(
      revenueCatPublicApiKey({ isIOSNative: true, isAndroidNative: false }),
    ).toBe("test_store");
  });

  it("buys pro_monthly and ignores packages with no entitlement", () => {
    const selected = selectProPackage([
      { identifier: "yearly", packageType: "ANNUAL" },
      { identifier: "pro_yearly", packageType: "ANNUAL" },
      { identifier: "monthly", packageType: "MONTHLY" },
      { identifier: "pro_monthly", packageType: "CUSTOM" },
    ]);

    expect(selected?.identifier).toBe("pro_monthly");
    expect(
      selectProPackage([
        { identifier: "monthly", packageType: "MONTHLY" },
        { identifier: "yearly", packageType: "ANNUAL" },
      ]),
    ).toBeUndefined();
  });

  it("treats an active pro entitlement as Fintr Pro", () => {
    expect(
      customerHasProEntitlement({
        entitlements: { active: { pro: { identifier: "pro" } } },
      }),
    ).toBe(true);
    expect(
      customerHasProEntitlement({ entitlements: { active: {} } }),
    ).toBe(false);
  });

  it("presents the paywall until the pro entitlement is active", async () => {
    revenueCatUi.presentPaywallIfNeeded.mockResolvedValue({ result: "PURCHASED" });

    await presentProPaywall("user-1");

    expect(revenueCatUi.presentPaywallIfNeeded).toHaveBeenCalledWith({
      requiredEntitlementIdentifier: "pro",
      displayCloseButton: true,
    });
    expect(purchases.getCustomerInfo).toHaveBeenCalled();
  });

  it("treats a dismissed paywall as a cancelled purchase", async () => {
    revenueCatUi.presentPaywallIfNeeded.mockResolvedValue({ result: "CANCELLED" });

    await expect(presentProPaywall("user-1")).rejects.toBeInstanceOf(
      PurchaseCancelledError,
    );
  });

  it("opens Customer Center for an identified customer", async () => {
    await presentProCustomerCenter("user-1");

    expect(purchases.logIn).toHaveBeenCalledWith({ appUserID: "user-1" });
    expect(revenueCatUi.presentCustomerCenter).toHaveBeenCalled();
  });

  it("opens the store management page in the browser", async () => {
    platform.isNative = false;
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    await manageProSubscription(
      "user-1",
      "https://apps.apple.com/account/subscriptions",
    );

    expect(revenueCatUi.presentCustomerCenter).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(
      "https://apps.apple.com/account/subscriptions",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
