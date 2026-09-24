export const isBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

export const canFetchExchangeRatesFromNetwork = (
  allowNetwork: boolean = true,
): boolean => allowNetwork && isBrowserOnline();
