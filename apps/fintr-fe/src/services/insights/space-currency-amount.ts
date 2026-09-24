import {
  loadCachedCurrentExchangeRate,
  loadCachedRecentExchangeRates,
} from "@/services/exchangeRates/local-db";

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

const roundMoney = (value: number): number =>
  Number(Number(value).toFixed(2));

/**
 * Mirrors Insights::SpaceCurrencyAmount.cached_rate — date rate, then latest recent.
 */
export type ExchangeRateLookup = (
  fromCurrency: string,
  toCurrency: string,
  date: string,
) => number | undefined;

export const toSpaceDecimal = (params: {
  amount: number;
  fromCurrency: string;
  date: string;
  spaceCurrency: string;
  rateLookup?: ExchangeRateLookup;
  strict?: boolean;
}): number => {
  const {
    amount,
    fromCurrency,
    date,
    spaceCurrency,
    rateLookup,
    strict = true,
  } = params;

  if (!Number.isFinite(amount) || amount === 0) {
    return 0;
  }

  const from = normalizeCurrency(fromCurrency || spaceCurrency);
  const to = normalizeCurrency(spaceCurrency || "PHP");

  if (from === to) {
    return roundMoney(amount);
  }

  const rate = rateLookup?.(from, to, date.slice(0, 10));
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    if (strict) {
      return 0;
    }

    return roundMoney(amount);
  }

  return roundMoney(amount * rate);
};

/**
 * Preload FX pairs needed for transaction aggregation into memory.
 */
export const preloadExchangeRatesForTransactions = async (params: {
  spaceCode: string;
  spaceCurrency: string;
  transactions: Array<{
    date: string;
    amountCurrency?: string;
    bookedAmountCurrency?: string;
  }>;
}): Promise<ExchangeRateLookup> => {
  const { spaceCode, spaceCurrency, transactions } = params;
  const space = normalizeCurrency(spaceCurrency || "PHP");
  const rateByKey = new Map<string, number>();

  const resolveRate = async (
    fromCurrency: string,
    toCurrency: string,
    date: string,
  ): Promise<number | undefined> => {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    const day = date.slice(0, 10);
    const key = `${from}:${to}:${day}`;

    if (from === to) {
      return 1;
    }

    const cached = rateByKey.get(key);
    if (cached != null) {
      return cached;
    }

    const dated = await loadCachedCurrentExchangeRate({
      fromCurrency: from,
      toCurrency: to,
      date: day,
    });

    if (
      dated
      && Number.isFinite(Number(dated.rate))
      && Number(dated.rate) > 0
    ) {
      rateByKey.set(key, Number(dated.rate));
      return Number(dated.rate);
    }

    const latestKey = `${from}:${to}:latest`;
    const latestCached = rateByKey.get(latestKey);
    if (latestCached != null) {
      rateByKey.set(key, latestCached);
      return latestCached;
    }

    if (!spaceCode) {
      return undefined;
    }

    const recent = await loadCachedRecentExchangeRates({
      spaceId: spaceCode,
      fromCurrency: from,
      toCurrency: to,
    });
    const latest = recent?.rates?.find(
      (row) => Number.isFinite(row.rate) && row.rate > 0,
    );

    if (!latest) {
      return undefined;
    }

    rateByKey.set(latestKey, latest.rate);
    rateByKey.set(key, latest.rate);
    return latest.rate;
  };

  const pairs = new Set<string>();

  for (const transaction of transactions) {
    const date = transaction.date.slice(0, 10);
    for (const currency of [
      transaction.bookedAmountCurrency,
      transaction.amountCurrency,
    ]) {
      if (!currency) {
        continue;
      }

      const from = normalizeCurrency(currency);
      if (from !== space) {
        pairs.add(`${from}:${space}:${date}`);
      }
    }
  }

  await Promise.all(
    Array.from(pairs).map((pair) => {
      const [from, to, date] = pair.split(":");
      return resolveRate(from, to, date);
    }),
  );

  return (fromCurrency: string, toCurrency: string, date: string) => {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    const day = date.slice(0, 10);
    const key = `${from}:${to}:${day}`;

    if (from === to) {
      return 1;
    }

    return rateByKey.get(key) ?? rateByKey.get(`${from}:${to}:latest`);
  };
};
