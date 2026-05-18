# frozen_string_literal: true

module Insights
  # Converts booked {Money} into the space's display currency using
  # {ExchangeRates::Operations::AmountInSpaceCurrency} (Fintr FX), not +Money::Bank+.
  module SpaceCurrencyAmount
    module_function

    # @param strict [Boolean] when true, missing FX logs and returns 0 (same contract as
    #   {ExchangeRates::Operations::AmountInSpaceForTransactable.totals_amount_decimal}).
    def to_space_decimal(money:, date:, space:, strict: true)
      return 0.to_d if money.blank? || money.zero?

      result = ::ExchangeRates::Operations::AmountInSpaceCurrency.new.call(
        amount: money.amount,
        amount_currency: money.currency.iso_code,
        date: date,
        space: space,
        strict: strict
      )

      if result.success?
        result.value![:amount].to_d
      else
        Rails.logger.warn(
          "[Insights::SpaceCurrencyAmount] Skipping booked amount for space total " \
          "(strict FX failed) money=#{money.inspect} date=#{date} failure=#{result.failure.inspect}"
        )
        0.to_d
      end
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
  end
end
