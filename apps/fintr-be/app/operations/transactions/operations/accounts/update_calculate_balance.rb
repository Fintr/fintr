# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class UpdateCalculateBalance < Dry::Operation
        # record has to be a transaction with changes
        class Contract < Dry::Validation::Contract
          params do
            required(:transaction).filled
          end

          rule(:transaction) do
            key.failure("must be a transaction") unless value.is_a?(Transactions::Transaction)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          transaction = params[:transaction]
          return transaction if transaction.is_a?(Transactions::Transaction) && !transaction.changed?

          ActiveRecord::Base.transaction do
            params              = step validate(params:)
            transaction         = step dig_transaction(params:)
            previous_account    = step find_account(id: transaction.account_id_was)
            current_account     = step find_account(id: transaction.account_id)
            _                   = step update_balance(from: :previous, transaction:, account: previous_account)
            _                   = step update_balance(from: :current, transaction:, account: current_account)
            transaction
          end
        end

        def dig_transaction(params:)
          Success(params[:transaction])
        end

        def find_account(id:)
          Success(Transactions::Account.find(id))
        rescue ActiveRecord::RecordNotFound => e
          Failure(account: "not found", error: e, expected: true)
        end

        def update_balance(from:, transaction:, account:)
          account.reload

          case from
          when :previous
            return Success(account) if skip_previous_revert?(transaction:)

            signed_effect = step signed_balance_effect(transaction:, account:, from:)
            new_balance = (
              BigDecimal(account.balance.amount.to_s) - BigDecimal(signed_effect.to_s)
            ).round(2)
          when :current
            signed_effect = step signed_balance_effect(transaction:, account:, from:)
            new_balance = (
              BigDecimal(account.balance.amount.to_s) + BigDecimal(signed_effect.to_s)
            ).round(2)
          else
            return Failure(action: "not supported")
          end

          account.assign_attributes(
            balance: Money.from_amount(new_balance, account.balance_currency)
          )
          save_result = SaveAccount.new.call(
            account:,
            cause: balance_update_cause(from:),
            whodunnit: transaction.user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(account)
        rescue StandardError => e
          Failure(account: "failed to save", error: e)
        end

        def balance_update_cause(from:)
          from == :previous ? "transaction_update_balance_revert" : "transaction_update_balance_apply"
        end

        def skip_previous_revert?(transaction:)
          transaction.balance_state_was == "calculated" &&
            transaction.balance_cents_was.zero?
        end

        def signed_balance_effect(transaction:, account:, from:)
          effect_transaction = transaction_for_effect(transaction:, from:)
          effect_result = ::Transactions::Operations::Accounts::ResolveSignedBalanceEffect.new.call(
            transaction: effect_transaction,
            account:
          )
          return effect_result unless effect_result.success?

          Success(effect_result.value![:amount])
        end

        def transaction_for_effect(transaction:, from:)
          return transaction if from == :current

          transaction.dup.tap do |copy|
            copy.id = transaction.id
            copy.amount_cents = transaction.amount_cents_was
            copy.amount_currency = transaction.amount_currency_was
            copy.type = transaction.attribute_in_database(:type)
            copy.readonly!
          end
        end
      end
    end
  end
end
