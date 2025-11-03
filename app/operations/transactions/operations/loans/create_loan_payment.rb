# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Loans
      class CreateLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            # Current user and space
            required(:user_id).value(:string)
            required(:space_id).value(:string)

            # Loan payment details
            required(:loan_id).value(:string)
            required(:account_name).value(:string)
            required(:date).value(:date)
            required(:total_payment).value(:decimal, gt?: 0)
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
            params = step validate(params:)
            loan = step find_loan(params:)
            account = step find_account(params:)
            calculated_interest = step calculate_interest(loan:, payment_date: params[:date])
            params = step transform_params(params:, loan:, account:, calculated_interest:)
            loan_payment = step create_loan_payment(params:)
            _ = step process_loan_payment(loan_payment:)
            _ = step update_account_balance(loan_payment:, loan:, account:)
            _ = step create_interest_transaction(loan_payment:, loan:, account:)
            loan_payment.reload
          end
          loan_payment
        end

        private

        def find_loan(params:)
          loan = Transactions::Loan.find_by(id: params[:loan_id], space_id: params[:space_id])
          return Failure(loan_id: "not found") unless loan

          Success(loan)
        end

        def find_account(params:)
          account = Transactions::Account.kept.find_by(
            name: params[:account_name],
            space_id: params[:space_id]
          )
          return Failure(account_name: "not found") unless account

          Success(account)
        end

        def calculate_interest(loan:, payment_date:)
          CalculateLoanPaymentInterest.new.call(
            loan:,
            payment_date:
          )
        end

        def transform_params(params:, loan:, account:, calculated_interest:)
          params = params.dup

          # Convert total payment to cents
          params[:total_payment_cents] = (params[:total_payment] * 100).to_i

          # Calculate interest payment from calculated interest
          params[:interest_payment_cents] = calculated_interest.cents

          # Calculate principal payment
          # If principal_payment is explicitly provided, use it
          # Otherwise, calculate it from total_payment - interest_payment
          if params[:principal_payment].present?
            params[:principal_payment_cents] = (params[:principal_payment] * 100).to_i
          else
            # Principal = Total Payment - Interest Payment
            principal_cents = params[:total_payment_cents] - params[:interest_payment_cents]
            params[:principal_payment_cents] = [0, principal_cents].max
          end

          params[:currency] = loan.currency

          # Remove transformed fields
          params.delete(:total_payment)
          params.delete(:principal_payment)
          params.delete(:loan_id)
          params.delete(:account_name)
          params.delete(:user_id)
          params.delete(:space_id)

          # Add associations
          params[:loan] = loan
          params[:account] = account

          Success(params)
        end

        def create_loan_payment(params:)
          loan_payment = Transactions::LoanPayment.new(params)
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

        def create_interest_transaction(loan_payment:, loan:, account:)
          CreateLoanInterestTransaction.new.call(
            loan_payment: loan_payment,
            loan: loan,
            account: account,
            interest_amount: loan_payment.interest_payment,
            balance_state: "calculated"
          )
        end
      end
    end
  end
end
