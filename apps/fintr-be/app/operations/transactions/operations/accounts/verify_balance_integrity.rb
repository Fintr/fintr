# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class VerifyBalanceIntegrity < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:account_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(params)
        end

        include FailureHandler

        def call(params:)
          _                     = step validate(params:)
          account               = step find_account(params:)
          calculated_balance    = step calculate_balance_from_transactions(account:)
          verification_result   = step verify_balance(account:, calculated_balance:)
          verification_result
        end

        private

        def find_account(params:)
          account = Transactions::Account.find(params[:account_id])
          Success(account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(account_id: "not found", error: e, expected: true)
        end

        def calculate_balance_from_transactions(account:)
          # Calculate balance from all transactions (including transfer fees)
          transaction_balance = account.transactions
                                      .where(balance_state: "calculated")
                                      .sum { |t| t.value.amount }

          # Calculate balance from transfers where this account is the recipient
          incoming_transfers = Transactions::Transfer
                              .where(to_account: account, balance_state: "calculated")
                              .sum { |t| t.amount.amount }

          # Calculate balance from transfers where this account is the sender
          outgoing_transfers = Transactions::Transfer
                              .where(from_account: account, balance_state: "calculated")
                              .sum { |t| t.amount.amount }

          # Total calculated balance
          calculated_balance = transaction_balance + incoming_transfers - outgoing_transfers

          Success(Money.from_amount(calculated_balance, account.balance_currency))
        end

        def verify_balance(account:, calculated_balance:)
          stored_balance = account.balance

          if stored_balance.amount == calculated_balance.amount
            Success({
              account_id: account.id,
              account_name: account.name,
              status: "balanced",
              stored_balance: stored_balance.amount,
              calculated_balance: calculated_balance.amount,
              difference: 0
            })
          else
            difference = stored_balance.amount - calculated_balance.amount
            Failure({
              account_id: account.id,
              account_name: account.name,
              status: "imbalanced",
              stored_balance: stored_balance.amount,
              calculated_balance: calculated_balance.amount,
              difference: difference,
              error: "Account balance does not match calculated balance"
            })
          end
        end
      end
    end
  end
end
