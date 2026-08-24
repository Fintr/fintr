const DETAIL_SEARCH_KEYS = [
  "transactionId",
  "loanId",
  "accountId",
  "entityId",
  "categoryId",
  "kind",
] as const;

const storageKey = (pathname: string, param: string): string =>
  `fintr:detail:${pathname}:${param}`;

const readStored = (pathname: string, param: string): string | null => {
  try {
    return sessionStorage.getItem(storageKey(pathname, param));
  } catch {
    return null;
  }
};

const writeStored = (pathname: string, param: string, value: string): void => {
  try {
    sessionStorage.setItem(storageKey(pathname, param), value);
  } catch {
    // sessionStorage can throw in private mode
  }
};

export const rememberDetailHref = (href: string): void => {
  const url = new URL(href, "https://fintr.invalid");

  for (const key of DETAIL_SEARCH_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      writeStored(url.pathname, key, value);
    }
  }
};

export const resolveDetailSearchParam = (
  param: string,
  searchParams: { get: (key: string) => string | null },
  locationSearch =
    typeof window === "undefined" ? "" : window.location.search,
  pathname = typeof window === "undefined" ? "" : window.location.pathname,
): string => {
  const fromParams = searchParams.get(param);
  if (fromParams) {
    return fromParams;
  }

  const fromLocation = new URLSearchParams(locationSearch).get(param);
  if (fromLocation) {
    return fromLocation;
  }

  return readStored(pathname, param) ?? "";
};

export const pushDashboardDetail = (
  router: { push: (href: string) => void },
  href: string,
): void => {
  rememberDetailHref(href);
  router.push(href);
};
