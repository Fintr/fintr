# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Loans
      class DeleteLoan < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:loan_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          broadcast_rows = nil
          space_id = nil

          loan = transaction do
            params = step validate(params:)
            loan    = step find_loan(params:)
            space_id = loan.space_id
            broadcast_rows = step snapshot_for_broadcast(loan:)

            _       = step reverse_initial_account_balance(loan:)
            _       = step delete_all_loan_payments(loan:, params:)
            _       = step delete_loan_transaction(loan:)
            _       = step delete_loan(loan:)

            loan
          end

          step broadcast_deleted(
            space_id:,
            transactions: broadcast_rows,
            result: loan,
            params:,
          )
        end

        private

        def find_loan(params:)
          loan = Transactions::Loan.find_by(
            id: params[:loan_id],
            space_id: params[:space_id]
          )
          return Failure(loan_id: "not found") unless loan

          Success(loan)
        end

        def snapshot_for_broadcast(loan:)
          records = [loan] + loan.loan_payments.to_a
          payloads = Transactions::Broadcasts::TransactionChange.serialize_index_rows(
            transactions: records,
          )
          Success(payloads)
        end

        def reverse_initial_account_balance(loan:)
          account = loan.account
          account.reload

          return Success(account) unless loan.adjusts_account_balance

          # Reverse the initial loan amount based on loan type
          balance_reversal = case loan.loan_type
          when "borrowed"
            # When borrowing, initial loan increased account balance (positive)
            # So reversal is negative
            -loan.principal_amount
          when "lent"
            # When lending, initial loan decreased account balance (negative)
            # So reversal is positive
            loan.principal_amount
          else
            Money.from_amount(0, loan.currency.presence || loan.space.currency.presence || "PHP")
          end

          old_balance = account.balance.amount
          new_balance = old_balance + balance_reversal.amount

          account.assign_attributes(balance: Money.from_amount(new_balance, account.balance_currency))
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account:,
            cause: "loan_delete_revert_balance",
            whodunnit: loan.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account_name: "failed to update", error: e)
        end

        def delete_all_loan_payments(loan:, params:)
          # Delete all loan payments using the DeleteLoanPayment operation
          # This ensures proper cleanup (reverse account balances, delete transactions, etc.)
          loan_payments = loan.loan_payments.order(:date).to_a

          loan_payments.each do |loan_payment|
            delete_params = {
              user_id: params[:user_id] || loan.user_id,
              space_id: loan.space_id,
              loan_payment_id: loan_payment.id,
              skip_broadcast: true,
            }

            operation = ::Transactions::Operations::Loans::DeleteLoanPayment.new.call(delete_params)
            return operation unless operation.success?
          end

          Success(nil)
        end

        def delete_loan_transaction(loan:)
          # If the loan has an associated transaction, delete it
          # Note: Loan doesn't directly have a transaction_id, but we should check
          # if there's a transaction created fr the initial loan amount
          # For now, we'll rely on loan payments to clean up their transactions
          Success(nil)
        end

        def delete_loan(loan:)
          loan.destroy!
          Success(loan)
        rescue ActiveRecord::RecordNotDestroyed => e
          Failure(errors: loan.errors.to_hash, error: e, expected: true)
        rescue StandardError => e
          Failure(error: e.message)
        end

        def broadcast_deleted(space_id:, transactions:, result:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || result&.user
          Transactions::Broadcasts::TransactionChange.deleted(
            space_id:,
            transactions:,
            actor:,
          )
          Loans::Broadcasts::LoanChange.loan_deleted(
            loan_id: params[:loan_id],
            space_id:,
            actor:,
          )
          Success(result)
        end
      end
    end
  end
end
