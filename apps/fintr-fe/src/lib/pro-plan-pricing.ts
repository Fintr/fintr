type PricedInterval = {
  interval: string;
  priceCents: number;
};

export function proYearlySavingsPercent(
  plans: PricedInterval[],
): number | null {
  const monthly = plans.find((plan) => plan.interval === "month");
  const yearly = plans.find((plan) => plan.interval === "year");

  if (!monthly || !yearly || monthly.priceCents <= 0) {
    return null;
  }

  const fullYearCents = monthly.priceCents * 12;
  if (yearly.priceCents >= fullYearCents) {
    return null;
  }

  return Math.round(
    ((fullYearCents - yearly.priceCents) / fullYearCents) * 100,
  );
}
