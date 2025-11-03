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
          result = transaction do
            params = step validate(params:)
            loan    = step find_loan(params:)

            _       = step reverse_initial_account_balance(loan:)
            _       = step delete_all_loan_payments(loan:)
            _       = step delete_loan_transaction(loan:)
            _       = step delete_loan(loan:)

            loan
          end
          result
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

        def reverse_initial_account_balance(loan:)
          account = loan.account
          account.reload

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
            Money.from_amount(0, loan.currency || "PHP")
          end

          old_balance = account.balance.amount
          new_balance = old_balance + balance_reversal.amount

          account.assign_attributes(balance: Money.from_amount(new_balance, account.balance_currency))
          account.save!

          Success(account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account_name: "failed to update", error: e)
        end

        def delete_all_loan_payments(loan:)
          # Delete all loan payments using the DeleteLoanPayment operation
          # This ensures proper cleanup (reverse account balances, delete transactions, etc.)
          loan_payments = loan.loan_payments.order(:date).to_a

          loan_payments.each do |loan_payment|
            delete_params = {
              user_id: loan.user_id,
              space_id: loan.space_id,
              loan_payment_id: loan_payment.id
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
        rescue StandardError => e
          Failure(error: e.message)
        end
      end
    end
  end
end
