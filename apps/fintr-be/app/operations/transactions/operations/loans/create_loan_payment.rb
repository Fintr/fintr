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
            optional(:adjusts_account_balance).maybe(:bool)
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
            loan_payment.reload
          end
          step broadcast_created(loan_payment:, params:)
          step try_unlock_achievements(loan_payment:, params:)
        end

        private

        def try_unlock_achievements(loan_payment:, params:)
          Achievements::EventHook.evaluate(
            user_id: params[:user_id],
            space_id: params[:space_id],
            event: "loan_payment_created",
          )
          Success(loan_payment)
        end

        def broadcast_created(loan_payment:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || loan_payment.loan&.user
          Transactions::Broadcasts::TransactionChange.created(
            transaction: loan_payment,
            actor:,
          )
          Loans::Broadcasts::LoanChange.loan_payment_created(loan_payment:, actor:)
          Loans::Broadcasts::LoanChange.loan_updated(loan: loan_payment.loan.reload, actor:)
          Success(loan_payment)
        end

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

          params[:total_payment_cents] = (params[:total_payment] * 100).to_i
          params[:interest_payment_cents] = calculated_interest.cents

          if params[:principal_payment].present?
            params[:principal_payment_cents] = (params[:principal_payment] * 100).to_i
          else
            principal_cents = params[:total_payment_cents] - params[:interest_payment_cents]
            params[:principal_payment_cents] = [0, principal_cents].max
          end

          params[:currency] = loan.currency
          params[:adjusts_account_balance] = adjusts_account_balance?(params)

          params.delete(:total_payment)
          params.delete(:principal_payment)
          params.delete(:loan_id)
          params.delete(:account_name)
          params.delete(:user_id)
          params.delete(:space_id)

          params[:loan] = loan
          params[:account] = account

          Success(params)
        end

        def adjusts_account_balance?(params)
          return true unless params.key?(:adjusts_account_balance)

          ActiveModel::Type::Boolean.new.cast(params[:adjusts_account_balance]) != false
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
      end
    end
  end
end
