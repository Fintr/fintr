# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class UpdateLoanInterestTransaction < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:loan_payment).filled(type?: Transactions::LoanPayment)
            required(:loan).filled(type?: Transactions::Loan)
            required(:interest_amount).filled(type?: Money)
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

        def call(params)
          params                = step validate(params:)
          loan_payment          = params[:loan_payment]
          loan                  = params[:loan]
          interest_amount       = params[:interest_amount]
          
          interest_transaction  = step find_interest_transaction(loan_payment:)
          action                = step determine_action(interest_amount:, interest_transaction:)
          result                = step execute_action(
                                  action: action,
                                  interest_transaction: interest_transaction,
                                  loan_payment: loan_payment,
                                  loan: loan,
                                  interest_amount: interest_amount
                                )
          
          result
        end

        private

        def find_interest_transaction(loan_payment:)
          interest_transaction = loan_payment.transaction_record
          Success(interest_transaction)
        end

        def determine_action(interest_amount:, interest_transaction:)
          if interest_amount.amount.zero?
            action = interest_transaction ? :delete : :none
          elsif interest_transaction.nil?
            action = :create
          else
            action = :update
          end
          
          Success(action)
        end

        def execute_action(action:, interest_transaction:, loan_payment:, loan:, interest_amount:)
          case action
          when :delete
            delete_interest_transaction(interest_transaction:)
          when :create
            create_interest_transaction(
              loan_payment: loan_payment,
              loan: loan,
              interest_amount: interest_amount
            )
          when :update
            update_interest_transaction(
              interest_transaction: interest_transaction,
              loan: loan,
              loan_payment: loan_payment,
              interest_amount: interest_amount
            )
          when :none
            Success(nil)
          end
        end

        def create_interest_transaction(loan_payment:, loan:, interest_amount:)
          CreateLoanInterestTransaction.new.call(
            loan_payment: loan_payment,
            loan: loan,
            account: loan_payment.account,
            interest_amount: interest_amount,
            balance_state: "calculated"
          )
        end

        def update_interest_transaction(interest_transaction:, loan:, loan_payment:, interest_amount:)
          currency = loan_payment.currency || loan.currency || "PHP"
          entity_name = loan.entity.display_name
          description = if loan.loan_type == "borrowed"
                         "Interest expense from #{entity_name}"
                       else
                         "Interest income from #{entity_name}"
                       end

          interest_transaction.assign_attributes(
            account_id: loan_payment.account_id,
            amount: interest_amount,
            amount_currency: currency,
            date: loan_payment.date,
            description: description
          )

          Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(
            transaction: interest_transaction
          )
          interest_transaction.save!

          Success(interest_transaction)
        rescue ActiveRecord::RecordInvalid => e
          Failure(interest_transaction: interest_transaction&.errors&.to_hash, error: e, expected: true)
        end

        def delete_interest_transaction(interest_transaction:)
          Transactions::Operations::DeleteThisTransaction.new.call(
            transaction: interest_transaction
          )
        end
      end
    end
  end
end

