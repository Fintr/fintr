# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Accounts
      class CreateAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:name).value(:string)
            required(:balance).value(:decimal)
            required(:account_category).value(:string)
            optional(:balance_currency).value(:string)
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
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          transaction do
            params              = step validate(params:)
            params              = step modify_params(params:)
            account             = step create_account(params:)
            return account if params[:balance].zero?

            transaction_params  = step create_transaction_params(params:, account:)
            _                   = step create_initial_balance_transaction(transaction_params:)
            account
          end
        end

        def modify_params(params:)
          space = Spaces::Space.find(params[:space_id])
          params[:balance_currency] = params[:balance_currency].presence || space.currency.presence || "PHP"
          Success(params)
        end

        def create_account(params:)
          account = Transactions::Account.find_or_initialize_by(
            params.slice(
              :space_id,
              :name,
              :account_category
            )
          )
          account.assign_attributes(balance_currency: params[:balance_currency])
          account.save!
          Success(account)
        rescue ActiveRecord::RecordInvalid => e
          Failure(**account.errors.to_hash, error: e, expected: true)
        end

        def create_transaction_params(params:, account:)
          new_params = {
            user_id: params[:user_id].to_s,
            space_id: account.space_id,
            account:,
            amount: params[:balance],
            date: Time.zone.today,
            transaction_type: "income",
            category_name: "Initial Balance",
            schedule_type: "one_time",
            initial_balance: true
          }
          Success(new_params)
        end

        def create_initial_balance_transaction(transaction_params:)
          Transactions::Operations::CreateTransaction.new.call(transaction_params)
        end
      end
    end
  end
end
