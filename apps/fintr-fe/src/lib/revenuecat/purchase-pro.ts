import {
  detectPlatform,
  type PlatformDetectionResult,
} from "@/lib/platform-detection";

const PURCHASE_CANCELLED_CODE = "1";

/** RevenueCat entitlement identifier configured for Fintr Pro. */
export const PRO_ENTITLEMENT_ID = "pro";

/**
 * Pro packages on the current RevenueCat offering.
 * Monthly and yearly tracking stay on the free tier and have no entitlement.
 */
export const REVENUECAT_PACKAGE_IDENTIFIERS = [
  "pro_monthly",
  "pro_yearly",
] as const;

export class PurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled");
    this.name = "PurchaseCancelledError";
  }
}

type OfferingPackage = {
  identifier: string;
  packageType?: string;
};

type CustomerInfoLike = {
  entitlements?: {
    active?: Record<string, unknown>;
  };
};

let configurePromise: Promise<void> | null = null;

export function resetRevenueCatClientForTests(): void {
  configurePromise = null;
}

function trimmedEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function revenueCatPublicApiKey(
  platform: Pick<PlatformDetectionResult, "isIOSNative" | "isAndroidNative">,
): string | undefined {
  const testStoreKey = trimmedEnv(process.env.NEXT_PUBLIC_REVENUECAT_API_KEY);

  if (platform.isIOSNative) {
    return (
      trimmedEnv(process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY) ?? testStoreKey
    );
  }

  if (platform.isAndroidNative) {
    return (
      trimmedEnv(process.env.NEXT_PUBLIC_REVENUECAT_GOOGLE_API_KEY) ?? testStoreKey
    );
  }

  return undefined;
}

export function selectProPackage<T extends OfferingPackage>(
  packages: T[],
): T | undefined {
  for (const identifier of REVENUECAT_PACKAGE_IDENTIFIERS) {
    const match = packages.find((pkg) => pkg.identifier === identifier);
    if (match) {
      return match;
    }
  }

  return undefined;
}

export function customerHasProEntitlement(
  customerInfo: CustomerInfoLike,
): boolean {
  return Boolean(customerInfo.entitlements?.active?.[PRO_ENTITLEMENT_ID]);
}

export async function ensureRevenueCatConfigured(): Promise<boolean> {
  const platform = detectPlatform(
    navigator.userAgent,
    document.documentElement,
  );
  const apiKey = revenueCatPublicApiKey(platform);
  if (!platform.isNative || !apiKey) {
    return false;
  }

  if (!configurePromise) {
    configurePromise = configurePurchases(apiKey).catch((error) => {
      configurePromise = null;
      throw error;
    });
  }

  await configurePromise;
  return true;
}

async function configurePurchases(apiKey: string): Promise<void> {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.configure({ apiKey });
}

export async function identifyRevenueCatUser(appUserId: string): Promise<boolean> {
  const configured = await ensureRevenueCatConfigured();
  if (!configured) {
    return false;
  }

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.logIn({ appUserID: appUserId });
  return true;
}

export async function getProCustomerInfo(appUserId: string): Promise<{
  hasPro: boolean;
  activeEntitlements: string[];
}> {
  const identified = await identifyRevenueCatUser(appUserId);
  if (!identified) {
    return { hasPro: false, activeEntitlements: [] };
  }

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.getCustomerInfo();
  const activeEntitlements = Object.keys(customerInfo.entitlements.active);

  return {
    hasPro: customerHasProEntitlement(customerInfo),
    activeEntitlements,
  };
}

export async function presentProPaywall(appUserId: string): Promise<void> {
  const identified = await identifyRevenueCatUser(appUserId);
  if (!identified) {
    throw new Error(
      "Fintr Pro purchases in the store are available in the mobile app.",
    );
  }

  const { RevenueCatUI, PAYWALL_RESULT } = await import(
    "@revenuecat/purchases-capacitor-ui"
  );
  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
    displayCloseButton: true,
  });

  if (
    result === PAYWALL_RESULT.PURCHASED ||
    result === PAYWALL_RESULT.RESTORED ||
    result === PAYWALL_RESULT.NOT_PRESENTED
  ) {
    const info = await getProCustomerInfo(appUserId);
    if (!info.hasPro) {
      throw new Error(
        "The store purchase is still pending. Fintr Pro unlocks when the store finishes it.",
      );
    }
    return;
  }

  if (result === PAYWALL_RESULT.CANCELLED) {
    throw new PurchaseCancelledError();
  }

  throw new Error("Fintr Pro could not be purchased.");
}

export async function presentProCustomerCenter(appUserId: string): Promise<void> {
  await manageProSubscription(appUserId);
}

export async function manageProSubscription(
  appUserId: string,
  managementUrl?: string | null,
): Promise<void> {
  const identified = await identifyRevenueCatUser(appUserId);
  if (identified) {
    const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");
    await RevenueCatUI.presentCustomerCenter();
    return;
  }

  if (managementUrl) {
    window.open(managementUrl, "_blank", "noopener,noreferrer");
    return;
  }

  throw new Error(
    "Subscription management in the store is available in the mobile app.",
  );
}

export async function purchaseProPlan(appUserId: string): Promise<void> {
  const identified = await identifyRevenueCatUser(appUserId);
  if (!identified) {
    throw new Error(
      "Fintr Pro purchases in the store are available in the mobile app.",
    );
  }

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
  const proPackage = selectProPackage(
    offerings.current?.availablePackages ?? [],
  );
  if (!proPackage) {
    throw new Error("Fintr Pro is not available for purchase yet.");
  }

  try {
    await Purchases.purchasePackage({ aPackage: proPackage });
  } catch (error) {
    if (isPurchaseCancelled(error)) {
      throw new PurchaseCancelledError();
    }

    throw error;
  }
}

function isPurchaseCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: string; userCancelled?: boolean | null };
  return record.userCancelled === true || record.code === PURCHASE_CANCELLED_CODE;
}
