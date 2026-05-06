# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class UpdateCalculateBalances < Dry::Operation
        # transfer has to be a transfer with changes
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
            key.failure("must be a transfer with changes") unless value.changed?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          transfer            = step dig_transfer(params:)
          previous_accounts   = step find_previous_accounts(transfer:)
          current_accounts    = step find_current_accounts(transfer:)
          _                   = step update_balances(
                                      from: :previous,
                                      transfer:,
                                      from_account: previous_accounts[:from_account],
                                      to_account: previous_accounts[:to_account]
                                    )
          _                   = step update_balances(
                                      from: :current,
                                      transfer:,
                                      from_account: current_accounts[:from_account],
                                      to_account: current_accounts[:to_account]
                                    )
          Success(transfer)
        end

        private

        def dig_transfer(params:)
          Success(params[:transfer])
        end

        def find_previous_accounts(transfer:)
          from_account = Transactions::Account.find(transfer.from_account_id_was)
          to_account = Transactions::Account.find(transfer.to_account_id_was)
          Success({
            from_account: from_account,
            to_account: to_account
          })
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "previous account not found", error: e, expected: true)
        end

        def find_current_accounts(transfer:)
          from_account = transfer.from_account
          to_account = transfer.to_account
          Success({
            from_account: from_account,
            to_account: to_account
          })
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "current account not found", error: e, expected: true)
        end

        def update_balances(from:, transfer:, from_account:, to_account:)
          from_account.reload
          to_account.reload
          case from
          when :previous
            # Revert previous transfer effects
            # Add back the amount to from_account (it was subtracted)
            from_account.balance_cents += step transfer_amount(transfer:, from:)
            # Subtract the amount from to_account (it was added)
            to_account.balance_cents -= step transfer_amount(transfer:, from:)
          when :current
            # Apply new transfer effects
            # Subtract the amount from from_account
            from_account.balance_cents -= step transfer_amount(transfer:, from:)
            # Add the amount to to_account
            to_account.balance_cents += step transfer_amount(transfer:, from:)
          else
            return Failure(action: "not supported")
          end

          from_account.save!
          to_account.save!
          Success({ from_account: from_account, to_account: to_account })
        rescue StandardError => e
          Failure(accounts: "failed to save", error: e)
        end

        def transfer_amount(transfer:, from:)
          result = if from == :previous
            transfer.amount_cents_was || 0
          else
            transfer.amount_cents
          end
          Success(result)
        end
      end
    end
  end
end
