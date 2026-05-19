# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      # Positive debit/credit magnitudes in +account.balance_currency+ for transfer legs.
      #
      # Matches {Transactions::Operations::Transfers::CalculateBalances} and delete/revert flows.
      #
      # **Legacy mis-tagged +amount_currency+:** when both accounts share the same
      # +balance_currency+, there is no +currency_conversion+ row, and +transfer.amount_currency+
      # differs from that shared currency (e.g. space default PHP on a USD–USD transfer), the stored
      # +amount.amount+ is interpreted in the **accounts'** currency so deletes and balance jobs do
      # not require FX (PHP → USD) for a transfer that was never cross-currency.
      class BookedTransferLegMagnitude
        class << self
          include Dry::Monads[:result]

          # ISO code for the numeric stored on +transfer.amount+ when +amount_currency+ was
          # mis-tagged with the space default (e.g. PHP on a USD–USD transfer). +nil+ when the
          # row should use +transfer.amount_currency+ as-is.
          def effective_stored_amount_currency(transfer:)
            return nil unless transfer.is_a?(Transactions::Transfer)
            return nil if transfer.currency_conversion.present?
            return nil unless transfer.from_account && transfer.to_account

            shared = transfer.from_account.balance_currency
            return nil unless shared == transfer.to_account.balance_currency
            return nil unless transfer.amount_currency != shared

            shared
          end

          def debit_magnitude(transfer:, account:, rate_date:)
            conv = transfer.currency_conversion

            if conv.present?
              if conv.original_currency == account.balance_currency
                return Success(BigDecimal(conv.original_money.amount.to_s).round(2))
              end

              return convert_amount(
                amount: conv.original_money.amount,
                from_currency: conv.original_currency,
                to_currency: account.balance_currency,
                space_id: transfer.space_id,
                date: rate_date
              )
            end

            if legacy_mislabeled_shared_currency?(transfer:, account:)
              return Success(BigDecimal(transfer.amount.amount.to_s).round(2))
            end

            convert_amount(
              amount: transfer.amount.amount,
              from_currency: transfer.amount_currency,
              to_currency: account.balance_currency,
              space_id: transfer.space_id,
              date: rate_date
            )
          end

          def credit_magnitude(transfer:, account:, rate_date:)
            conv = transfer.currency_conversion

            if conv.present?
              if conv.converted_currency == account.balance_currency
                return Success(BigDecimal(conv.converted_money.amount.to_s).round(2))
              end

              return convert_amount(
                amount: conv.converted_money.amount,
                from_currency: conv.converted_currency,
                to_currency: account.balance_currency,
                space_id: transfer.space_id,
                date: rate_date
              )
            end

            if legacy_mislabeled_shared_currency?(transfer:, account:)
              return Success(BigDecimal(transfer.amount.amount.to_s).round(2))
            end

            convert_amount(
              amount: transfer.amount.amount,
              from_currency: transfer.amount_currency,
              to_currency: account.balance_currency,
              space_id: transfer.space_id,
              date: rate_date
            )
          end

          private

          def legacy_mislabeled_shared_currency?(transfer:, account:)
            stored = effective_stored_amount_currency(transfer:)
            stored.present? && stored == account.balance_currency
          end

          def convert_amount(amount:, from_currency:, to_currency:, space_id:, date:)
            out = ::ExchangeRates::Operations::ConvertSignedAmount.new.call(
              amount:,
              from_currency:,
              to_currency:,
              space_id:,
              date:
            )
            return out if out.failure?

            Success(out.value![:amount])
          end
        end
      end
    end
  end
end
