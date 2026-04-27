# frozen_string_literal: true

module ExchangeRates
  module Operations
    # Resolves a transactable's booked amount into the space's currency for **list display** and
    # **index totals** (see {.display_payload} and {.totals_amount_decimal}). Centralizes the
    # currency_conversion "original in space currency" edge case and delegates FX to
    # {AmountInSpaceCurrency}.
    class AmountInSpaceForTransactable < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transactable).value(:any)
          optional(:strict).maybe(:bool)
        end
      end

      def self.display_payload(transactable:)
        result = new.call(transactable:, strict: false)
        return result.value! if result.success?

        fallback_payload(transactable:)
      end

      def self.totals_amount_decimal(transactable:)
        result = new.call(transactable:, strict: true)
        return result.value![:amount].to_d.round(2) if result.success?

        Rails.logger.warn(
          "[ExchangeRates::Operations::AmountInSpaceForTransactable] Skipping row for totals " \
          "(strict FX failed) transactable=#{transactable.class.name}(#{transactable.try(:id)}) " \
          "failure=#{result.failure.inspect}"
        )
        0.to_d
      end

      def self.fallback_payload(transactable:)
        {
          amount: transactable.amount.amount,
          currency: transactable.amount_currency,
        }
      end
      private_class_method :fallback_payload

      def call(params)
        params = step validate(params:)
        step compute(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def compute(params:)
        transactable = params[:transactable]
        strict       = params[:strict] == true

        early = original_in_space_payload(transactable:)
        return Success(early) if early

        fx_result = ::ExchangeRates::Operations::AmountInSpaceCurrency.new.call(
          amount: transactable.amount.amount,
          amount_currency: transactable.amount_currency,
          date: transactable.date.to_date,
          space: transactable.space,
          strict: strict
        )

        return fx_result if fx_result.success?
        return fx_result if strict

        Success(
          amount: transactable.amount.amount,
          currency: transactable.amount_currency
        )
      end

      def original_in_space_payload(transactable:)
        return nil unless transactable.respond_to?(:has_currency_conversion?) && transactable.has_currency_conversion?
        return nil unless transactable.respond_to?(:value)

        conversion = transactable.currency_conversion
        return nil if conversion.blank?

        space_ccy = transactable.space.currency.presence || "PHP"
        return nil unless conversion.original_currency == space_ccy

        original = conversion.original_money.amount.to_d
        sign =
          if transactable.value.amount.negative?
            -1
          elsif transactable.value.amount.positive?
            1
          else
            1
          end

        {
          amount: (sign * original.abs).round(2),
          currency: space_ccy,
        }
      end
    end
  end
end
