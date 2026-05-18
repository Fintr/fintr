# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Signed balance delta in +account.balance_currency+ for applying or reverting a transfer leg,
      # matching {Transactions::Operations::Transfers::CalculateBalances} (debit +original+ on from,
      # credit +converted+ on to).
      #
      # Booked magnitudes (including legacy mis-tagged +amount_currency+) are delegated to
      # {Transactions::Operations::Transfers::BookedTransferLegMagnitude}.
      class ResolveSignedTransferBalanceEffect < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled(type?: ::Transactions::Transfer)
            required(:account).filled(type?: ::Transactions::Account)
            optional(:rate_date).value(:date)
          end
        end

        def call(params)
          params = step validate(params:)
          step resolve(params:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def resolve(params:)
          transfer = params[:transfer]
          account = params[:account]
          rate_date = params[:rate_date] || rate_date_from_transfer(transfer:)

          if transfer.from_account_id == account.id
            debit_result = ::Transactions::Operations::Transfers::BookedTransferLegMagnitude.debit_magnitude(
              transfer:,
              account:,
              rate_date:
            )
            return debit_result if debit_result.failure?

            Success(amount: -debit_result.value!)
          elsif transfer.to_account_id == account.id
            credit_result = ::Transactions::Operations::Transfers::BookedTransferLegMagnitude.credit_magnitude(
              transfer:,
              account:,
              rate_date:
            )
            return credit_result if credit_result.failure?

            Success(amount: credit_result.value!)
          else
            Failure(account: "does not belong to this transfer")
          end
        end

        def rate_date_from_transfer(transfer:)
          d = transfer.date
          d.respond_to?(:to_date) ? d.to_date : d
        end
      end
    end
  end
end
