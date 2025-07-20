# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class CreateAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:name).value(:string)
            required(:balance).value(:decimal)
            required(:account_category).value(:string)
          end

          rule(:balance) do
            key.failure("must be a positive number") if value.negative?
            key.failure("must have a maximum of 2 decimal places") if value.to_s.split(".").last.length > 2
          end

          rule(:account_category) do
            key.failure("must be a valid account category") unless Transactions::Account.account_categories.values.include?(value)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params:)
          ActiveRecord::Base.transaction do
            _                   = step validate(params:)
            params              = step modify_params(params:)
            account             = step create_account(params:)
            return account if params[:balance].zero?

            transaction_params  = step create_transaction_params(params:, account:)
            _                   = step create_initial_balance_transaction(transaction_params:, account:)
            account
          end
        end

        def modify_params(params:)
          params[:balance_currency] = "PHP"
          Success(params)
        end

        def create_account(params:)
          account = Transactions::Account.new(
            params.slice(
              :space_id,
              :name,
              :balance_currency,
              :account_category
            )
          )
          account.save!
          Success(account)
        rescue ActiveRecord::RecordInvalid => e
          Failure(**account.errors.to_hash)
        end

        def create_transaction_params(params:, account:)
          new_params = {
            user_id: params[:user_id],
            space_id: params[:space_id],
            amount: params[:balance],
            date: Time.zone.today,
            category_name: "Initial Balance",
            account_name: account.name,
            schedule_type: "one_time"
          }
          Success(new_params)
        end

        def create_initial_balance_transaction(transaction_params:, account:)
          Transactions::Operations::CreateTransaction.new.call(params: transaction_params)
        end
      end
    end
  end
end
