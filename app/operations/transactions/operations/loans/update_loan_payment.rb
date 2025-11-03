# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Loans
      class UpdateLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:loan_payment_id).value(:string)

            optional(:account_name).value(:string)
            optional(:date).value(:date)
            optional(:total_payment).value(:decimal, gt?: 0)
            optional(:principal_payment).value(:decimal, gteq?: 0)
            optional(:notes).value(:string)
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
          loan_payment = transaction do
            params          = step validate(params:)
            loan_payment    = step find_loan_payment(params:)
            loan            = step find_loan(loan_payment:, params:)
            old_account     = loan_payment.account
            account         = step find_account(params:, old_account:)

            payment_date = params[:date] || loan_payment.date
            calculated_interest = step calculate_interest(loan:, payment_date:, exclude_payment_id: loan_payment.id)
            update_params       = step transform_params(params:, loan:, account:, calculated_interest:)
            
            if account != old_account
              _ = step reverse_account_balance(loan_payment:, loan:, account: old_account)
            end
            
            loan_payment        = step assign_loan_payment_attributes(loan_payment:, params: update_params)
            _                   = step update_account_balance(loan_payment:, loan:, account:)
            loan_payment        = step save_loan_payment(loan_payment:)
            _                   = step process_loan_payment(loan_payment:)
            _                   = step update_interest_transaction(loan_payment:, loan:)
            _                   = step update_loan(loan:)

            loan_payment.reload
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

        def find_loan(loan_payment:, params:)
          loan = loan_payment.loan
          return Failure(loan_id: "not found") unless loan

          Success(loan)
        end

        def find_account(params:, old_account:)
          if params[:account_name].present?
            account = Transactions::Account.kept.find_by(
              name: params[:account_name],
              space_id: params[:space_id]
            )
            return Failure(account_name: "not found") unless account

            Success(account)
          else
            Success(old_account)
          end
        end

        def calculate_interest(loan:, payment_date:, exclude_payment_id:)
          CalculateLoanPaymentInterest.new.call(
            loan:,
            payment_date:,
            exclude_payment_id:
          )
        end

        def transform_params(params:, loan:, account:, calculated_interest:)
          update_params = {}

          if params[:total_payment].present?
            update_params[:total_payment_cents] = (params[:total_payment] * 100).to_i
            update_params[:interest_payment_cents] = calculated_interest.cents

            if params[:principal_payment].present?
              update_params[:principal_payment_cents] = (params[:principal_payment] * 100).to_i
            else
              principal_cents = update_params[:total_payment_cents] - update_params[:interest_payment_cents]
              update_params[:principal_payment_cents] = [0, principal_cents].max
            end
          end

          update_params[:date] = params[:date] if params[:date].present?
          update_params[:account] = account if params[:account_name].present?
          update_params[:notes] = params[:notes] if params.key?(:notes)

          Success(update_params)
        end

        def assign_loan_payment_attributes(loan_payment:, params:)
          loan_payment.assign_attributes(params)
          Success(loan_payment)
        end

        def save_loan_payment(loan_payment:)
          loan_payment.save!
          Success(loan_payment)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan_payment.errors.to_hash, error: e, expected: true)
        end

        def process_loan_payment(loan_payment:)
          loan_payment.process_payment
          Success(loan_payment)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan_payment.errors.to_hash, error: e, expected: true)
        end

        def update_account_balance(loan_payment:, loan:, account:)
          operation = UpdateAccountBalanceForLoanPayment.new.call(
            loan_payment:,
            loan:,
            account:
          )
          return operation unless operation.success?

          Success(operation.value!)
        end

        def update_interest_transaction(loan_payment:, loan:)
          UpdateLoanInterestTransaction.new.call(
            loan_payment: loan_payment,
            loan: loan,
            interest_amount: loan_payment.interest_payment
          )
        end

        def update_loan(loan:)
          loan.recalculate_outstanding_balance!
          Success(loan)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan.errors.to_hash, error: e, expected: true)
        end
      end
    end
  end
end
