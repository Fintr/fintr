# frozen_string_literal: true

module Insights
  # Converts booked {Money} into the space's display currency using cached DB rates only.
  # Insights aggregations must not trigger live FX API fetches during read requests.
  module SpaceCurrencyAmount
    module_function

    # @param strict [Boolean] when true, missing FX logs and returns 0.
    def to_space_decimal(money:, date:, space:, strict: true)
      return 0.to_d if money.blank? || money.zero?

      space_currency = space.currency.presence || "PHP"
      from_currency = money.currency.iso_code
      return money.amount.to_d if from_currency == space_currency

      rate = cached_rate(
        from: from_currency,
        to: space_currency,
        date: date.to_date
      )

      if rate.nil?
        if strict
          Rails.logger.warn(
            "[Insights::SpaceCurrencyAmount] Skipping booked amount for space total " \
            "(cached FX missing) money=#{money.inspect} date=#{date} " \
            "from=#{from_currency} to=#{space_currency}"
          )
          return 0.to_d
        end

        return money.amount.to_d
      end

      (money.amount.to_d * rate.to_d).round(2)
    end

    def cached_rate(from:, to:, date:)
      ::ExchangeRates::ApiExchangeRate.get_rate(
        from:,
        to:,
        date:
      ) || ::ExchangeRates::ApiExchangeRate.get_rate_latest(
        from:,
        to:
      )
    end

    def sum_booked_expenses_in_space(expenses:, space:)
      expenses.inject(0.to_d) do |memo, tx|
        memo + to_space_decimal(
          money: tx.expense,
          date: tx.date.to_date,
          space: space,
          strict: true
        )
      end
    end

    # Sum a transaction relation in the space currency.
    # Groups booked cents by currency and date, then converts each bucket with cached FX.
    def sum_relation_in_space(relation:, space:)
      grouped_cents = relation
        .group(:amount_currency, :date)
        .sum(:amount_cents)

      sum_currency_date_cents(
        grouped_cents:,
        space:
      )
    end

    def sum_currency_date_cents(grouped_cents:, space:)
      grouped_cents.sum do |(currency, date), cents|
        cents_in_space(
          cents:,
          currency:,
          date:,
          space:
        )
      end
    end

    def cents_in_space(cents:, currency:, date:, space:)
      return 0.to_d if cents.blank? || cents.zero?

      to_space_decimal(
        money: Money.new(cents, currency),
        date: date.to_date,
        space:,
        strict: true
      )
    end
  end
end
