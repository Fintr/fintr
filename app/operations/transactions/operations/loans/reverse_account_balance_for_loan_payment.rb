# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class ReverseAccountBalanceForLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:loan_payment).filled(type?: Transactions::LoanPayment)
            required(:loan).filled(type?: Transactions::Loan)
            required(:account).filled(type?: Transactions::Account)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(errors: contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params = step validate(params:)
          account = step reverse_account_balance(params:)
          account
        end

        private

        def reverse_account_balance(params:)
          loan_payment = params[:loan_payment]
          loan = params[:loan]
          account = params[:account]
          
          account.reload

          balance_reversal = case loan.loan_type
          when "borrowed"
            loan_payment.total_payment
          when "lent"
            -loan_payment.total_payment
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
      end
    end
  end
end

