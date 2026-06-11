# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CalculateBalances < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(params)
        end

        include FailureHandler

        def call(params)
          _            = step validate(params:)
          transfer     = step find_transfer(params:)
          return Success(transfer) if transfer.balance_state == "calculated"

          _            = step update_from_account_balance(transfer:)
          _            = step update_to_account_balance(transfer:)
          _            = step update_transfer(transfer:)
        end

        private

        def find_transfer(params:)
          Success(
            Transactions::Transfer
              .includes(:currency_conversion, :from_account, :to_account)
              .find(params[:transfer_id])
          )
        rescue ActiveRecord::RecordNotFound => e
          Failure(transfer_id: "not found", error: e, expected: true)
        end

        def update_from_account_balance(transfer:)
          return Success() if transfer.balance_state == "calculated"

          from_account = transfer.from_account
          rate_date = transfer.date.respond_to?(:to_date) ? transfer.date.to_date : transfer.date
          debit_result = ::Transactions::Operations::Transfers::BookedTransferLegMagnitude.debit_magnitude(
            transfer:,
            account: from_account,
            rate_date:
          )
          return debit_result if debit_result.failure?

          debit = debit_result.value!
          old_balance = from_account.balance.amount
          from_new_balance = (
            BigDecimal(old_balance.to_s) - BigDecimal(debit.to_s)
          ).round(2)

          from_account.assign_attributes(
            balance: Money.from_amount(from_new_balance, from_account.balance_currency)
          )
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account: from_account,
            cause: "transfer_calculate_balance",
            whodunnit: transfer.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(from_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(from_account: from_account.errors.to_hash, error: e)
        end

        def update_to_account_balance(transfer:)
          return Success() if transfer.balance_state == "calculated"

          to_account = transfer.to_account
          rate_date = transfer.date.respond_to?(:to_date) ? transfer.date.to_date : transfer.date
          credit_result = ::Transactions::Operations::Transfers::BookedTransferLegMagnitude.credit_magnitude(
            transfer:,
            account: to_account,
            rate_date:
          )
          return credit_result if credit_result.failure?

          credit = credit_result.value!
          old_balance = to_account.balance.amount
          to_new_balance = (
            BigDecimal(old_balance.to_s) + BigDecimal(credit.to_s)
          ).round(2)

          to_account.assign_attributes(
            balance: Money.from_amount(to_new_balance, to_account.balance_currency)
          )
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account: to_account,
            cause: "transfer_calculate_balance",
            whodunnit: transfer.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(to_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(to_account: to_account.errors.to_hash, error: e)
        end

        def update_transfer(transfer:)
          return Success(transfer) if transfer.balance_state == "calculated"

          transfer.assign_attributes(balance_state: "calculated")

          transfer.save!

          Success(transfer)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(error: e)
        end
      end
    end
  end
end
