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
            optional(:skip_broadcast).maybe(:bool)
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
          broadcast_row = nil
          space_id = nil

          loan_payment = transaction do
            params          = step validate(params:)
            loan_payment    = step find_loan_payment(params:)
            loan            = loan_payment.loan
            account         = loan_payment.account
            space_id        = loan.space_id
            broadcast_row   = step snapshot_for_broadcast(loan_payment:)

            _               = step reverse_account_balance(loan_payment:, loan:, account:)
            _               = step delete_loan_payment(loan_payment:)
            _               = step update_loan(loan:)

            loan_payment
          end

          unless params[:skip_broadcast]
            step broadcast_deleted(
              space_id:,
              transactions: broadcast_row,
              result: loan_payment,
              params:,
            )
          end

          loan_payment
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

        def snapshot_for_broadcast(loan_payment:)
          payload = Transactions::Broadcasts::TransactionChange.serialize_index_row(
            transaction: loan_payment,
          )
          Success(Array(payload).compact)
        end

        def delete_loan_payment(loan_payment:)
          loan_payment.destroy!
          Success(loan_payment)
        rescue ActiveRecord::RecordNotDestroyed => e
          Failure(errors: loan_payment.errors.to_hash, error: e, expected: true)
        rescue StandardError => e
          Failure(error: e)
        end

        def reverse_account_balance(loan_payment:, loan:, account:)
          return Success(nil) unless loan_payment.adjusts_account_balance

          operation = ReverseAccountBalanceForLoanPayment.new.call(
            loan_payment:,
            loan:,
            account:
          )
          return operation unless operation.success?

          Success(operation.value!)
        end

        def update_loan(loan:)
          loan.recalculate_outstanding_balance!
          Success(loan)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan.errors.to_hash, error: e, expected: true)
        rescue StandardError => e
          Failure(error: e)
        end

        def broadcast_deleted(space_id:, transactions:, result:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || result&.loan&.user
          Transactions::Broadcasts::TransactionChange.deleted(
            space_id:,
            transactions:,
            actor:,
          )
          Loans::Broadcasts::LoanChange.loan_payment_deleted(
            loan_payment_id: result.id,
            loan_id: result.loan_id,
            space_id:,
            actor:,
          )
          Loans::Broadcasts::LoanChange.loan_updated(loan: result.loan.reload, actor:)
          Success(result)
        end
      end
    end
  end
end
