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

  # Payload for the transactions index "Show currencies" toggle: the user's original amount and
  # ISO code, signed like +value+ (e.g. expenses negative). +nil+ when no persisted conversion.
  def booked_display_for_list_toggle
    return @booked_display_for_list_toggle if defined?(@booked_display_for_list_toggle)

    @booked_display_for_list_toggle =
      if has_currency_conversion?
        conv = currency_conversion
        if conv.blank?
          nil
        else
          original = conv.original_money.amount.to_d
          sign =
            if value.amount.negative?
              -1
            elsif value.amount.positive?
              1
            else
              1
            end

          {
            amount: (sign * original.abs).round(2),
            currency: conv.original_currency.to_s
          }
        end
      end
  end
end
