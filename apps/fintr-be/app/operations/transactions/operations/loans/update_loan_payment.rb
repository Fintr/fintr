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
            optional(:adjusts_account_balance).maybe(:bool)
            optional(:notes).value(:string)
            optional(:original_currency).value(:string)
            optional(:exchange_rate).value(:decimal)
            optional(:exchange_rate_source).value(:string)
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
            update_params       = step transform_params(
              params:,
              loan:,
              account:,
              calculated_interest:,
              loan_payment:
            )
            conversion_data     = step prepare_payment_conversion(
              params:,
              account:,
              loan_payment:,
            )
            loan_payment        = step assign_loan_payment_attributes(loan_payment:, params: update_params)
            _                   = step update_account_balance(
              loan_payment:,
              loan:,
              account:,
              pending_conversion_data: conversion_data,
            )
            _                   = step persist_payment_conversion(
              loan_payment:,
              conversion_data:,
            )
            loan_payment        = step save_loan_payment(loan_payment:)
            _                   = step process_loan_payment(loan_payment:)
            _                   = step update_loan(loan:)

            loan_payment.reload
          end
          step broadcast_updated(loan_payment:, params:)
        end

        private

        def broadcast_updated(loan_payment:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || loan_payment.loan&.user
          Transactions::Broadcasts::TransactionChange.updated(
            transaction: loan_payment,
            actor:,
          )
          ::Loans::Broadcasts::LoanChange.loan_payment_updated(loan_payment:, actor:)
          ::Loans::Broadcasts::LoanChange.loan_updated(loan: loan_payment.loan.reload, actor:)
          Success(loan_payment)
        end

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

        def transform_params(params:, loan:, account:, calculated_interest:, loan_payment:)
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

          if params.key?(:adjusts_account_balance)
            update_params[:adjusts_account_balance] =
              ActiveModel::Type::Boolean.new.cast(params[:adjusts_account_balance]) != false
          end

          update_params[:date] = params[:date] if params[:date].present?
          update_params[:account] = account if params[:account_name].present?
          update_params[:notes] = params[:notes] if params.key?(:notes)

          Success(update_params)
        end

        def prepare_payment_conversion(params:, account:, loan_payment:)
          payment_amount = params[:total_payment] || loan_payment.total_payment.amount

          ::Transactions::Operations::PrepareCurrencyConversion.new.call(
            params: {
              space_id: params[:space_id],
              date: params[:date] || loan_payment.date,
              amount: payment_amount,
              original_currency: params[:original_currency],
              exchange_rate: params[:exchange_rate],
              exchange_rate_source: params[:exchange_rate_source],
            },
            account:,
          )
        end

        def persist_payment_conversion(loan_payment:, conversion_data:)
          PersistLoanPaymentCurrencyConversion.new.call(
            loan_payment:,
            conversion_data:,
          )
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
        rescue ActiveRecord::ActiveRecordError => e
          Failure(error: e)
        end

        def process_loan_payment(loan_payment:)
          loan_payment.process_payment
          Success(loan_payment)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan_payment.errors.to_hash, error: e, expected: true)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(error: e)
        end

        def update_account_balance(loan_payment:, loan:, account:, pending_conversion_data: nil)
          operation = UpdateAccountBalanceForLoanPayment.new.call(
            loan_payment:,
            loan:,
            account:,
            pending_conversion_data:,
          )
          return operation unless operation.success?

          Success(operation.value!)
        end

        def update_loan(loan:)
          loan.recalculate_outstanding_balance!
          Success(loan)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan.errors.to_hash, error: e, expected: true)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(error: e)
        end
      end
    end
  end
end
