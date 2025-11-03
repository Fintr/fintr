# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class UpdateAccountBalanceForLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:loan_payment).filled(type?: Transactions::LoanPayment)
            required(:loan).filled(type?: Transactions::Loan)
            required(:account).filled(type?: Transactions::Account)
          end

          rule(:loan_payment) do
            key.failure("must be a persisted or changed record") unless value.persisted? || value.changed?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params                = step validate(params:)
          old_account           = step find_old_account(params:)
          new_account           = step find_new_account(params:)
          _                     = step reverse_old_account_balance(params:, old_account:)
          balance_change        = step calculate_balance_change(params:)
          account               = step update_new_account_balance(params:, account: new_account, balance_change:)
          account
        end

        private

        def find_old_account(params:)
          loan_payment = params[:loan_payment]

          # Check if account changed
          old_account_id = loan_payment.account_id_was
          return Success(nil) unless old_account_id

          old_account = Transactions::Account.find_by(id: old_account_id)
          return Success(nil) unless old_account

          old_account.reload
          Success(old_account)
        end

        def find_new_account(params:)
          account = params[:account]

          # Reload to ensure we have the latest state
          account.reload
          Success(account)
        end

        def reverse_old_account_balance(params:, old_account:)
          loan_payment = params[:loan_payment]
          loan = params[:loan]

          # If no old account, nothing to reverse
          return Success(nil) unless old_account

          old_total_payment_cents = loan_payment.total_payment_cents_was
          return Success(nil) unless old_total_payment_cents

          # Calculate old payment amount
          currency = loan.currency || "PHP"
          old_total_payment = Money.new(old_total_payment_cents, currency)

          # Reverse the old payment amount from the old account
          # For borrowed: payment decreases balance, so reversal increases it (positive)
          # For lent: payment increases balance, so reversal decreases it (negative)
          balance_reversal = case loan.loan_type
          when "borrowed"
            old_total_payment  # Add back the payment that was subtracted
          when "lent"
            -old_total_payment  # Subtract back the payment that was added
          else
            Money.from_amount(0, currency)
          end

          old_account.reload
          old_balance = old_account.balance.amount
          new_balance = old_balance + balance_reversal.amount

          old_account.assign_attributes(balance: Money.from_amount(new_balance, old_account.balance_currency))
          old_account.save!

          Success(old_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account_name: "failed to reverse", error: e)
        end

        def calculate_balance_change(params:)
          loan_payment = params[:loan_payment]
          loan = params[:loan]

          # Always add the new payment amount to the account
          # The reverse has already been done with the old amount
          balance_change = case loan.loan_type
          when "borrowed"
            -loan_payment.total_payment
          when "lent"
            loan_payment.total_payment
          else
            Money.from_amount(0, loan.currency || "PHP")
          end

          Success(balance_change)
        end

        def update_new_account_balance(params:, account:, balance_change:)
          account.reload

          old_balance = account.balance.amount
          new_balance = old_balance + balance_change.amount

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
