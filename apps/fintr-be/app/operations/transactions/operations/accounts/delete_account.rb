# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Discards the account. When remove_transactions is set, also deletes the
      # income, expenses, transfers, loans, and loan payments booked on it.
      # Per-transaction balance reverts stay in the existing delete operations.
      class DeleteAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:id).value(:string)
            optional(:user_id).value(:string)
            optional(:remove_transactions).value(:bool)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params  = step validate(params:)
          account = step find_account(params:)
          _       = step remove_linked_transactions(params:, account:)
          account = step delete_account(account:)

          account
        end

        private

        def find_account(params:)
          account = Transactions::Account.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(account: "not found") unless account

          Success(account)
        end

        def remove_linked_transactions(params:, account:)
          return Success(account) unless params[:remove_transactions]

          loans_result = remove_loans(params:, account:)
          return loans_result if loans_result.failure?

          payments_result = remove_loan_payments(params:, account:)
          return payments_result if payments_result.failure?

          transfers_result = remove_transfers(params:, account:)
          return transfers_result if transfers_result.failure?

          transactions_result = remove_transactions(params:, account:)
          return transactions_result if transactions_result.failure?

          Success(account)
        end

        def remove_loans(params:, account:)
          loan_ids = Transactions::Loan.where(
            space_id: account.space_id,
            account_id: account.id,
          ).pluck(:id)

          loan_ids.each do |loan_id|
            result = ::Transactions::Operations::Loans::DeleteLoan.new.call(
              user_id: params[:user_id].to_s,
              space_id: account.space_id.to_s,
              loan_id: loan_id.to_s,
            )
            return result unless result.success? || missing_record?(result)
          end

          Success(account)
        end

        def remove_loan_payments(params:, account:)
          payment_ids = Transactions::LoanPayment.joins(:loan).where(
            account_id: account.id,
            loans: { space_id: account.space_id },
          ).pluck(:id)

          payment_ids.each do |loan_payment_id|
            result = ::Transactions::Operations::Loans::DeleteLoanPayment.new.call(
              user_id: params[:user_id].to_s,
              space_id: account.space_id.to_s,
              loan_payment_id: loan_payment_id.to_s,
            )
            return result unless result.success? || missing_record?(result)
          end

          Success(account)
        end

        def remove_transfers(params:, account:)
          transfer_ids = Transactions::Transfer.where(space_id: account.space_id).where(
            "from_account_id = :id OR to_account_id = :id",
            id: account.id,
          ).pluck(:id)

          transfer_ids.each do |transfer_id|
            result = ::Transactions::Operations::Transfers::DeleteTransfer.new.call(
              id: transfer_id.to_s,
              space_id: account.space_id.to_s,
              user_id: params[:user_id].to_s,
              delete_scope: "this_only",
            )
            return result unless result.success? || missing_record?(result)
          end

          Success(account)
        end

        def remove_transactions(params:, account:)
          transaction_ids = Transactions::Transaction.where(
            space_id: account.space_id,
            account_id: account.id,
          ).pluck(:id)

          transaction_ids.each do |transaction_id|
            result = ::Transactions::Operations::DeleteTransaction.new.call(
              id: transaction_id,
              user_id: params[:user_id].to_s,
              delete_scope: "this_only",
            )
            return result unless result.success? || missing_record?(result)
          end

          Success(account)
        end

        def missing_record?(result)
          failure = result.failure
          return false unless failure.is_a?(Hash)

          failure[:id].in?(["Transaction not found", "Transfer not found"]) ||
            failure[:loan_id] == "not found" ||
            failure[:loan_payment_id] == "not found"
        end

        def delete_account(account:)
          account.reload
          save_result = SaveAccount.new.call(
            account:,
            cause: "account_discard",
            operation: self.class.name,
            action: "discard"
          )
          return save_result if save_result.failure?

          Success(account)
        end
      end
    end
  end
end
