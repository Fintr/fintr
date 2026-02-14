export interface OptionType {
  label: string;
  value: string;
}

/** Account option from dashboard; includes currency for exchange-rate flows */
export interface AccountOptionWithCurrency extends OptionType {
  currency?: string;
}
