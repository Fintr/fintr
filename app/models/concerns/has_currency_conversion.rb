# frozen_string_literal: true

module HasCurrencyConversion
  extend ActiveSupport::Concern

  included do
    has_one :currency_conversion,
      as: :convertible,
      dependent: :destroy,
      class_name: "ExchangeRates::CurrencyConversion"
  end

  def has_currency_conversion?
    currency_conversion.present?
  end

  def original_amount
    return amount unless has_currency_conversion?

    currency_conversion.original_money
  end

  def display_amount
    amount
  end

  def conversion_details
    return nil unless has_currency_conversion?

    {
      original: currency_conversion.original_money.format,
      converted: amount.format,
      rate: currency_conversion.exchange_rate,
      source: currency_conversion.source
    }
  end
end
