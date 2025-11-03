# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Loans
      class DeleteLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:loan_payment_id).value(:string)
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
            params          = step validate(params:)
            loan_payment    = step find_loan_payment(params:)
            loan            = loan_payment.loan
            account         = loan_payment.account
            
            _               = step reverse_account_balance(loan_payment:, loan:, account:)
            _               = step delete_interest_transaction(loan_payment:)
            _               = step delete_loan_payment(loan_payment:)
            _               = step update_loan(loan:)
            
            loan_payment
          end
          result
        end

        private

        def find_loan_payment(params:)
          loan_payment = Transactions::LoanPayment.joins(:loan)
                                                    .find_by(
                                                      id: params[:loan_payment_id],
                                                      loans: { space_id: params[:space_id] }
                                                    )
          return Failure(loan_payment_id: "not found") unless loan_payment

          Success(loan_payment)
        end

        def delete_loan_payment(loan_payment:)
          loan_payment.destroy!
          Success(loan_payment)
        rescue StandardError => e
          Failure(error: e.message)
        end

        def reverse_account_balance(loan_payment:, loan:, account:)
          operation = ReverseAccountBalanceForLoanPayment.new.call(
            loan_payment:,
            loan:,
            account:
          )
          return operation unless operation.success?

          Success(operation.value!)
        end

        def delete_interest_transaction(loan_payment:)
          return Success(nil) unless loan_payment.transaction_record

          Transactions::Operations::DeleteThisTransaction.new.call(
            transaction: loan_payment.transaction_record
          )
        end

        def update_loan(loan:)
          loan.recalculate_outstanding_balance!
          Success(loan)
        rescue StandardError => e
          Failure(error: e.message)
        end
      end
    end
  end
end

