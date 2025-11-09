# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Loans
      class CreateLoanInterestTransaction < Dry::Operation
        class Contract < Dry::Validation::Contract
          TRANSACTION_BALANCE_STATES = Transactions::Transaction.balance_states.values.freeze

          params do
            required(:loan_payment).filled(type?: Transactions::LoanPayment)
            required(:loan).filled(type?: Transactions::Loan)
            required(:account).filled(type?: Transactions::Account)
            required(:interest_amount).filled(type?: Money)
            required(:balance_state).value(:string, included_in?: TRANSACTION_BALANCE_STATES)
          end

          rule(:interest_amount) do
            key.failure("must be greater than or equal to 0") if value.amount.negative?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(error: contract.errors.to_h) if contract.failure?

          Success(contract.to_h)
        end

        include FailureHandler
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          params                 = step validate(params:)
          return Success(nil) if params[:interest_amount].amount.zero?

          transaction do
            category             = step find_or_create_category(params:)
            transaction_params   = step prepare_transaction_params(params:, category:)
            interest_transaction = step create_transaction(params: transaction_params)
            _                    = step update_currency_if_needed(
                                          transaction: interest_transaction,
                                          loan_payment: params[:loan_payment],
                                          loan: params[:loan]
                                        )
            _                    = step link_to_loan_payment(loan_payment: params[:loan_payment], transaction: interest_transaction)
            interest_transaction
          end
        end

        private

        def find_or_create_category(params:)
          FindOrCreateInterestCategory.new.call(
            space_id: params[:loan].space_id,
            loan_type: params[:loan].loan_type
          )
        end

        def prepare_transaction_params(params:, category:)
          loan = params[:loan]
          loan_payment = params[:loan_payment]
          account = params[:account]
          interest_amount = params[:interest_amount]

          entity_name = loan.entity.display_name
          description = if loan.loan_type == "borrowed"
                          "Interest expense from #{entity_name}"
                        else
                          "Interest income from #{entity_name}"
                        end

          transaction_params = {
            user_id: loan.user_id.to_s,
            space_id: loan.space_id.to_s,
            amount: interest_amount.amount,
            date: loan_payment.date,
            category_name: category.name,
            account_name: account.name,
            description: description,
            schedule_type: "one_time",
            skip_calculation: params[:balance_state] == "calculated"
          }

          Success(transaction_params)
        end

        def create_transaction(params:)
          Transactions::Operations::CreateTransaction.new.call(params)
        end

        def update_currency_if_needed(transaction:, loan_payment:, loan:)
          currency = loan_payment.currency || loan.currency || "PHP"
          return Success(transaction) if transaction.amount_currency == currency

          transaction.update!(amount_currency: currency, balance_currency: currency)
          Success(transaction)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: transaction.errors.to_hash, error: e, expected: true)
        end

        def link_to_loan_payment(loan_payment:, transaction:)
          loan_payment.update!(transaction_id: transaction.id)
          Success(transaction)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan_payment.errors.to_hash, error: e, expected: true)
        end
      end
    end
  end
end
